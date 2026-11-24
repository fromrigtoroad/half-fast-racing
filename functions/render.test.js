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
test("the gallery never shows more than 20 photos", () => {
  const photos = Array.from({ length: 30 }, (_, i) => ({ url: `https://x/${i}.jpg`, status: "published", race: "R", at: `2026-01-01T00:00:${String(i).padStart(2, "0")}Z` }));
  assert.equal((renderPage(mergeState({ photos }), "/gallery", "2026-11-24").html.match(/class="ph /g) || []).length, 20);
});
test("cars are a showcase: name, make, story, number as typed; inactive ones are retired; no stats", () => {
  const S = mergeState({ cars: { a1: { name: "Lemon Drop", number: "42", make: "Mazda", model: "Miata", story: "Bought for $400.\n\nStill runs." }, b2: { name: "The Bug", number: "222 or 92", active: false }, c3: { name: "New Build" } } });
  const c = renderPage(S, "/cars", "2026-11-24").html; const card = (id) => c.slice(c.indexOf(`id="car-${id}"`), c.indexOf("</article>", c.indexOf(`id="car-${id}"`)));
  assert.ok(card("a1").includes('<div class="num">42</div>') && card("a1").includes("Lemon Drop") && card("a1").includes("Mazda Miata") && card("a1").includes("<p>Still runs.</p>"));
  assert.ok(/id="retired"[\s\S]*id="car-b2"/.test(c) && card("b2").includes("Races as 222 or 92") && card("b2").includes("Retired"));
  assert.ok(card("c3").includes("New Build")); assert.ok(!/Starts|Best<\/dt>|Last raced/.test(c), "no per-car stats");
  const h = renderPage(S, "/", "2026-11-24").html; assert.ok(h.includes('id="car-a1"') && !h.includes('id="car-b2"'), "home shows active cars only");
  assert.ok(renderPage(S, "/results", "2026-11-24").html.includes(">#42</td>"), "results stay by number");
  assert.ok(c.includes('href="https://local.apexoutreach.app"'));
});
test("car records from earlier versions still show", () => {
  const S = mergeState({ cars: { 42: { name: "Old Style" }, x9: { name: "Listed", numbers: ["42", "48"] }, 777: {} } });
  assert.equal(S.cars["42"].number, "42"); assert.equal(S.cars.x9.number, "42, 48"); assert.equal(S.cars["777"].name, "#777");
  assert.equal(renderPage(S, "/cars", "2026-11-24").status, 200);
});
test("with no cars set up, the cars page says so and nothing breaks", () => {
  const S = mergeState({}); assert.ok(renderPage(S, "/cars", "2026-11-24").html.includes("being catalogued"));
  for (const p of ["/", "/results", "/about"]) assert.equal(renderPage(S, p, "2026-11-24").status, 200);
});
