// Keeps the dynamic parts of the site current from the official sources:
//   results   → MyLaps Speedhive event-results API (organization 145414 = 24 Hours of Lemons)
//   standings → https://24hoursoflemons.com/standings   (read from the page; no data feed exists)
//   schedule  → https://24hoursoflemons.com/schedule    (same)
// The parse* and merge* functions are pure and tested against saved copies in fixtures/.
const SPEEDHIVE = "https://eventresults-api.speedhive.com/api/v0.2.3/eventresults";
const ORG = 145414;
const LEMONS = "https://24hoursoflemons.com";
const TEAM_RE = /half.?fast/i;
const UA = "half-fast-racing-site/1.0 (team website results check)";
const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

const decode = (s) => String(s).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#0?39;|&#8217;|&rsquo;/g, "'").replace(/&quot;|&#8220;|&#8221;/g, '"').replace(/&#8211;|&ndash;/g, "–").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const norm = (s) => String(s || "").toLowerCase().replace(/20\d\d/g, "").replace(/[^a-z0-9]/g, "");
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const plusDays = (isoDate, n) => { const d = new Date(isoDate + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** → { national: [{team, points}], regions: { west: [...], ... } }. Throws if the page no longer looks like the standings page. */
function parseStandings(html) {
  const ids = ["national", "west", "midwest", "gulf", "south", "east"]; const out = {};
  ids.forEach((id, i) => {
    const start = html.indexOf(`id="${id}" role="tabpanel"`); if (start < 0) throw new Error(`standings: no "${id}" section`);
    const next = ids.slice(i + 1).map((n) => html.indexOf(`id="${n}" role="tabpanel"`, start)).find((p) => p > 0) ?? html.length;
    let block = html.slice(start, next); const teams = block.indexOf(">Teams<"); if (teams < 0) throw new Error(`standings: no Teams table in "${id}"`);
    const ind = block.indexOf(">Individuals<", teams); block = block.slice(teams, ind > 0 ? ind : undefined);
    out[id] = [...block.matchAll(/<td class="text-start">([^<]*)<\/td>\s*<td class="text-start">\s*(\d+)\s*<\/td>/g)].map((m) => ({ team: decode(m[1]), points: Number(m[2]) })).filter((r) => r.team);
  });
  if (out.national.length < 5) throw new Error("standings: fewer than 5 national teams");
  const { national, ...regions } = out; return { national, regions };
}
/** The standings doc the site stores: top of the national table, plus where the team sits in each conference it appears in. */
function standingsDoc(parsed, today) {
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const us = (rows) => rows.findIndex((r) => TEAM_RE.test(r.team));
  const i = us(parsed.national);
  const conferences = Object.entries(parsed.regions).map(([name, rows]) => { const k = us(rows); return k < 0 ? null : { name: cap(name), rank: k + 1, points: rows[k].points }; }).filter(Boolean).sort((a, b) => a.rank - b.rank);
  return { season: today.slice(0, 4), checkedAt: today, team: i >= 0 ? parsed.national[i].team : "Half-Fast Racing", national: parsed.national.slice(0, 20), conferences };
}

/** → [{ id, start, end, name, loc, deadline }] for the Race tab of the schedule page. */
function parseSchedule(html) {
  const a = html.indexOf('id="race"'); const b = html.indexOf('id="rally"', a); if (a < 0) throw new Error("schedule: no race section");
  const out = []; const seen = new Set();
  for (const block of html.slice(a, b > 0 ? b : undefined).split("<!-- Desktop Version -->").slice(1)) {
    const body = block.split("<!-- /Desktop Version -->")[0];
    const id = /\/race\/\?id=(\d+)/.exec(body); const h4 = [...body.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>/g)].map((m) => decode(m[1]));
    const d = /([A-Z][a-z]{2}) (\d{1,2}) - ([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/.exec(body); const dl = /Entry Deadline:\s*([^<]+)</.exec(body);
    if (!id || !d || h4.length < 2 || !MON[d[1]] || !MON[d[3]] || seen.has(id[1])) continue;
    seen.add(id[1]); const y = Number(d[5]); const endY = MON[d[3]] < MON[d[1]] ? y : y; const startY = MON[d[3]] < MON[d[1]] ? y - 1 : y; // "Dec 31 - Jan 01, 2027"
    out.push({ id: "r" + id[1], start: iso(startY, MON[d[1]], Number(d[2])), end: iso(endY, MON[d[3]], Number(d[4])), name: h4[h4.length - 1].replace(/\s*20\d\d\b/, "").trim(), loc: h4[0].replace(/\s*,\s*/g, ", "), deadline: dl ? decode(dl[1]) : "" });
  }
  if (!out.length) throw new Error("schedule: no races found");
  return out.sort((x, y) => x.start.localeCompare(y.start));
}
/** New official list, keeping the team's own choices (racing, cars) and any race that has dropped off the official page. */
function mergeSchedule(existing, official) {
  const key = (r) => r.start + "|" + norm(r.name); const old = new Map((existing || []).map((r) => [key(r), r])); const byId = new Map((existing || []).map((r) => [r.id, r]));
  const used = new Set();
  const merged = official.map((r) => { const o = byId.get(r.id) || old.get(key(r)); if (o) used.add(o); return { ...r, racing: !!(o && o.racing), cars: (o && o.cars) || [] }; });
  for (const o of existing || []) if (!used.has(o) && (o.racing || o.end < official[0].start)) merged.push(o);
  return merged.sort((x, y) => x.start.localeCompare(y.start));
}

const walkSessions = (s) => [...(s.sessions || []), ...(s.groups || []).flatMap(walkSessions), ...(s.subGroups || []).flatMap(walkSessions)];
/** One Speedhive event → the site's event shape, or null when the team wasn't classified in it. `classifications` = [{ session, rows }]. */
function buildEvent(event, classifications) {
  let ev = null;
  for (const { session, rows } of classifications) for (const r of rows) {
    if (!TEAM_RE.test(r.name || "")) continue;
    ev ??= { id: `${event.startDate.slice(0, 10)}-${norm(session.name).slice(0, 24)}`, date: plusDays(event.startDate.slice(0, 10), 1), race: String(session.name || "").replace(/\s*20\d\d$/, "").trim(), track: String(event.name || "").replace(/^24 Hours of Le[mM]ons\s*-\s*/, "").replace(/\s*20\d\d$/, "").trim(), of: 0, eventId: event.id, cars: {} };
    const n = String(r.startNumber || "?"); const laps = r.numberOfLaps || 0;
    if (!ev.cars[n] || laps > ev.cars[n].laps) { ev.cars[n] = { pos: r.position || 999, cls: r.resultClass || "", pic: r.positionInClass ?? null, laps, best: String(r.bestTime || "").replace(/^0+(?=\d)/, "").replace(/^:/, "") }; ev.of = Math.max(ev.of, rows.length); }
  }
  return ev;
}
/** Put a freshly fetched event into a season, keeping what people wrote (note, report), which car ran which number (assign) and any hand-corrected numbers. */
function mergeEvent(events, fresh) {
  const i = events.findIndex((e) => (e.eventId && e.eventId === fresh.eventId) || (e.date === fresh.date && norm(e.race) === norm(fresh.race)));
  if (i < 0) return { events: [...events, fresh].sort((a, b) => b.date.localeCompare(a.date)), changed: true };
  const old = events[i]; if (old.manual) return { events, changed: false };
  const next = { ...fresh, id: old.id || fresh.id, ...(old.note ? { note: old.note } : {}), ...(old.report ? { report: old.report } : {}), ...(old.assign ? { assign: old.assign } : {}) };
  const changed = JSON.stringify({ ...old, id: 0 }) !== JSON.stringify({ ...next, id: 0 });
  const copy = [...events]; copy[i] = next; return { events: copy, changed };
}

async function get(url, as = "json") {
  let r;
  try { r = await fetch(url, { headers: { accept: as === "json" ? "application/json" : "text/html", "user-agent": UA }, signal: AbortSignal.timeout(25_000) }); }
  catch { throw new Error(`${new URL(url).host} couldn't be reached`); }
  if (!r.ok) throw new Error(`${new URL(url).host} answered ${r.status}`);
  return as === "json" ? r.json() : r.text();
}
/** Speedhive events that started in the last `days` days, each with the team's result if it has one. */
async function fetchRecentResults(today, days, fetcher = get) {
  const events = await fetcher(`${SPEEDHIVE}/organizations/${ORG}/events?count=30&offset=0&sportCategory=Motorized`);
  const from = plusDays(today, -days); const out = [];
  for (const event of events.filter((e) => e.startDate && e.startDate.slice(0, 10) >= from && e.startDate.slice(0, 10) <= today)) {
    const sessions = walkSessions(await fetcher(`${SPEEDHIVE}/events/${event.id}/sessions`)).filter((s) => String(s.type || "").toLowerCase() === "race");
    const cls = []; for (const session of sessions) cls.push({ session, rows: (await fetcher(`${SPEEDHIVE}/sessions/${session.id}/classification`)).rows || [] });
    const ev = buildEvent(event, cls); if (ev) out.push(ev);
  }
  return out;
}

/** Runs all three checks. Each is independent: one failing never blocks or blanks the others. Returns the status that the admin shows. */
async function runSync(db, { seed, today, days = 21, fetcher = get }) {
  const now = new Date().toISOString(); const steps = {};
  const step = async (name, fn) => { try { steps[name] = { ok: true, at: now, detail: await fn() }; } catch (err) { console.error(`sync ${name} failed`, err); steps[name] = { ok: false, at: now, error: String(err.message || err).slice(0, 300) }; } };
  await step("results", async () => {
    const fresh = await fetchRecentResults(today, days, fetcher); const changed = [];
    for (const ev of fresh) {
      const year = ev.date.slice(0, 4); const ref = db.collection("seasons").doc(year); const snap = await ref.get();
      const base = snap.exists && Array.isArray(snap.data().events) && snap.data().events.length ? snap.data().events : (seed.seasons[year] || []);
      const m = mergeEvent(base, ev); if (m.changed || !snap.exists) { await ref.set({ events: m.events }); if (m.changed) changed.push(ev.race); }
    }
    return changed.length ? `Updated: ${changed.join(", ")}` : `No changes (${fresh.length} recent race${fresh.length === 1 ? "" : "s"} checked)`;
  });
  await step("standings", async () => { const doc = standingsDoc(parseStandings(await fetcher(`${LEMONS}/standings`, "text")), today); await db.collection("site").doc("standings").set(doc); const i = doc.national.findIndex((r) => TEAM_RE.test(r.team)); return i >= 0 ? `P${i + 1} nationally, ${doc.national[i].points} points` : "Team not in the national top 20"; });
  await step("schedule", async () => { const official = parseSchedule(await fetcher(`${LEMONS}/schedule/`, "text")); const ref = db.collection("site").doc("schedule"); const snap = await ref.get(); const existing = snap.exists && Array.isArray(snap.data().races) && snap.data().races.length ? snap.data().races : seed.schedule; await ref.set({ races: mergeSchedule(existing, official) }); return `${official.length} races on the official schedule`; });
  const ref = db.collection("site").doc("sync"); const prev = (await ref.get()).data() || {}; const ok = Object.values(steps).every((s) => s.ok);
  // Remember the last time each check worked, so the admin can say how stale a failing one is.
  const lastGood = { ...(prev.lastGood || {}) }; for (const [k, s] of Object.entries(steps)) if (s.ok) lastGood[k] = now;
  const status = { at: now, ok, steps, lastGood, failures: ok ? 0 : (prev.failures || 0) + 1 };
  await ref.set(status); return status;
}
module.exports = { parseStandings, standingsDoc, parseSchedule, mergeSchedule, buildEvent, mergeEvent, walkSessions, fetchRecentResults, runSync };
