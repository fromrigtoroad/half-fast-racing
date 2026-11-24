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
test("only published photos and listed owners reach the site; the site isn't indexed until launch", () => {
  const S = mergeState({ photos: [{ url: "https://x/a.jpg", status: "new", race: "R" }, { url: "https://x/b.jpg", status: "published", race: "R" }], people: [{ name: "Owner A", role: "owner", showOnAbout: true }, { name: "Hidden B", role: "carowner", showOnAbout: false }, { name: "Member C", role: "member", showOnAbout: true }] });
  const g = renderPage(S, "/gallery", "2026-11-24").html; assert.ok(g.includes("b.jpg") && !g.includes("a.jpg"));
  const a = renderPage(S, "/about", "2026-11-24").html; assert.ok(a.includes("Owner A") && !a.includes("Hidden B") && !a.includes("Member C"));
  assert.ok(a.includes('content="noindex"')); assert.ok(!renderPage(mergeState({ content: { launched: true } }), "/", "2026-11-24").html.includes("noindex"));
});
test("a season saved in the database replaces the seed's, others stay", () => {
  const S = mergeState({ seasons: { 2026: { events: [seed.seasons["2026"][0]] } } });
  assert.equal(S.seasons["2026"].length, 1); assert.equal(S.seasons["2025"].length, seed.seasons["2025"].length);
});
