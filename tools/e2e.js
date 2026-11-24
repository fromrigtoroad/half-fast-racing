// End-to-end check against the local emulators:  npx firebase emulators:exec --project demo-hfr "node tools/e2e.js"
// (or start the emulators and run it directly). Uses a throwaway owner account that exists only in the emulator.
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099"; process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
const admin = require("../functions/node_modules/firebase-admin"); const { chromium } = require("playwright"); const assert = require("node:assert/strict");
const BASE = "http://127.0.0.1:5000"; const PW = "emulator-only-" + Math.random().toString(36).slice(2);
(async () => {
  admin.initializeApp({ projectId: "demo-hfr" });
  const mk = async (email, name, role, car = "") => { const u = await admin.auth().createUser({ email, password: PW, displayName: name }); await admin.auth().setCustomUserClaims(u.uid, { role, car }); await admin.firestore().collection("people").doc(u.uid).set({ name, email, role, car, bio: "", photo: "", title: "", showOnAbout: role !== "member" }); return u.uid; };
  const stamp = Date.now(); const ownerEmail = `owner${stamp}@example.test`; const memberEmail = `member${stamp}@example.test`;
  await mk(ownerEmail, "Test Owner", "owner"); await mk(memberEmail, "Test Member", "member");
  const b = await chromium.launch(); const errors = [];
  const page = async (vp = { width: 1280, height: 900 }) => { const p = await b.newPage({ viewport: vp }); p.on("pageerror", (e) => errors.push(String(e))); p.on("dialog", (d) => d.accept()); return p; };
  const login = async (p, email) => { await p.goto(BASE + "/admin"); await p.fill("input[type=email]", email); await p.fill("input[type=password]", PW); await p.click("button[type=submit]"); await p.waitForSelector(".amain h1"); };
  const tab = async (p, name) => { await p.click(`.aside nav button:has-text("${name}")`); await p.waitForFunction((n) => document.querySelector(".amain h1")?.textContent === n, name); };
  const saved = async (p, scope = ".amain") => p.waitForSelector(`${scope} .msg.ok`, { timeout: 15000 });

  // public pages
  let p = await page();
  for (const [path, text] of [["/", "Next green flag"], ["/results", "Every lap counted"], ["/results/2023", "2023 season"], ["/cars", "Cheap cars"], ["/about", "The short version"], ["/gallery", "From the paddock"]]) { const r = await p.goto(BASE + path); assert.equal(r.status(), 200, path); assert.ok((await p.content()).includes(text), `${path} shows "${text}"`); }
  assert.equal((await p.goto(BASE + "/nope")).status(), 404);
  console.log("ok  public pages");

  // wrong password
  await p.goto(BASE + "/admin"); await p.fill("input[type=email]", ownerEmail); await p.fill("input[type=password]", "wrong-password"); await p.click("button[type=submit]"); await p.waitForSelector(".msg.err");
  console.log("ok  wrong password refused");

  // owner edits
  await login(p, ownerEmail);
  await tab(p, "Home & About"); const lede = `Edited by the e2e test ${stamp}.`; await p.locator("label.f:has-text('Home intro') textarea").fill(lede); await p.locator("label.f:has-text('Home base') input").fill("Bowling Green, KY");
  await p.locator(".apanel:has-text('Home & About') button.abtn").first().click(); await saved(p);
  const home = await (await fetch(BASE + "/?fresh")).text(); assert.ok(home.includes(lede), "home shows the edited intro");
  assert.ok((await (await fetch(BASE + "/about?fresh")).text()).includes("Bowling Green, KY"), "about shows the home base");
  console.log("ok  owner edits Home & About, site shows it");

  await tab(p, "Cars"); const pnl = (title) => p.locator(`.apanel:has(h2:text-is("${title}"))`); const fld = (scope, label) => scope.locator(`label.f:has-text("${label}") input`);
  const newCar = async (name, numbers) => { await p.click(".carpick button.new"); await fld(pnl("New car"), "Car name").fill(name); await fld(pnl("New car"), "Numbers").fill(numbers); await pnl("New car").locator("button:has-text('Create')").click(); await p.waitForSelector(`.apanel h2:text-is("${name}")`); };
  if (!(await p.locator(".carpick button:has-text('Lemon Drop')").count())) { await newCar("Lemon Drop", "42, 48, #92"); await newCar("The Bug", "222, 92"); }
  await p.click(".carpick button:has-text('Lemon Drop')"); await fld(pnl("Lemon Drop"), "Make").fill("Mazda"); await fld(pnl("Lemon Drop"), "Model").fill("Miata"); await pnl("Lemon Drop").locator("button:text-is('Save')").click(); await saved(p);
  assert.ok((await pnl("Lemon Drop").locator("label.f:has-text('Status')").innerText()).includes("Last raced 2026-11-07 as #42"), "shows when the car last raced and under which number");
  let carsHtml = await (await fetch(BASE + "/cars?fresh")).text(); assert.ok(carsHtml.includes("Lemon Drop") && carsHtml.includes("Mazda Miata")); assert.ok(!carsHtml.includes("Also raced as #92"), "#92 is shared, so it isn't counted for either car yet");
  const match = pnl("Which car ran which number"); assert.equal(await match.locator("tbody tr").count(), 2, "the two #92 races need a pick");
  for (const sel of await match.locator("tbody select").all()) await sel.selectOption({ label: "Lemon Drop" });
  await match.locator("button:has-text('Save matches')").click(); await saved(p, '.apanel:has(h2:text-is("Which car ran which number"))'); assert.equal(await match.locator("tbody tr").count(), 0);
  carsHtml = await (await fetch(BASE + "/cars?fresh")).text(); assert.ok(/Also raced as[^<]*#92/.test(carsHtml), "after the pick, #92 counts for Lemon Drop");
  assert.ok((await (await fetch(BASE + "/results?fresh")).text()).includes("#42<small>Lemon Drop</small>"), "results name the car");
  await p.click(".carpick button:has-text('The Bug')"); await pnl("The Bug").locator("label.f:has-text('Status') input").uncheck(); await pnl("The Bug").locator("button:text-is('Save')").click(); await saved(p, '.apanel:has(h2:text-is("The Bug"))');
  carsHtml = await (await fetch(BASE + "/cars?fresh")).text(); assert.ok(/id="retired"[\s\S]*The Bug/.test(carsHtml), "an inactive car moves to Retired"); assert.ok(!carsHtml.includes(">#404<") && !/id="car-17"/.test(carsHtml), "one-off numbers get no card");
  await pnl("The Bug").locator("label.f:has-text('Car name') input").fill(""); await pnl("The Bug").locator("button:text-is('Save')").click(); await p.waitForSelector('.msg.err:has-text("Give the car a name")');
  await p.screenshot({ path: (process.env.SHOT || "/dev/null").replace("overview", "cars"), fullPage: true }).catch(() => {}); console.log("ok  cars by name: several numbers, shared number needs a pick, retire, name required");

  await tab(p, "Race schedule"); const row = p.locator("tr:has-text('Shine Country Classic')").first(); const setTog = async (l, want) => { if ((await l.getAttribute("aria-pressed")) !== String(want)) await l.click(); };
  await setTog(row.locator(".tog"), true); await row.locator("label:has-text('Lemon Drop') input").check();
  await setTog(p.locator("tr:has-text('Scrotium') .tog").first(), false); await p.click("button:has-text('Save schedule')"); await saved(p);
  const h2 = await (await fetch(BASE + "/?fresh")).text(); assert.ok(/Next green flag<\/p><h2>Shine Country Classic/.test(h2), "countdown follows the schedule"); assert.ok(h2.includes("· Lemon Drop"), "shows the car picked by name");
  console.log("ok  schedule drives the next race");

  await tab(p, "Race reports"); await p.locator("label.f:has-text('Race report') textarea").fill("We finished.\n\nNothing caught fire."); await p.click("button:has-text('Save report')"); await saved(p);
  const res = await (await fetch(BASE + "/results?fresh")).text(); assert.ok(res.includes("Nothing caught fire."), "report shows"); assert.ok(res.includes("Every lap counted"), "results still render");
  console.log("ok  race report");

  await tab(p, "Gallery"); const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC", "base64");
  const have = (await admin.firestore().collection("photos").get()).size; for (let i = have; i < 18; i++) await admin.firestore().collection("photos").add({ url: "https://example.test/x.jpg", path: "", race: "Paddock", caption: "", status: "new", by: "filler", at: `2020-01-01T00:00:${String(i).padStart(2, "0")}Z` });
  await p.reload(); await p.waitForSelector(".pcard"); const file = (n) => ({ name: n, mimeType: "image/png", buffer: png });
  await p.setInputFiles("input[type=file][multiple]", [file("a.png"), file("b.png"), file("c.png"), file("d.png")]); await p.waitForSelector(".msg.ok:has-text('left out')", { timeout: 30000 });
  assert.equal((await admin.firestore().collection("photos").get()).size, 20, "the gallery stops at 20 photos"); assert.equal(await p.locator("input[type=file][multiple]").isDisabled(), true);
  await p.locator(".pcard button:has-text('Publish')").first().click(); await p.waitForSelector(".pcard .pill.g");
  const gal = await (await fetch(BASE + "/gallery?fresh")).text(); assert.ok(/<div class="galgrid"><a href="http/.test(gal), "published photo is in the gallery");
  await p.locator("label.f:has-text('Instagram posts') textarea").fill("https://example.com/not-instagram"); await p.locator(".apanel:has(h2:text-is('Instagram')) button.abtn").click(); await p.waitForSelector(".apanel:has(h2:text-is('Instagram')) .msg.err");
  await p.locator("label.f:has-text('Instagram posts') textarea").fill("https://www.instagram.com/p/ABC123/?igsh=x"); await p.locator(".apanel:has(h2:text-is('Instagram')) button.abtn").click(); await saved(p, ".apanel:has(h2:text-is('Instagram'))");
  assert.ok((await (await fetch(BASE + "/gallery?fresh")).text()).includes('data-instgrm-permalink="https://www.instagram.com/p/ABC123/"'), "instagram post embedded");
  assert.equal(await p.locator(".apanel:has(h2:text-is('Instagram')) .micbtn").count(), 0, "no mic on the links box");
  console.log("ok  photos: upload, 20-photo limit, publish, Instagram links (bad link refused)");

  await tab(p, "People"); const inv = p.locator(".apanel:has(h2:text-is('Add an admin'))"); const secondEmail = `second${stamp}@example.test`;
  await inv.locator("label.f:has-text('Name') input").fill("Second Admin"); await inv.locator("label.f:has-text('Email') input").fill(secondEmail); await inv.locator("button.abtn").click(); await saved(p, ".apanel:has(h2:text-is('Add an admin'))");
  const su = await admin.auth().getUserByEmail(secondEmail); assert.deepEqual(su.customClaims, { role: "owner", car: "" });
  assert.ok(!(await (await fetch(BASE + "/about?fresh")).text()).includes("Second Admin"), "a new admin is not on the About page by default");
  await p.locator("tr:has-text('Second Admin') input[type=checkbox]").check(); await p.waitForTimeout(800);
  assert.ok((await (await fetch(BASE + "/about?fresh")).text()).includes("Second Admin"), "ticking the box puts them on the About page");
  await inv.locator("label.f:has-text('Name') input").fill("Dup"); await inv.locator("label.f:has-text('Email') input").fill(secondEmail); await inv.locator("button.abtn").click(); await p.waitForSelector(".apanel:has(h2:text-is('Add an admin')) .msg.err");
  const mainRow = p.locator("tr:has(.nexttag:text-is('Main admin'))"); assert.equal(await mainRow.count(), 1); assert.equal(await mainRow.locator("button:has-text('Remove')").count(), 0, "no Remove button on the main admin");
  console.log("ok  add an admin (duplicate refused), About tick, main admin has no Remove");

  await tab(p, "Overview"); await p.click("button:has-text('Check now')"); await p.waitForSelector(".apanel:has-text('Official results') .msg.ok, .apanel:has-text('Official results') .pill", { timeout: 120000 }); await p.waitForTimeout(2500);
  assert.equal((await fetch(BASE + "/?fresh")).status, 200, "the site still renders after a check"); assert.ok((await (await fetch(BASE + "/results?fresh")).text()).includes("Every lap counted"));
  console.log("ok  Check now runs and the site keeps rendering:", (await p.locator(".apanel:has-text('Official results') tbody").innerText()).replace(/\s+/g, " ").slice(0, 260));
  await p.screenshot({ path: process.env.SHOT || "/dev/null", fullPage: true }).catch(() => {});

  // a second admin can't remove the main admin, even by calling the server directly
  const mainUid = (await admin.auth().listUsers()).users.filter((u) => u.customClaims?.role === "owner").sort((a, b) => new Date(a.metadata.creationTime) - new Date(b.metadata.creationTime))[0].uid;
  await admin.auth().updateUser(su.uid, { password: PW });
  const tokenOf = async (email) => (await (await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: PW, returnSecureToken: true }) })).json()).idToken;
  const rm = await fetch(BASE + "/api/remove", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + (await tokenOf(secondEmail)) }, body: JSON.stringify({ uid: mainUid }) }); assert.equal(rm.status, 403, "the main admin can't be removed");
  console.log("ok  the main admin can't be removed by another admin");

  // older roles still hold in the rules (nobody is given them any more)
  const carEmail = `carowner${stamp}@example.test`; const cu = { uid: await mk(carEmail, "Car Owner", "carowner", "220") };
  const p2 = await page(); await login(p2, carEmail); assert.deepEqual(await p2.locator(".aside nav button").allTextContents(), ["Gallery", "My card"]);
  const p3 = await page({ width: 390, height: 844 }); await login(p3, memberEmail); assert.deepEqual(await p3.locator(".aside nav button").allTextContents(), ["Photos", "My card"]);
  assert.equal(await p3.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "no sideways scroll on a phone");
  const p4 = await page({ width: 390, height: 844 }); await login(p4, ownerEmail); await tab(p4, "Cars"); assert.equal(await p4.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "admin cars page fits a phone");
  console.log("ok  limited roles see only their sections; admin fits a phone");

  // security rules, straight at the database with each person's own token
  const token = async (email) => (await (await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: PW, returnSecureToken: true }) })).json()).idToken;
  const write = async (tok, path, fields) => (await fetch(`http://127.0.0.1:8080/v1/projects/demo-hfr/databases/(default)/documents/${path}`, { method: "PATCH", headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) }, body: JSON.stringify({ fields }) })).status;
  const read = async (tok, path) => (await fetch(`http://127.0.0.1:8080/v1/projects/demo-hfr/databases/(default)/documents/${path}`, { headers: tok ? { authorization: "Bearer " + tok } : {} })).status;
  const mt = await token(memberEmail), ct = await token(carEmail), ot = await token(ownerEmail); const str = (s) => ({ stringValue: s });
  assert.equal(await read(null, "site/content"), 403, "strangers can't read the database");
  assert.equal(await write(null, "site/content", { lede: str("x") }), 403, "strangers can't write");
  assert.equal(await write(mt, "site/content", { lede: str("x") }), 403, "a teammate can't edit pages");
  assert.equal(await write(mt, "cars/42", { make: str("x") }), 403, "a teammate can't edit cars");
  assert.equal(await write(ct, "cars/42", { make: str("x") }), 403, "a car owner can't edit someone else's car");
  assert.equal(await write(ct, "cars/220", { make: str("Volkswagen") }), 200, "a car owner can edit their own car");
  assert.equal(await write(ct, "site/schedule", { x: str("x") }), 403, "a car owner can't edit the schedule");
  assert.equal(await write(ct, `people/${cu.uid}?updateMask.fieldPaths=role`, { role: str("owner") }), 403, "nobody can promote themselves");
  assert.equal(await write(ct, `people/${cu.uid}?updateMask.fieldPaths=bio`, { bio: str("hi") }), 200, "a person can edit their own bio");
  assert.equal(await write(ot, "site/content?updateMask.fieldPaths=since", { since: str("10+ years") }), 200, "the owner can edit pages");
  console.log("ok  database rules: strangers, teammates and car owners are held to their role");

  assert.deepEqual(errors, [], "no uncaught browser errors"); console.log("ALL PASSED"); await b.close(); process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
