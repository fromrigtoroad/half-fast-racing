// Phone-width check of every admin tab against the local emulators (writes screenshots to OUT):
//   OUT=/some/dir npx firebase emulators:exec --project demo-hfr "node tools/phone-shots.js"
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099"; process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
const admin = require("../functions/node_modules/firebase-admin"); const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:5000"; const PW = "emulator-only-" + Math.random().toString(36).slice(2); const OUT = process.env.OUT || "/tmp"; const TAG = process.env.TAG || "shot";
(async () => {
  admin.initializeApp({ projectId: "demo-hfr" });
  const email = `owner${Date.now()}@example.test`; const u = await admin.auth().createUser({ email, password: PW, displayName: "Test Owner" });
  await admin.auth().setCustomUserClaims(u.uid, { role: "owner", car: "" });
  await admin.firestore().collection("people").doc(u.uid).set({ name: "Test Owner", email, role: "owner", car: "", bio: "", photo: "", title: "", showOnAbout: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: Number(process.env.W || 390), height: 844 } }); const errors = []; p.on("pageerror", (e) => errors.push(String(e)));
  // /api goes straight to the functions emulator (in a sandbox where the hosting emulator's rewrite can't reach it).
  await p.route("**/api/**", async (r) => { const u = new URL(r.request().url()); r.continue({ url: "http://127.0.0.1:5001/demo-hfr/us-east1/api" + u.pathname.replace(/^\/api/, "") + u.search }); });
  await p.goto(BASE + "/admin"); await p.fill("input[type=email]", email); await p.fill("input[type=password]", PW); await p.click("button[type=submit]"); await p.waitForSelector(".amain h1", { timeout: 120000 }).catch(async (e) => { console.log("boot text:", await p.textContent("#app")); throw e; });
  await p.screenshot({ path: `${OUT}/${TAG}-0top.png` });
  const names = await p.$$eval(".aside nav button", (bs) => bs.map((x) => x.textContent));
  for (const [i, n] of names.entries()) {
    const menu = await p.$('.menubtn'); if (menu && await menu.isVisible()) { await menu.click(); await p.waitForTimeout(250); if (i === 0) await p.screenshot({ path: `${OUT}/${TAG}-0menu.png` }); }
    await p.click(`.aside nav button:has-text("${n}")`); await p.waitForFunction((x) => document.querySelector(".amain h1")?.textContent === x, n); await p.waitForTimeout(500);
    const r = await p.evaluate(() => { const W = document.documentElement.clientWidth; const out = [];
      for (const e of document.querySelectorAll(".amain *")) { const rc = e.getBoundingClientRect(); if (!rc.width || rc.right <= W + 1) continue;
        let a = e.parentElement, s = false; while (a) { const o = getComputedStyle(a).overflowX; if ((o === "auto" || o === "scroll") && a.getBoundingClientRect().right <= W + 1) { s = true; break; } a = a.parentElement; }
        out.push((s ? "[scroller] " : "") + e.tagName.toLowerCase() + "." + String(e.className).split(" ")[0] + " r=" + Math.round(rc.right)); }
      return { page: document.documentElement.scrollWidth, W, over: [...new Set(out)].slice(0, 8) }; });
    console.log(n, r.page > r.W ? "PAGE SCROLLS " + r.page : "ok", JSON.stringify(r.over));
    await p.screenshot({ path: `${OUT}/${TAG}-${i + 1}-${n.replace(/\W+/g, "_")}.png`, fullPage: true });
  }
  console.log("errors", JSON.stringify(errors)); await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
