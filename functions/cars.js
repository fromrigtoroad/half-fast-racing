// A car is a named thing; its race number can change from race to race, and two cars can share a number at different races.
// This file decides which car a result belongs to. It is used by the server (render.js) and bundled into the admin.

/** Firestore car docs → { id: car }. Older docs were keyed by race number and had no `numbers` list; they keep working. */
function normalizeCars(docs) {
  const out = {};
  for (const [id, d] of Object.entries(docs || {})) {
    const numbers = Array.isArray(d.numbers) ? d.numbers.map((n) => String(n).trim().replace(/^#/, "")).filter(Boolean) : (/^[A-Za-z0-9]{1,6}$/.test(id) ? [id] : []);
    out[id] = { ...d, id, numbers, name: String(d.name || "").trim() || (numbers[0] ? `#${numbers[0]}` : "Unnamed car") };
  }
  return out;
}

/**
 * → { who(ev, number): carId | null, why(ev, number): "picked" | "auto" | "ambiguous" | "unclaimed" | "none" }
 * 1. A pick made in the admin for that race wins (ev.assign[number] = carId, or "" for "not one of our named cars").
 * 2. Otherwise the one car that lists the number as a usual number.
 * 3. If several cars list it, nobody gets the result until an admin picks.
 */
function resolver(cars) {
  const byNumber = {};
  for (const c of Object.values(cars)) for (const n of c.numbers) (byNumber[n] ??= []).push(c.id);
  const why = (ev, n) => {
    const a = ev.assign && Object.prototype.hasOwnProperty.call(ev.assign, n) ? ev.assign[n] : undefined;
    if (a !== undefined) return a && cars[a] ? "picked" : a === "" ? "none" : (byNumber[n] || []).length === 1 ? "auto" : (byNumber[n] || []).length ? "ambiguous" : "unclaimed";
    const c = byNumber[n] || []; return c.length === 1 ? "auto" : c.length ? "ambiguous" : "unclaimed";
  };
  const who = (ev, n) => { const w = why(ev, n); return w === "picked" ? ev.assign[n] : w === "auto" ? byNumber[n][0] : null; };
  return { who, why, candidates: (n) => byNumber[n] || [] };
}
module.exports = { normalizeCars, resolver };
