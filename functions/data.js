// Reads the site's state from Firestore and fills any gap from seed.json, so a page never renders blank.
const seed = require("./seed.json");
let cache = null; let cacheAt = 0;
const TTL_MS = 30_000;

/** Pure merge, exported for tests. `docs` is what Firestore returned (missing docs are undefined / empty). */
function mergeState(docs) {
  const S = JSON.parse(JSON.stringify(seed));
  if (docs.content) S.content = { ...S.content, ...docs.content };
  if (docs.standings && Array.isArray(docs.standings.national) && docs.standings.national.length) {
    // Firestore can't store arrays of arrays, so rows are {team, points} there.
    S.standings = { ...S.standings, ...docs.standings, national: docs.standings.national.map((r) => (Array.isArray(r) ? r : [r.team, r.points])) };
  }
  if (docs.schedule && Array.isArray(docs.schedule.races) && docs.schedule.races.length) S.schedule = docs.schedule.races;
  if (docs.gallery && Array.isArray(docs.gallery.instagramPosts)) S.instagramPosts = docs.gallery.instagramPosts;
  for (const [year, d] of Object.entries(docs.seasons || {})) if (Array.isArray(d.events) && d.events.length) S.seasons[year] = d.events;
  S.cars = docs.cars || {};
  S.owners = (docs.people || []).filter((p) => p.showOnAbout && (p.role === "owner" || p.role === "carowner"))
    .sort((a, b) => (a.role === "owner" ? -1 : 0) - (b.role === "owner" ? -1 : 0) || String(a.car || "").localeCompare(String(b.car || ""), "en", { numeric: true }));
  S.photos = (docs.photos || []).filter((p) => p.status === "published").sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  return S;
}

async function loadState(db, { fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cacheAt < TTL_MS) return cache;
  const [site, seasons, cars, people, photos] = await Promise.all([
    db.collection("site").get(), db.collection("seasons").get(), db.collection("cars").get(), db.collection("people").get(),
    db.collection("photos").where("status", "==", "published").limit(300).get(),
  ]);
  const byId = (snap) => Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
  const s = byId(site);
  cache = mergeState({ content: s.content, standings: s.standings, schedule: s.schedule, gallery: s.gallery, seasons: byId(seasons), cars: byId(cars),
    people: people.docs.map((d) => ({ uid: d.id, ...d.data() })), photos: photos.docs.map((d) => ({ id: d.id, ...d.data() })) });
  cacheAt = Date.now();
  return cache;
}
module.exports = { loadState, mergeState, seed };
