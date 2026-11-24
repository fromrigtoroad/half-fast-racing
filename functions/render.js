// Renders every public page from one "state" object (see data.js). Pure: no I/O, so it is easy to test.
const e = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso) => { const [, m, d] = iso.split("-").map(Number); return `${MON[m - 1]} ${d}`; };
const num = (n) => Number(n).toLocaleString("en-US");
const lines = (s) => e(s).split("\n");
const paras = (s) => String(s || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${e(p).replace(/\n/g, "<br>")}</p>`).join("");
const lead = (ev) => Object.entries(ev.cars).sort((a, b) => a[1].pos - b[1].pos);
const stat = (n, l, hl) => `<div class="st${hl ? " hl" : ""}"><b>${n}</b><span>${l}</span></div>`;

function agg(evl) {
  const cars = evl.flatMap((ev) => Object.values(ev.cars)); const best = evl.map((ev) => lead(ev)[0][1]);
  if (!cars.length) return { races: 0, laps: 0, best: null, top5: 0, top10: 0, clspod: 0 };
  return { races: evl.length, laps: cars.reduce((s, c) => s + c.laps, 0), best: Math.min(...cars.map((c) => c.pos)),
    top5: best.filter((b) => b.pos <= 5).length, top10: best.filter((b) => b.pos <= 10).length, clspod: cars.filter((c) => c.pic && c.pic <= 3).length };
}
function table(evl, limit) {
  const rows = evl.slice(0, limit ?? evl.length).map((ev) => {
    const cars = lead(ev); const [n, c] = cars[0];
    const oth = cars.slice(1).map(([m, x]) => `<span class="chip">#${e(m)} <i>P${x.pos}</i></span>`).join("");
    const cl = c.pic ? `${e(c.cls)} · P${c.pic}` : e(c.cls);
    return `<tr><td class="d">${day(ev.date)}</td><td><strong>${e(ev.race)}</strong><small>${e(ev.track)}</small></td><td class="m">#${e(n)}</td><td class="pc"><span class="pos${c.pos <= 5 ? " top" : ""}">P${c.pos}</span><span class="of">/ ${ev.of}</span></td><td class="m nw">${cl}</td><td class="m r">${c.laps}</td><td class="m r">${e(c.best)}</td><td class="oth">${oth}</td></tr>`;
  }).join("");
  return `<div class="tbl"><table><thead><tr><th>Date</th><th>Race</th><th>Car</th><th>Overall</th><th>Class</th><th class="r">Laps</th><th class="r">Best lap</th><th>Other team cars</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
const img = (url, alt, cls = "") => `<img class="ph ${cls}" src="${e(url)}" alt="${e(alt)}" loading="lazy">`;
const slot = (label, cls = "") => `<div class="slot ${cls}">${e(label)}</div>`;

const carTitle = (info) => [info.year, info.make, info.model].filter(Boolean).join(" ");
const isActive = (S, id) => !(S.cars[id] && S.cars[id].active === false);
const byName = (S) => (a, b) => S.cars[a].name.localeCompare(S.cars[b].name, "en", { numeric: true });
/** One car: a showcase card. mode "full" adds the story. The number is whatever the team typed; a short one is shown big. */
function carcard(S, id, mode) {
  const info = S.cars[id]; const title = carTitle(info); const big = /^[A-Za-z0-9]{1,4}$/.test(info.number);
  const head = !big && isActive(S, id) ? "" : `<div class="carhead">${big ? `<div class="num">${e(info.number)}</div>` : "<span></span>"}${isActive(S, id) ? "" : `<span class="cls">Retired</span>`}</div>`;
  const names = `<h3 class="cname">${e(info.name)}</h3>${title ? `<p class="cmodel">${e(title)}</p>` : ""}${info.number && !big ? `<p class="clast">Races as ${e(info.number)}</p>` : ""}`;
  const story = mode === "full" && info.story ? `<div class="cstory">${paras(info.story)}</div>` : "";
  return `<article class="car${isActive(S, id) ? "" : " retired"}" id="car-${e(id)}">${head}${info.photo ? img(info.photo, info.name) : (isActive(S, id) ? slot("Photo coming") : "")}${names}${story}</article>`;
}

const NAV = [["home", "Home", "/"], ["results", "Results", "/results"], ["cars", "Cars", "/cars"], ["about", "About", "/about"], ["gallery", "Gallery", "/gallery"]];
const header = (active) => `<header class="top"><div class="wrap bar"><a class="brand" href="/"><b>Half Fast</b><span>Racing</span></a><nav class="main" aria-label="Main">${NAV.map(([k, v, h]) => `<a href="${h}" class="${k === active ? "on" : ""}">${v}</a>`).join("")}</nav></div></header>`;
const footer = () => `<footer><div class="wrap fgrid"><div><a class="brand" href="/"><b>Half Fast</b><span>Racing</span></a><p>A 24 Hours of Lemons endurance team. Built in a garage, raced on real tracks.</p></div><div><h4>Site</h4>${NAV.slice(1).map(([, v, h]) => `<a href="${h}">${v}</a>`).join("")}</div><div><h4>Data</h4><a href="https://24hoursoflemons.com/standings" target="_blank" rel="noopener">Lemons standings ↗</a><a href="https://speedhive.mylaps.com/Organizations/145414" target="_blank" rel="noopener">Official timing ↗</a></div></div><div class="wrap legal">© ${new Date().getFullYear()} Half Fast Racing. An independent team site, not run by 24 Hours of Lemons. <span class="built">Built by <a href="https://local.apexoutreach.app" target="_blank" rel="noopener">Apex Outreach Local</a></span></div></footer>`;

function shell(S, active, title, body, extra = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${e(title)}</title><meta name="description" content="Half Fast Racing: a 24 Hours of Lemons endurance team, racing $500 cars for more than ten years.">
${S.content.launched ? "" : '<meta name="robots" content="noindex">'}<meta name="theme-color" content="#0d1420"><link rel="icon" href="/logo.webp">
<link rel="preload" href="/fonts/barlow-condensed-latin-900-italic.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/style.css"></head>
<body>${header(active)}<main>${body}</main>${footer()}<script src="/site.js" defer></script>${extra}</body></html>`;
}

function standing(S) {
  const st = S.standings; const nat = st.national || []; const i = nat.findIndex(([t]) => t === st.team);
  return { st, nat, rank: i >= 0 ? i + 1 : null, points: i >= 0 ? nat[i][1] : null, gap: i > 0 ? nat[0][1] - nat[i][1] : 0 };
}
function nextRace(S, today) {
  return (S.schedule || []).filter((r) => r.racing && r.end >= today).sort((a, b) => a.start.localeCompare(b.start))[0] || null;
}
const fmtRange = (r) => { const a = day(r.start), b = day(r.end); return `${a}–${b.split(" ")[0] === a.split(" ")[0] ? b.split(" ")[1] : b}, ${r.start.slice(0, 4)}`; };

function home(S, ctx) {
  const { YL, CUR, cur, A } = ctx; const C = S.content; const { st, nat, rank, points, gap } = standing(S);
  const last = cur[0]; const [ln, lc] = last ? lead(last)[0] : ["", null]; const nx = nextRace(S, ctx.today);
  const h = lines(C.headline); const lastWord = h[h.length - 1].split(" "); const hl = lastWord.pop();
  h[h.length - 1] = `${lastWord.join(" ")} <span>${hl}</span>`;
  const rankLine = rank ? ` ${rank === 1 ? "Leading" : ["", "", "Second", "Third"][rank] || `P${rank}`} ${rank === 1 ? "the" : "in the"} national points right now${gap ? `, ${gap} off the lead` : ""}.` : "";
  const tower = nat.length ? `<aside class="tower" aria-label="National team points"><div class="th"><span>National points · Teams</span><span>${e(st.season)}</span></div>${nat.slice(0, 5).map(([t, p], i) => `<div class="trow${t === st.team ? " us" : ""}"><b>${i + 1}</b><span>${e(t)}</span><i>${p}</i></div>`).join("")}${(st.conferences || []).length ? `<div class="conf">${st.conferences.map((c) => `<div><b>P${c.rank}</b><span>${e(c.name)} · ${c.points} pts</span></div>`).join("")}</div>` : ""}<div class="tf">Official standings, 24hoursoflemons.com. Checked ${day(st.checkedAt)}, ${st.checkedAt.slice(0, 4)}.</div></aside>` : "";
  const others = last ? lead(last).slice(1) : [];
  const note = last ? (last.note ? e(last.note) : `P${lc.pos} overall${lc.pic ? ` and P${lc.pic} in Class ${e(lc.cls)}` : ""}, with ${lc.laps} laps.${others.length ? " " + others.map(([m, x]) => `Car #${e(m)} finished P${x.pos}`).join(", ") + "." : ""}`) : "";
  const fourCars = Object.keys(S.cars).filter((id) => isActive(S, id)).sort(byName(S)).slice(0, 4).map((id) => carcard(S, id, "home")).join("");
  return `<section class="hero"><div class="wrap">${ln ? `<div class="ghost" aria-hidden="true">${e(ln)}</div>` : ""}<div class="herogrid"><div><p class="kicker">${e(C.kicker)}</p><h1>${h.join("<br>")}</h1><p class="lede">${e(C.lede)}${rankLine}</p><div class="btns"><a class="btn" href="/results">See the results <span>→</span></a><a class="btn alt" href="/cars">Meet the cars</a></div></div><img class="sticker" src="/logo.webp" width="1237" height="688" alt="Half Fast Racing team logo"></div></div>
<div class="wrap"><div class="statbar">${rank ? stat("P" + rank, "National points", true) + stat(points, "Points") : ""}${stat(A.races, "Race weekends " + CUR)}${stat(A.best ? "P" + A.best : "–", "Best finish")}${stat(num(A.laps), "Laps completed")}</div></div></section>
${nx ? `<section class="wrap"><div class="nextrace"><div><p class="kicker">Next green flag</p><h2>${e(nx.name)}</h2><p class="where">${e(nx.loc)} · ${fmtRange(nx)}${(nx.cars || []).length ? " · " + nx.cars.map((c) => (S.cars[c] ? e(S.cars[c].name) : "#" + e(c))).join(", ") : ""}</p></div><div class="clock" data-t="${nx.start}T09:00:00-05:00"><div><b>--</b><span>Days</span></div><div><b>--</b><span>Hrs</span></div><div><b>--</b><span>Min</span></div></div></div></section>` : ""}
${last ? `<section class="wrap two"><div><p class="kicker">Latest result</p><article class="latest"><div class="bigp">P${lc.pos}<small>of ${last.of}</small></div><div><h3>${e(last.race)}</h3><p class="where">${e(last.track)} · ${day(last.date)}, ${last.date.slice(0, 4)} · Car #${e(ln)}</p><dl class="mini">${lc.pic ? `<div><dt>Class ${e(lc.cls)}</dt><dd>P${lc.pic}</dd></div>` : ""}<div><dt>Laps</dt><dd>${lc.laps}</dd></div><div><dt>Best lap</dt><dd>${e(lc.best)}</dd></div></dl><p class="note">${note}</p></div></article></div><div><p class="kicker">Championship</p>${tower}</div></section>
<section class="wrap"><div class="sechead"><div><p class="kicker">Season ${CUR}</p><h2>Recent races</h2></div><a class="more" href="/results">All results →</a></div>${table(cur, 5)}</section>` : ""}
${fourCars ? `<section class="wrap"><div class="sechead"><div><p class="kicker">The fleet</p><h2>Cheap cars, raced hard</h2></div><a class="more" href="/cars">All cars →</a></div><div class="fleet">${fourCars}</div></section>` : ""}
<section class="paper"><div class="wrap papergrid"><div><p class="kicker dark">How Lemons works</p><h2>The car can't cost more than $500</h2><p>That's the rule. Safety gear doesn't count, and the judges decide if you're telling the truth.</p></div><div class="receipt" aria-hidden="true"><div class="rh">HALF FAST RACING<br>CAR #${e(ln || "42")} · BUDGET</div><div><span>1 × race car, pre-loved</span><span>$???</span></div><div><span>Junkyard parts</span><span>$???</span></div><div><span>Zip ties (qty: yes)</span><span>$???</span></div><div><span>Sold: original seats</span><span>−$??</span></div><div class="tot"><span>LEMONS LIMIT</span><span>$500.00</span></div><div class="rf">*** THANK YOU, COME AGAIN ***</div></div></div></section>`;
}

function results(S, ctx, y) {
  const { YL, CUR, ALL } = ctx; const isCur = y === CUR; const evl = S.seasons[y]; const a = agg(evl);
  const tabs = `<nav class="tabs" aria-label="Seasons">${YL.map((yy) => `<a class="${yy === y ? "on" : ""}" href="${yy === CUR ? "/results" : "/results/" + yy}">${yy}</a>`).join("")}</nav>`;
  const head = isCur
    ? `<section class="pagehead"><div class="wrap"><p class="kicker">Results</p><h1>Every lap counted</h1><p class="lede">All-time numbers since ${YL[YL.length - 1]}, straight from official Lemons timing.</p></div><div class="wrap"><div class="statbar six">${stat(ALL.races, "Race weekends")}${stat("P" + ALL.best, "Best finish", true)}${stat(ALL.top5, "Top-five finishes")}${stat(ALL.top10, "Top-ten finishes")}${stat(ALL.clspod, "Class podiums")}${stat(num(ALL.laps), "Laps completed")}</div></div></section>`
    : `<section class="pagehead"><div class="wrap"><p class="kicker">Results</p><h1>${y} season</h1></div></section>`;
  const reports = evl.filter((ev) => ev.report).map((ev) => `<article class="report"><p class="kicker">${day(ev.date)} · ${e(ev.track)}</p><h3>${e(ev.race)}</h3>${paras(ev.report)}</article>`).join("");
  return `${head}<section class="wrap">${tabs}<div class="yearsum"><h2>${y}</h2><div class="ys">${stat(a.races, "Races")}${stat("P" + a.best, "Best")}${stat(a.top5, "Top fives")}${stat(num(a.laps), "Laps")}</div></div>${table(evl)}<p class="src">Official timing from MyLaps Speedhive. A top-five overall finish is marked in yellow.</p></section>${reports ? `<section class="wrap"><div class="sechead"><div><p class="kicker">From the paddock</p><h2>Race reports</h2></div></div><div class="reports">${reports}</div></section>` : ""}`;
}

function cars(S) {
  const all = Object.keys(S.cars).sort(byName(S)); const active = all.filter((id) => isActive(S, id)); const retired = all.filter((id) => !isActive(S, id));
  if (!all.length) return `<section class="pagehead"><div class="wrap"><p class="kicker">The fleet</p><h1>Cheap cars, raced hard</h1><p class="lede">The garage is being catalogued. Every result is on the <a href="/results" style="color:var(--lemon)">Results page</a> in the meantime.</p></div></section>`;
  const jump = all.length > 3 ? `<nav class="carnav" aria-label="Cars">${active.map((id) => `<a href="#car-${e(id)}">${e(S.cars[id].name)}</a>`).join("")}${retired.length ? `<a class="ret" href="#retired">Retired (${retired.length})</a>` : ""}</nav>` : "";
  return `<section class="pagehead"><div class="wrap"><p class="kicker">The fleet</p><h1>Cheap cars, raced hard</h1><p class="lede">${active.length} car${active.length === 1 ? "" : "s"} in the garage${retired.length ? `, ${retired.length} retired` : ""}. For how they did, see the <a href="/results" style="color:var(--lemon)">results</a>.</p>${jump}</div></section>
${active.length ? `<section class="wrap"><div class="fleet big">${active.map((id) => carcard(S, id, "full")).join("")}</div></section>` : ""}
${retired.length ? `<section class="wrap" id="retired"><div class="sechead"><div><p class="kicker">No longer with us</p><h2>Retired cars</h2></div></div><div class="fleet">${retired.map((id) => carcard(S, id, "full")).join("")}</div></section>` : ""}`;
}

function about(S, ctx) {
  const { CUR, A, ALL } = ctx; const garage = Object.keys(S.cars).filter((id) => isActive(S, id)).length; const C = S.content; const { rank } = standing(S);
  const story = C.story ? paras(C.story) : `<p>Lemons is endurance racing for cars nobody else wanted. You buy one for $500 or less, bolt in a roll cage, and try to keep it running for two days. Finishing is an achievement. Finishing well is suspicious.</p><p>In ${CUR} we ran ${A.races} race weekends.</p>`;
  const facts = [["Series", "24 Hours of Lemons"], ["Racing since", C.since], ["Race weekends on record", ALL.races], garage ? ["Cars in the garage", garage] : null, rank ? ["National points", "P" + rank] : null, C.homeBase ? ["Home base", C.homeBase] : null].filter(Boolean);
  const owners = (S.owners || []).map((o) => `<article class="person">${o.photo ? img(o.photo, o.name, "sq") : slot("Photo coming", "sq")}<p class="role">${e(o.title || (o.car ? `Car #${o.car}` : o.role === "carowner" ? "Car owner" : "Team"))}</p><h3>${e(o.name)}</h3>${o.bio ? `<p class="tbd">${e(o.bio)}</p>` : ""}</article>`).join("");
  return `<section class="pagehead"><div class="wrap"><p class="kicker">About the team</p><h1>${lines(C.aboutHeadline).join("<br>")}</h1><p class="lede">${e(C.aboutLede)}</p></div></section>
<section class="wrap story"><div><h2>The short version</h2>${story}</div><dl class="facts">${facts.map(([k, v]) => `<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join("")}</dl></section>
${owners ? `<section class="wrap"><div class="sechead"><div><p class="kicker">Who runs it</p><h2>Owners</h2></div></div><div class="people">${owners}</div></section>` : ""}`;
}

function gallery(S, ctx) {
  const C = S.content; const byRace = new Map();
  for (const p of S.photos || []) { const k = p.race || "Paddock"; if (!byRace.has(k)) byRace.set(k, []); byRace.get(k).push(p); }
  const groups = [...byRace].map(([race, ps]) => `<div class="gal"><h3>${e(race)}</h3><div class="galgrid">${ps.map((p) => `<a href="${e(p.url)}" target="_blank" rel="noopener">${img(p.url, p.caption || race)}</a>`).join("")}</div></div>`).join("");
  const ig = (S.instagramPosts || []).map((u) => `<blockquote class="instagram-media" data-instgrm-permalink="${e(u)}" data-instgrm-version="14"><a href="${e(u)}">View this post on Instagram</a></blockquote>`).join("");
  const empty = !groups && !ig ? `<p class="lede">Photos are on their way. Until then, the team posts on Instagram.</p>` : "";
  return { extra: ig ? '<script async src="https://www.instagram.com/embed.js"></script>' : "",
    body: `<section class="pagehead"><div class="wrap"><p class="kicker">Gallery</p><h1>From the paddock</h1><p class="lede">Photos from the crew, sorted by race.</p>${C.instagram ? `<p style="margin-top:22px"><a class="btn alt" href="https://www.instagram.com/${e(C.instagram)}" target="_blank" rel="noopener">Follow @${e(C.instagram)} on Instagram ↗</a></p>` : ""}</div></section><section class="wrap">${empty}${groups}${ig ? `<div class="gal"><h3>On Instagram</h3><div class="iggrid">${ig}</div></div>` : ""}</section>` };
}

/** path → { status, html } */
function renderPage(S, path, today) {
  const YL = Object.keys(S.seasons).filter((y) => (S.seasons[y] || []).length).sort().reverse();
  const CUR = YL[0]; const cur = CUR ? S.seasons[CUR] : [];
  const everything = YL.flatMap((y) => S.seasons[y]);
  const ctx = { YL, CUR, cur, today, A: agg(cur), ALL: agg(everything) };
  const p = path.replace(/\/+$/, "") || "/";
  if (p === "/") return { status: 200, html: shell(S, "home", "Half Fast Racing · 24 Hours of Lemons team", home(S, ctx)) };
  if (p === "/results" && CUR) return { status: 200, html: shell(S, "results", "Results · Half Fast Racing", results(S, ctx, CUR)) };
  const m = p.match(/^\/results\/(\d{4})$/);
  if (m && YL.includes(m[1])) return { status: 200, html: shell(S, "results", `${m[1]} results · Half Fast Racing`, results(S, ctx, m[1])) };
  if (p === "/cars") return { status: 200, html: shell(S, "cars", "The cars · Half Fast Racing", cars(S, ctx)) };
  if (p === "/about") return { status: 200, html: shell(S, "about", "About the team · Half Fast Racing", about(S, ctx)) };
  if (p === "/gallery") { const g = gallery(S, ctx); return { status: 200, html: shell(S, "gallery", "Gallery · Half Fast Racing", g.body, g.extra) }; }
  return { status: 404, html: shell(S, "", "Not found · Half Fast Racing", `<section class="pagehead"><div class="wrap"><p class="kicker">404</p><h1>Off track</h1><p class="lede">That page isn't here. <a href="/" style="color:var(--lemon)">Back to the pits →</a></p></div></section>`) };
}
module.exports = { renderPage, agg, nextRace, isActive };
