// A car is a named thing on the Cars page: a showcase, not a stats table. The race record lives on the Results page,
// by number, straight from official timing. Used by the server (data.js) and bundled into the admin.

/** Firestore car docs → { id: car }. Docs from earlier versions (keyed by race number, or with a `numbers` list) keep working. */
function normalizeCars(docs) {
  const out = {};
  for (const [id, d] of Object.entries(docs || {})) {
    const legacy = Array.isArray(d.numbers) && d.numbers.length ? d.numbers.join(", ") : (/^\d{1,4}$/.test(id) ? id : "");
    const number = String(d.number ?? legacy).trim().replace(/^#/, "");
    out[id] = { ...d, id, number, name: String(d.name || "").trim() || (number ? `#${number}` : "Unnamed car") };
  }
  return out;
}
module.exports = { normalizeCars };
