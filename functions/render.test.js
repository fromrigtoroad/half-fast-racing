const test = require("node:test"); const assert = require("node:assert/strict");
const { renderPage, nextRace } = require("./render"); const { mergeState, seed } = require("./data");

test("every public page renders from the seed alone", () => {
  const S = mergeState({});
  for (const p of ["/", "/results", "/results/2023", "/cars", "/about", "/gallery"]) assert.equal(renderPage(S, p, "2026-11-24").status, 200, p);
  assert.equal(renderPage(S, "/results/1999", "2026-11-24").status, 404);
  assert.equal(renderPage(S, "/admin/x", "2026-11-24").status, 404);
});
test("text typed in the admin is escaped", () => {
  const S = mergeState({ content: { lede: '<script>alert(1)</script>', story: "<img src=x onerror=alert(1)>" }, cars: { 42: { make: "<b>x</b>" } } });
  for (const p of ["/", "/about", "/cars"]) { const h = renderPage(S, p, "2026-11-24").html; assert.ok(!h.includes("<script>alert"), p); assert.ok(!h.includes("<img src=x"), p); assert.ok(!h.includes("<b>x</b>"), p); }
});
test("the next race is the first switched-on race that hasn't ended", () => {
  const S = mergeState({ schedule: { races: [{ name: "Past", start: "2026-01-01", end: "2026-01-02", racing: true }, { name: "Skip", start: "2026-12-01", end: "2026-12-02", racing: false }, { name: "Later", start: "2027-03-01", end: "2027-03-02", racing: true }, { name: "Soon", start: "2026-12-12", end: "2026-12-13", racing: true }] } });
  assert.equal(nextRace(S, "2026-11-24").name, "Soon"); assert.equal(nextRace(S, "2026-12-13").name, "Soon"); assert.equal(nextRace(S, "2026-12-14").name, "Later");
  assert.ok(!renderPage(mergeState({ schedule: { races: [{ name: "Past", start: "2026-01-01", end: "2026-01-02", racing: true }] } }), "/", "2026-11-24").html.includes("Next green flag"));
});
test("only published photos and people ticked for the About page reach the site; the site isn't indexed until launch", () => {
  const S = mergeState({ photos: [{ url: "https://x/a.jpg", status: "new", race: "R" }, { url: "https://x/b.jpg", status: "published", race: "R" }], people: [{ name: "Owner A", role: "owner", showOnAbout: true }, { name: "Hidden B", role: "carowner", showOnAbout: false }, { name: "Member C", role: "member", showOnAbout: true }] });
  const g = renderPage(S, "/gallery", "2026-11-24").html; assert.ok(g.includes("b.jpg") && !g.includes("a.jpg"));
  const a = renderPage(S, "/about", "2026-11-24").html; assert.ok(a.includes("Owner A") && !a.includes("Hidden B") && a.includes("Member C"), "whoever a site admin ticks is shown, whatever their role");
  assert.ok(a.includes('content="noindex"')); assert.ok(!renderPage(mergeState({ content: { launched: true } }), "/", "2026-11-24").html.includes("noindex"));
});
test("a season saved in the database replaces the seed's, others stay", () => {
  const S = mergeState({ seasons: { 2026: { events: [seed.seasons["2026"][0]] } } });
  assert.equal(S.seasons["2026"].length, 1); assert.equal(S.seasons["2025"].length, seed.seasons["2025"].length);
});
test("cars: named, inactive ones are retired, new ones show before racing, home shows only active", () => {
  const S = mergeState({ cars: { 42: { name: "Lemon Drop", make: "Mazda", model: "Miata" }, 220: { active: false }, 777: { name: "New Build" } } });
  const c = renderPage(S, "/cars", "2026-11-24").html;
  assert.ok(c.includes("Lemon Drop") && c.includes("Mazda Miata")); assert.ok(/id="retired"[\s\S]*id="car-220"/.test(c)); assert.ok(!/id="car-220"[\s\S]*id="retired"/.test(c));
  assert.ok(c.includes('href="#car-777"') && c.includes("Hasn't raced yet")); assert.ok(c.includes("Last raced Nov 7, 2026"));
  assert.ok(!renderPage(S, "/", "2026-11-24").html.includes('id="car-220"'), "a retired car is not on the home page");
});
test("the gallery never shows more than 20 photos", () => {
  const photos = Array.from({ length: 30 }, (_, i) => ({ url: `https://x/${i}.jpg`, status: "published", race: "R", at: `2026-01-01T00:00:${String(i).padStart(2, "0")}Z` }));
  assert.equal((renderPage(mergeState({ photos }), "/gallery", "2026-11-24").html.match(/class="ph /g) || []).length, 20);
});
test("a car that ran in two classes shows both, and each result line names its class", () => {
  const S = mergeState({ cars: { 42: {} } }); const ev = S.seasons["2026"]; ev[0].cars["42"].cls = "A"; ev[1].cars["42"].cls = "B";
  const c = renderPage(S, "/cars", "2026-11-24").html; const card = c.slice(c.indexOf('id="car-42"'), c.indexOf("</article>", c.indexOf('id="car-42"')));
  assert.ok(card.includes("Classes A, B")); assert.ok(card.includes("· Class A</span>") && card.includes("· Class B</span>"));
  assert.ok(c.includes('href="https://local.apexoutreach.app"'));
});
test("cars are named things: one car, several numbers; a shared number waits for an admin's pick", () => {
  const { resolver, normalizeCars } = require("./cars");
  const cars = { lemon: { name: "Lemon Drop", numbers: ["42", "48", "92"] }, bug: { name: "The Bug", numbers: ["222", "92"] } };
  const S = mergeState({ cars }); const { who, why } = resolver(normalizeCars(cars));
  const cmp = S.seasons["2026"].find((ev) => ev.cars["92"]); const hou = S.seasons["2026"].find((ev) => ev.cars["42"]);
  assert.equal(who(hou, "42"), "lemon"); assert.equal(why(cmp, "92"), "ambiguous"); assert.equal(who(cmp, "92"), null); assert.equal(why(hou, "17"), "unclaimed");
  let c = renderPage(S, "/cars", "2026-11-24").html; const card = () => c.slice(c.indexOf('id="car-lemon"'), c.indexOf("</article>", c.indexOf('id="car-lemon"')));
  const startsBefore = Number(/Starts 2026<\/dt><dd>(\d+)/.exec(card())[1]);
  assert.ok(!c.includes('id="car-17"') && !c.includes('id="car-404"'), "numbers nobody claimed get no card");
  for (const ev of S.seasons["2026"]) if (ev.cars["92"]) ev.assign = { 92: "lemon" };
  c = renderPage(S, "/cars", "2026-11-24").html;
  assert.equal(Number(/Starts 2026<\/dt><dd>(\d+)/.exec(card())[1]), startsBefore + 2, "the two #92 races now count for Lemon Drop");
  assert.ok(card().includes("Also raced as") && card().includes("#92"));
  const r = renderPage(S, "/results", "2026-11-24").html; assert.ok(r.includes("#42<small>Lemon Drop</small>")); assert.ok(r.includes(">#17 <i>P48</i>"), "unclaimed numbers still show in results");
  cmp.assign = { 92: "" }; assert.equal(resolver(S.cars).who(cmp, "92"), null); assert.equal(resolver(S.cars).why(cmp, "92"), "none");
});
test("with no cars set up, the cars page says so and nothing breaks", () => {
  const S = mergeState({}); assert.ok(renderPage(S, "/cars", "2026-11-24").html.includes("being catalogued"));
  for (const p of ["/", "/results", "/about"]) assert.equal(renderPage(S, p, "2026-11-24").status, 200);
});
