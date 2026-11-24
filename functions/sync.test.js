const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("node:fs"); const path = require("node:path");
const S = require("./sync"); const fx = (f) => fs.readFileSync(path.join(__dirname, "fixtures", f), "utf8"); const sh = JSON.parse(fx("speedhive.json"));

test("standings page → national table and the team's conference ranks", () => {
  const p = S.parseStandings(fx("standings.html"));
  assert.deepEqual(p.national.slice(0, 3), [{ team: "Mo Minis Mo Problems", points: 163 }, { team: "Half-Fast Racing", points: 158 }, { team: "Battle Scarred Motorsports", points: 85 }]);
  assert.equal(p.national.length, 20); assert.ok(!p.national.some((r) => r.team === "Robert Powers"), "individual drivers are not mixed in");
  const d = S.standingsDoc(p, "2026-11-24");
  assert.deepEqual(d.conferences, [{ name: "South", rank: 1, points: 71 }, { name: "Midwest", rank: 2, points: 30 }, { name: "Gulf", rank: 3, points: 50 }]);
  assert.equal(d.team, "Half-Fast Racing"); assert.equal(d.season, "2026");
});
test("a changed standings page is an error, never an empty table", () => { assert.throws(() => S.parseStandings("<html>redesigned</html>")); });

test("schedule page → races only, with ids, dates, track and deadline", () => {
  const r = S.parseSchedule(fx("schedule.html")); const ra = r.find((x) => x.name.includes("Scrotium") && x.start.startsWith("2026"));
  assert.deepEqual(ra, { id: "r441", start: "2026-12-12", end: "2026-12-13", name: "The Kim Harmon Scrotium 500", loc: "Road Atlanta, Braselton GA", deadline: "Nov 21, 2026" });
  assert.ok(r.length >= 20); assert.equal(new Set(r.map((x) => x.id)).size, r.length, "no duplicates from the mobile copy of each row");
  assert.ok(r.every((x) => /^\d{4}-\d\d-\d\d$/.test(x.start) && x.end >= x.start));
});
test("a schedule refresh keeps the team's choices and races that left the page", () => {
  const official = [{ id: "r441", start: "2026-12-12", end: "2026-12-13", name: "The Kim Harmon Scrotium 500", loc: "Road Atlanta, Braselton GA", deadline: "Nov 21, 2026" }, { id: "r500", start: "2027-01-30", end: "2027-01-31", name: "Shine Country Classic", loc: "Barber", deadline: "" }];
  const existing = [{ id: "2026-12-12-old", start: "2026-12-12", end: "2026-12-13", name: "The Kim Harmon Scrotium 500", loc: "x", deadline: "", racing: true, cars: ["42"] }, { id: "r300", start: "2026-11-07", end: "2026-11-08", name: "Texas Tippin'", loc: "MSR", deadline: "", racing: true, cars: ["42"] }, { id: "r999", start: "2027-06-01", end: "2027-06-02", name: "Cancelled", loc: "", deadline: "", racing: false, cars: [] }];
  const m = S.mergeSchedule(existing, official);
  assert.deepEqual(m.map((r) => [r.id, r.racing, r.cars]), [["r300", true, ["42"]], ["r441", true, ["42"]], ["r500", false, []]]);
});

test("timing feed → the team's cars, best run per car", () => {
  const event = sh.events.find((e) => e.id === 3778041); const sessions = S.walkSessions(sh.sessions["3778041"]).filter((s) => s.type === "race");
  assert.equal(sessions.length, 1);
  const ev = S.buildEvent(event, sessions.map((session) => ({ session, rows: sh.classification[session.id].rows })));
  assert.equal(ev.race, "Texas Tippin'"); assert.equal(ev.track, "MSR Houston"); assert.equal(ev.date, "2026-11-07"); assert.equal(ev.eventId, 3778041);
  assert.deepEqual(ev.cars["42"], { pos: 3, cls: "A", pic: 2, laps: 358, best: "1:55.549" }); assert.deepEqual(Object.keys(ev.cars).sort(), ["17", "37", "42"]);
  assert.equal(S.buildEvent(event, [{ session: sessions[0], rows: [{ name: "Someone Else", position: 1 }] }]), null);
});
test("a fresh result keeps the written report, and hand-fixed results are left alone", () => {
  const old = { id: "a", eventId: 1, date: "2026-11-07", race: "Texas Tippin'", track: "MSR", of: 100, cars: { 42: { pos: 5, cls: "A", pic: 3, laps: 300, best: "1:56.0" } }, report: "We finished.", note: "P5" };
  const fresh = { id: "b", eventId: 1, date: "2026-11-07", race: "Texas Tippin'", track: "MSR Houston", of: 121, cars: { 42: { pos: 3, cls: "A", pic: 2, laps: 358, best: "1:55.549" } } };
  const m = S.mergeEvent([old], fresh); assert.equal(m.changed, true); assert.equal(m.events.length, 1);
  assert.deepEqual([m.events[0].id, m.events[0].report, m.events[0].note, m.events[0].cars[42].pos], ["a", "We finished.", "P5", 3]);
  assert.equal(S.mergeEvent(m.events, fresh).changed, false, "running again changes nothing");
  assert.equal(S.mergeEvent([{ ...old, manual: true }], fresh).events[0].cars[42].pos, 5);
  const added = S.mergeEvent([old], { ...fresh, eventId: 2, date: "2026-12-13", race: "Scrotium" }); assert.deepEqual(added.events.map((e) => e.date), ["2026-12-13", "2026-11-07"]);
});

test("the full run: one source failing doesn't stop or blank the others", async () => {
  const store = {}; const db = { collection: (c) => ({ doc: (d) => ({ get: async () => ({ exists: `${c}/${d}` in store, data: () => store[`${c}/${d}`] }), set: async (v) => { store[`${c}/${d}`] = JSON.parse(JSON.stringify(v)); } }) }) };
  const seed = require("./seed.json");
  const fetcher = async (url) => {
    if (url.includes("/organizations/")) return sh.events; if (url.includes("/events/3778041/sessions")) return sh.sessions["3778041"];
    const m = /sessions\/(\d+)\/classification/.exec(url); if (m) return sh.classification[m[1]]; if (url.includes("/sessions")) return { sessions: [] };
    if (url.endsWith("/standings")) throw new Error("24hoursoflemons.com answered 503"); if (url.includes("/schedule")) return fx("schedule.html"); throw new Error("unexpected " + url);
  };
  store["site/schedule"] = { races: seed.schedule };
  const st = await S.runSync(db, { seed, today: "2026-11-24", days: 21, fetcher });
  assert.equal(st.ok, false); assert.equal(st.failures, 1); assert.equal(st.steps.standings.ok, false); assert.equal(st.steps.results.ok, true); assert.equal(st.steps.schedule.ok, true);
  assert.ok(!("site/standings" in store), "the old standings stay in place when the page can't be read");
  assert.equal(store["seasons/2026"].events.length, seed.seasons["2026"].length, "the race was already on record, so nothing is duplicated");
  const ra = store["site/schedule"].races.find((r) => r.id === "r441"); assert.equal(ra.racing, true, "Road Atlanta stays switched on after the refresh");
  const st2 = await S.runSync(db, { seed, today: "2026-11-24", fetcher: async (u) => (u.endsWith("/standings") ? fx("standings.html") : fetcher(u)) });
  assert.equal(st2.ok, true); assert.equal(st2.failures, 0); assert.equal(store["site/standings"].national[1].team, "Half-Fast Racing");
});
