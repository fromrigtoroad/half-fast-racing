const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const crypto = require("node:crypto");
const { renderPage } = require("./render");
const { loadState, seed } = require("./data");

admin.initializeApp();
setGlobalOptions({ region: "us-east1", maxInstances: 5, memory: "256MiB" });
const db = admin.firestore();
const ROLES = ["owner", "carowner", "member"];
const todayET = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

// Every public page. Firebase Hosting sends anything that isn't a static file here.
exports.site = onRequest(async (req, res) => {
  let state;
  try { state = await loadState(db, { fresh: "fresh" in req.query }); }
  catch (err) { console.error("loadState failed, serving seed", err); state = { ...seed, owners: [], photos: [], cars: {} }; }
  const page = renderPage(state, req.path, todayET());
  res.status(page.status).set("Cache-Control", page.status === 200 && !("fresh" in req.query) ? "public, max-age=60, s-maxage=120" : "no-store").type("html").send(page.html);
});

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
async function caller(req) {
  const m = /^Bearer (.+)$/.exec(req.get("authorization") || "");
  if (!m) throw new HttpError(401, "Sign in first.");
  try { return await admin.auth().verifyIdToken(m[1], true); } catch { throw new HttpError(401, "Your sign-in has expired. Sign in again."); }
}
const clean = (s, max) => String(s ?? "").trim().slice(0, max);

// Owner-only account management. Everything else the admin does goes straight to Firestore under the security rules.
exports.api = onRequest(async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const me = await caller(req);
    const route = req.path.replace(/^\/api/, "");
    if (!ROLES.includes(me.role)) throw new HttpError(403, "Your account has no access yet. Ask the team owner.");
    // What the admin screens start from: the same merged state the public pages render, plus drafts.
    if (route === "/state" && req.method === "GET") return res.json(await loadState(db, { fresh: true }));
    if (req.method !== "POST") throw new HttpError(405, "POST only");
    if (me.role !== "owner") throw new HttpError(403, "Only the team owner can manage people.");
    const b = req.body || {};
    if (route === "/invite") {
      const email = clean(b.email, 200).toLowerCase(); const name = clean(b.name, 80); const role = b.role; const car = clean(b.car, 6);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "That email doesn't look right.");
      if (!name) throw new HttpError(400, "Add their name.");
      if (!ROLES.includes(role)) throw new HttpError(400, "Pick a role.");
      let user;
      try { user = await admin.auth().createUser({ email, displayName: name, password: crypto.randomBytes(24).toString("base64url") }); }
      catch (err) { if (err.code === "auth/email-already-exists") throw new HttpError(409, "Someone with that email already has a login."); throw err; }
      await admin.auth().setCustomUserClaims(user.uid, { role, car: role === "carowner" ? car : "" });
      await db.collection("people").doc(user.uid).set({ name, email, role, car: role === "carowner" ? car : "", bio: "", photo: "", title: "", showOnAbout: role !== "member", invitedAt: new Date().toISOString() });
      return res.json({ ok: true, uid: user.uid });
    }
    if (route === "/role") {
      const uid = clean(b.uid, 128); const role = b.role; const car = clean(b.car, 6);
      if (!ROLES.includes(role)) throw new HttpError(400, "Pick a role.");
      if (uid === me.uid && role !== "owner") throw new HttpError(400, "You can't remove your own owner role.");
      await admin.auth().setCustomUserClaims(uid, { role, car: role === "carowner" ? car : "" });
      await admin.auth().revokeRefreshTokens(uid);
      await db.collection("people").doc(uid).set({ role, car: role === "carowner" ? car : "" }, { merge: true });
      return res.json({ ok: true });
    }
    if (route === "/remove") {
      const uid = clean(b.uid, 128);
      if (uid === me.uid) throw new HttpError(400, "You can't remove yourself.");
      await admin.auth().deleteUser(uid).catch((err) => { if (err.code !== "auth/user-not-found") throw err; });
      await db.collection("people").doc(uid).delete();
      return res.json({ ok: true });
    }
    throw new HttpError(404, "Unknown action");
  } catch (err) {
    if (!(err instanceof HttpError)) console.error(err);
    res.status(err.status || 500).json({ error: err instanceof HttpError ? err.message : "Something went wrong on our side." });
  }
});
