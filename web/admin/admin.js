import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { getStorage, connectStorageEmulator, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

const app$ = document.getElementById("app");
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v; else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else if (k in n && k !== "list") n[k] = v; else n.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(k));
  return n;
};
const MIC = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V22h2v-3.08A7 7 0 0 0 19 12h-2Z"/></svg>';
const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;

/** A labelled input. opts: {multiline, type, hint, placeholder}. Multiline fields get a mic button where the browser can dictate. */
function field(label, value, opts = {}) {
  const input = opts.multiline ? el("textarea", { value: value || "", placeholder: opts.placeholder || (Speech ? "Type, or tap the mic and talk." : "") }) : el("input", { type: opts.type || "text", value: value || "", placeholder: opts.placeholder || "" });
  let body = input;
  if (opts.multiline && Speech) {
    let rec = null;
    const btn = el("button", { type: "button", class: "micbtn", title: "Dictate", "aria-label": `Dictate: ${label}`, innerHTML: MIC, onclick: () => {
      if (rec) { rec.stop(); return; }
      rec = new Speech(); rec.lang = "en-US"; rec.continuous = true; rec.interimResults = false;
      rec.onresult = (ev) => { for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) { const t = ev.results[i][0].transcript.trim(); input.value = (input.value ? input.value.replace(/\s*$/, " ") : "") + t.charAt(0).toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? "" : "."); } };
      rec.onend = () => { rec = null; btn.classList.remove("rec"); };
      rec.onerror = () => { rec = null; btn.classList.remove("rec"); };
      btn.classList.add("rec"); rec.start();
    } });
    body = el("div", { class: "tawrap" }, input, btn);
  }
  return { node: el("label", { class: "f" + (opts.wide ? " wide" : "") }, el("span", {}, label, opts.hint ? el("small", {}, " · " + opts.hint) : null), body), get: () => input.value.trim(), input };
}
const msg = () => { const n = el("p", { class: "msg", role: "status" }); return { node: n, ok: (t) => { n.className = "msg ok"; n.textContent = t; }, err: (t) => { n.className = "msg err"; n.textContent = t; }, clear: () => { n.textContent = ""; } }; };
const panel = (title, ...kids) => el("section", { class: "apanel stack" }, el("div", { class: "ph" }, el("h2", {}, title)), ...kids);
/** A button that shows progress and reports the outcome in `m`. */
const action = (label, m, fn, cls = "") => { const b = el("button", { type: "button", class: "abtn " + cls, onclick: async () => { b.disabled = true; m.clear(); try { const r = await fn(); m.ok(r || "Saved. The site shows it within about two minutes."); } catch (e) { console.error(e); m.err(e.message || "That didn't save. Try again."); } b.disabled = false; } }, label); return b; };

async function boot() {
  const cfg = await (await fetch("/__/firebase/init.json")).json();
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  if (local) { cfg.apiKey ||= "demo"; cfg.storageBucket ||= `${cfg.projectId}.appspot.com`; } // the emulators accept any key
  if (!cfg.apiKey) throw new Error("this Firebase project has no web app yet. In the Firebase console: Project settings → Your apps → Add app → Web.");
  const app = initializeApp(cfg); const auth = getAuth(app); const db = getFirestore(app); const storage = getStorage(app);
  if (local) { connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); connectFirestoreEmulator(db, "127.0.0.1", 8080); connectStorageEmulator(storage, "127.0.0.1", 9199); }
  const F = { auth, db, storage };
  onAuthStateChanged(auth, async (user) => {
    if (!user) return loginScreen(F);
    const tok = await user.getIdTokenResult(true);
    const me = { uid: user.uid, email: user.email, role: tok.claims.role || "", car: tok.claims.car || "" };
    if (!me.role) return app$.replaceChildren(el("div", { class: "login" }, el("form", {}, el("h1", {}, "No access yet"), el("p", {}, "This login isn't on the team list. Ask the team owner to add you."), el("button", { type: "button", class: "abtn", onclick: () => signOut(auth) }, "Sign out"))));
    shell(F, me);
  });
}

function loginScreen(F) {
  const email = field("Email", "", { type: "email" }); const pw = field("Password", "", { type: "password" }); const m = msg();
  email.input.autocomplete = "username"; pw.input.autocomplete = "current-password"; email.input.required = pw.input.required = true;
  const form = el("form", { onsubmit: async (ev) => { ev.preventDefault(); m.clear(); try { await signInWithEmailAndPassword(F.auth, email.get(), pw.get()); } catch { m.err("That email and password don't match."); } } },
    el("img", { src: "/logo.webp", alt: "Half Fast Racing" }), el("h1", {}, "Team admin"), email.node, pw.node, el("button", { class: "abtn", type: "submit" }, "Sign in"),
    el("button", { type: "button", class: "linkbtn", onclick: async () => { if (!email.get()) return m.err("Type your email first."); try { await sendPasswordResetEmail(F.auth, email.get()); } catch {} m.ok("If that email is on the team list, a reset link is on its way."); } }, "Forgot or need to set a password?"), m.node);
  app$.replaceChildren(el("div", { class: "login" }, form));
}

async function api(F, path, body) {
  const r = await fetch("/api" + path, { method: body ? "POST" : "GET", headers: { authorization: "Bearer " + (await F.auth.currentUser.getIdToken()), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Request failed"); return j;
}

async function shell(F, me) {
  app$.replaceChildren(el("p", { class: "boot" }, "Loading…"));
  let S; try { S = await api(F, "/state"); } catch (e) { return app$.replaceChildren(el("p", { class: "boot" }, e.message)); }
  const years = Object.keys(S.seasons).sort().reverse(); const cur = S.seasons[years[0]] || [];
  const fleetNums = [...new Set([...cur.flatMap((ev) => Object.keys(ev.cars)), ...Object.keys(S.cars)])].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const ctx = { F, me, S, years, fleetNums, reload: () => shell(F, me) };
  const tabs = me.role === "owner" ? [["Overview", overview], ["Race schedule", schedule], ["Home & About", pages], ["Race reports", reports], ["Cars", cars], ["Gallery", gallery], ["People", people], ["My card", myCard]]
    : me.role === "carowner" ? [["My car", cars], ["Gallery", gallery], ["My card", myCard]] : [["Photos", gallery], ["My card", myCard]];
  const main = el("div", { class: "amain" }); const nav = el("nav", {});
  const show = async (i) => { [...nav.children].forEach((b, j) => b.classList.toggle("on", i === j)); main.replaceChildren(el("div", { class: "ahead" }, el("div", {}, el("h1", {}, tabs[i][0])), el("div", { class: "who" }, el("span", { class: "av" }, (me.email || "?")[0].toUpperCase()), el("div", {}, el("b", {}, me.email), el("small", {}, { owner: "Team owner", carowner: `Car owner${me.car ? " · #" + me.car : ""}`, member: "Teammate" }[me.role])))), ...(await tabs[i][1](ctx))); sessionStorage.setItem("tab", i); };
  tabs.forEach(([name], i) => nav.append(el("button", { type: "button", onclick: () => show(i) }, name)));
  app$.replaceChildren(el("div", { class: "adm" }, el("aside", { class: "aside" }, el("div", { class: "abrand" }, el("b", {}, "Half Fast"), " ", el("span", {}, "Admin")), nav, el("a", { class: "viewsite", href: "/?fresh", target: "_blank" }, "View the site ↗"), el("button", { type: "button", class: "linkbtn viewsite", style: "margin-top:0", onclick: () => signOut(F.auth) }, "Sign out")), main));
  show(Math.min(Number(sessionStorage.getItem("tab") || 0), tabs.length - 1));
}

function overview({ S, years }) {
  const today = new Date().toLocaleDateString("en-CA"); const next = S.schedule.filter((r) => r.racing && r.end >= today)[0];
  const st = S.standings; const i = st.national.findIndex(([t]) => t === st.team);
  return [el("div", { class: "todo" },
    el("article", { class: "tcard hot" }, el("span", { class: "tag" }, "Next race"), el("h3", {}, next ? next.name : "No race picked"), el("p", {}, next ? `${next.loc} · starts ${next.start}` : "Open Race schedule and switch on the races the team is entering.")),
    el("article", { class: "tcard" }, el("span", { class: "tag" }, "Standings"), el("h3", {}, i >= 0 ? `P${i + 1} nationally · ${st.national[i][1]} points` : "Not ranked"), el("p", {}, `Typed in on ${st.checkedAt}. Automatic updates aren't built yet.`)),
    el("article", { class: "tcard" }, el("span", { class: "tag" }, "Results on record"), el("h3", {}, `${years.reduce((n, y) => n + S.seasons[y].length, 0)} race weekends`), el("p", {}, `${years[years.length - 1]} to ${years[0]}, from official timing.`))),
    panel("How this works", el("p", { class: "hint" }, "Pick a section on the left, change what you need and press Save. The public site shows the change within about two minutes. “View the site” opens a fresh copy straight away."))];
}

function schedule({ F, S, fleetNums }) {
  const today = new Date().toLocaleDateString("en-CA"); const races = S.schedule.filter((r) => r.end >= today).map((r) => ({ ...r, cars: [...(r.cars || [])] })); const m = msg();
  const rows = races.map((r) => {
    const carBox = el("td", { class: "carsel" }, fleetNums.map((n) => el("label", {}, el("input", { type: "checkbox", checked: r.cars.includes(n), onchange: (ev) => { r.cars = ev.target.checked ? [...r.cars, n] : r.cars.filter((c) => c !== n); } }), "#" + n)));
    const tr = el("tr", { class: r.racing ? "in" : "" }, el("td", {}, el("button", { type: "button", class: "tog", "aria-pressed": String(!!r.racing), "aria-label": `Racing ${r.name}`, onclick: (ev) => { r.racing = !r.racing; ev.currentTarget.setAttribute("aria-pressed", String(r.racing)); tr.classList.toggle("in", r.racing); } }, el("i"))),
      el("td", { class: "d" }, `${r.start.slice(5)} → ${r.end.slice(5)}`, el("small", {}, r.start.slice(0, 4))), el("td", {}, el("strong", {}, r.name), el("small", {}, r.loc)), el("td", { class: "d" }, r.deadline), carBox);
    return tr;
  });
  return [panel("Upcoming races", el("p", { class: "hint" }, "Switch on the races the team is entering and tick the cars. The home page countdown follows the first race that is switched on."),
    el("div", { class: "tbl plain" }, el("table", {}, el("thead", {}, el("tr", {}, ["Racing?", "Dates", "Race", "Entry deadline", "Cars"].map((h) => el("th", {}, h)))), el("tbody", {}, rows))),
    el("div", { class: "rowacts" }, action("Save schedule", m, async () => { const past = S.schedule.filter((r) => r.end < today); await setDoc(doc(F.db, "site", "schedule"), { races: [...past, ...races] }); S.schedule = [...past, ...races]; }), m.node))];
}

function pages({ F, S }) {
  const C = S.content; const m = msg(); const m2 = msg();
  const f = { kicker: field("Small line above the headline", C.kicker, { wide: true }), headline: field("Home headline", C.headline, { multiline: true, hint: "one line per row; the last word turns yellow" }), lede: field("Home intro", C.lede, { multiline: true }),
    aboutHeadline: field("About headline", C.aboutHeadline, { multiline: true }), aboutLede: field("About intro", C.aboutLede, { multiline: true }), story: field("The team's story", C.story, { multiline: true, wide: true, hint: "leave a blank line between paragraphs" }),
    homeBase: field("Home base", C.homeBase, { placeholder: "City, State" }), since: field("Racing since", C.since), instagram: field("Instagram handle", C.instagram, { hint: "without the @" }) };
  const launched = el("input", { type: "checkbox", checked: !!C.launched });
  return [panel("Home & About", el("div", { class: "formgrid" }, Object.values(f).map((x) => x.node)),
    el("div", { class: "rowacts" }, action("Save", m, async () => { const data = Object.fromEntries(Object.entries(f).map(([k, x]) => [k, x.get()])); if (!data.headline) throw new Error("The home headline can't be empty."); await setDoc(doc(F.db, "site", "content"), data, { merge: true }); Object.assign(C, data); }), m.node)),
  panel("Launch", el("label", { class: "rowacts" }, launched, " Let Google and other search engines list the site"), el("p", { class: "hint" }, "Leave this off until the site is ready to be found."),
    el("div", { class: "rowacts" }, action("Save", m2, async () => { await setDoc(doc(F.db, "site", "content"), { launched: launched.checked }, { merge: true }); C.launched = launched.checked; }), m2.node))];
}

function reports({ F, S, years }) {
  const m = msg(); const yearSel = el("select", {}, years.map((y) => el("option", { value: y }, y))); const raceSel = el("select", {}); const holder = el("div", { class: "stack" });
  const draw = () => {
    const ev = S.seasons[yearSel.value][Number(raceSel.value)]; if (!ev) return holder.replaceChildren();
    const note = field("One line for the home page", ev.note || "", { hint: "shown under “Latest result” when this is the newest race" }); const rep = field("Race report", ev.report || "", { multiline: true, hint: "leave a blank line between paragraphs" });
    holder.replaceChildren(note.node, rep.node, el("div", { class: "rowacts" }, action("Save report", m, async () => { ev.note = note.get(); ev.report = rep.get(); await setDoc(doc(F.db, "seasons", yearSel.value), { events: S.seasons[yearSel.value] }); }), m.node));
  };
  const fill = () => { raceSel.replaceChildren(...S.seasons[yearSel.value].map((ev, i) => el("option", { value: i }, `${ev.date} · ${ev.race}${ev.report ? " ✓" : ""}`))); draw(); };
  yearSel.onchange = fill; raceSel.onchange = draw; fill();
  return [panel("Write a race report", el("div", { class: "formgrid" }, el("label", { class: "f" }, "Season", yearSel), el("label", { class: "f" }, "Race", raceSel)), holder)];
}

async function uploadImage(F, me, file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null); if (!bmp) throw new Error(`${file.name} isn't a photo this browser can read.`);
  const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height)); const c = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.85));
  const path = `photos/${me.uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`; const r = ref(F.storage, path);
  await uploadBytes(r, blob, { contentType: "image/jpeg", cacheControl: "public, max-age=31536000" });
  return { url: await getDownloadURL(r), path };
}
/** A photo picker for one image (car, profile). Returns {node, get}. */
function photoField(F, me, label, current) {
  let url = current || ""; const m = msg(); const pic = el("img", { class: "thumb", src: url || "/logo.webp", alt: "" });
  const input = el("input", { type: "file", accept: "image/*", onchange: async () => { if (!input.files[0]) return; m.ok("Uploading…"); try { url = (await uploadImage(F, me, input.files[0])).url; pic.src = url; m.ok("Uploaded. Press Save to keep it."); } catch (e) { m.err(e.message); } } });
  return { node: el("label", { class: "f" }, label, pic, input, m.node), get: () => url };
}

function cars({ F, me, S, fleetNums }) {
  const nums = me.role === "owner" ? fleetNums : [me.car].filter(Boolean);
  if (!nums.length) return [panel("My car", el("p", { class: "empty" }, "No car is linked to your login yet. Ask the team owner."))];
  const addNum = field("Add a car number", "", { placeholder: "e.g. 47" }); const out = [];
  for (const n of nums) {
    const c = S.cars[n] || {}; const m = msg();
    const f = { year: field("Year", c.year), make: field("Make", c.make), model: field("Model", c.model), story: field("Its story", c.story, { multiline: true, wide: true, hint: "where it came from, what broke, what it cost" }) }; const ph = photoField(F, me, "Photo", c.photo);
    out.push(panel(`Car #${n}`, el("div", { class: "formgrid" }, f.year.node, f.make.node, f.model.node, ph.node, f.story.node), el("div", { class: "rowacts" }, action("Save", m, async () => { const data = { year: f.year.get(), make: f.make.get(), model: f.model.get(), story: f.story.get(), photo: ph.get() }; await setDoc(doc(F.db, "cars", n), data, { merge: true }); S.cars[n] = data; }), m.node)));
  }
  if (me.role === "owner") { const m = msg(); out.push(panel("Add a car", addNum.node, el("div", { class: "rowacts" }, action("Add", m, async () => { const n = addNum.get().replace(/^#/, ""); if (!/^\w{1,6}$/.test(n)) throw new Error("Type the car number."); await setDoc(doc(F.db, "cars", n), {}, { merge: true }); S.cars[n] = S.cars[n] || {}; setTimeout(() => location.reload(), 600); return "Added."; }), m.node))); }
  return out;
}

async function gallery({ F, me, S, years }) {
  const canPublish = me.role !== "member"; const m = msg(); const grid = el("div", { class: "pgrid" });
  const raceNames = ["Paddock", ...years.slice(0, 2).flatMap((y) => S.seasons[y].map((ev) => `${ev.race} ${y}`))];
  const draw = async () => {
    const snap = await getDocs(query(collection(F.db, "photos"), orderBy("at", "desc"), limit(200)));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => canPublish || p.by === me.uid);
    grid.replaceChildren(...(list.length ? list.map((p) => {
      const sel = el("select", { disabled: !canPublish, onchange: () => updateDoc(doc(F.db, "photos", p.id), { race: sel.value }) }, raceNames.map((r) => el("option", { value: r, selected: r === (p.race || "Paddock") }, r)));
      return el("div", { class: "pcard" }, el("img", { src: p.url, alt: "", loading: "lazy" }), el("span", { class: "pill " + (p.status === "published" ? "g" : "y") }, p.status === "published" ? "On the site" : "Waiting"), sel,
        el("div", { class: "rowacts" }, canPublish ? el("button", { type: "button", class: "abtn sm", onclick: async () => { await updateDoc(doc(F.db, "photos", p.id), { status: p.status === "published" ? "new" : "published", race: sel.value }); draw(); } }, p.status === "published" ? "Hide" : "Publish") : null,
          (canPublish || p.status !== "published") ? el("button", { type: "button", class: "abtn sm danger", onclick: async () => { await deleteDoc(doc(F.db, "photos", p.id)); if (p.path) await deleteObject(ref(F.storage, p.path)).catch(() => {}); draw(); } }, "Delete") : null));
    }) : [el("p", { class: "empty" }, "No photos yet.")]));
  };
  const input = el("input", { type: "file", accept: "image/*", multiple: true, onchange: async () => {
    const files = [...input.files]; let done = 0; m.ok(`Uploading 0 of ${files.length}…`);
    for (const file of files) { try { const up = await uploadImage(F, me, file); await addDoc(collection(F.db, "photos"), { ...up, race: "Paddock", caption: "", status: "new", by: me.uid, at: new Date().toISOString() }); m.ok(`Uploading ${++done} of ${files.length}…`); } catch (e) { console.error(e); m.err(e.message); } }
    input.value = ""; if (done) m.ok(`${done} uploaded.${canPublish ? " Pick the race and press Publish." : " The owner picks which ones go on the site."}`); draw();
  } });
  await draw();
  const out = [panel("Upload photos", el("label", { class: "f" }, el("span", {}, "Choose photos", el("small", {}, " · phone photos are fine; they're resized automatically")), input), m.node), panel(canPublish ? "All photos" : "My photos", grid)];
  if (me.role === "owner") { const ig = field("Instagram posts to show", (S.instagramPosts || []).join("\n"), { multiline: true, hint: "one post link per line" }); const m2 = msg();
    out.push(panel("Instagram", ig.node, el("div", { class: "rowacts" }, action("Save", m2, async () => { const urls = ig.get().split(/\s+/).filter(Boolean).map((u) => u.split("?")[0]); const bad = urls.find((u) => !/^https:\/\/(www\.)?instagram\.com\/(p|reel)\/[\w-]+\/?$/.test(u)); if (bad) throw new Error(`This isn't an Instagram post link: ${bad}`); await setDoc(doc(F.db, "site", "gallery"), { instagramPosts: urls }); S.instagramPosts = urls; }), m2.node))); }
  return out;
}

async function people({ F, me, fleetNums }) {
  const list = el("tbody", {}); const m = msg(); const ROLE = { owner: "Owner", carowner: "Car owner", member: "Teammate" };
  const draw = async () => {
    const snap = await getDocs(collection(F.db, "people")); const rows = snap.docs.map((d) => ({ uid: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name));
    list.replaceChildren(...rows.map((p) => {
      const role = el("select", {}, Object.entries(ROLE).map(([k, v]) => el("option", { value: k, selected: k === p.role }, v))); const car = el("select", {}, el("option", { value: "" }, "no car"), fleetNums.map((n) => el("option", { value: n, selected: n === p.car }, "#" + n)));
      const show = el("input", { type: "checkbox", checked: !!p.showOnAbout, onchange: () => updateDoc(doc(F.db, "people", p.uid), { showOnAbout: show.checked }) });
      return el("tr", {}, el("td", {}, el("strong", {}, p.name), el("small", {}, p.email)), el("td", {}, role), el("td", {}, car), el("td", {}, show),
        el("td", {}, el("div", { class: "rowacts" }, action("Save", m, async () => { await api(F, "/role", { uid: p.uid, role: role.value, car: car.value }); return `${p.name} updated. They may need to sign in again.`; }, "sm"),
          action("Email login link", m, async () => { await sendPasswordResetEmail(F.auth, p.email); return `Sent to ${p.email}.`; }, "sm quiet"),
          p.uid !== me.uid ? action("Remove", m, async () => { if (!window.confirm(`Remove ${p.name}? Their login stops working.`)) return "Not removed."; await api(F, "/remove", { uid: p.uid }); await draw(); return `${p.name} removed.`; }, "sm danger") : null)));
    }));
  };
  await draw();
  const name = field("Name", ""); const email = field("Email", "", { type: "email" }); const role = el("select", {}, Object.entries(ROLE).filter(([k]) => k !== "owner").map(([k, v]) => el("option", { value: k }, v))); const car = el("select", {}, el("option", { value: "" }, "no car"), fleetNums.map((n) => el("option", { value: n }, "#" + n))); const m2 = msg();
  return [panel("Invite someone", el("div", { class: "formgrid" }, name.node, email.node, el("label", { class: "f" }, "Role", role), el("label", { class: "f" }, el("span", {}, "Their car", el("small", {}, " · car owners only")), car)),
    el("p", { class: "hint" }, "Car owners edit their car, publish photos and appear on the About page. Teammates upload photos. They get an email with a link to set their password."),
    el("div", { class: "rowacts" }, action("Send invite", m2, async () => { await api(F, "/invite", { name: name.get(), email: email.get(), role: role.value, car: car.value }); await sendPasswordResetEmail(F.auth, email.get()); await draw(); const who = email.get(); name.input.value = email.input.value = ""; return `Invite sent to ${who}.`; }), m2.node)),
  panel("People", el("div", { class: "tbl plain" }, el("table", {}, el("thead", {}, el("tr", {}, ["Person", "Role", "Car", "On About page", ""].map((h) => el("th", {}, h)))), list)), m.node)];
}

async function myCard({ F, me }) {
  const snap = await getDocs(collection(F.db, "people")); const p = snap.docs.find((d) => d.id === me.uid)?.data();
  if (!p) return [panel("My card", el("p", { class: "empty" }, "Your card hasn't been created yet."))];
  const f = { name: field("Name", p.name), title: field("Title", p.title, { placeholder: "e.g. Team owner, Crew chief", hint: "shown above your name" }), bio: field("About you", p.bio, { multiline: true, wide: true, hint: "how did you end up in a $500 race car?" }) }; const ph = photoField(F, me, "Your photo", p.photo); const m = msg();
  return [panel("My card", el("p", { class: "hint" }, me.role === "member" ? "Only owners appear on the About page, but the team can see this." : "This is your card on the About page."), el("div", { class: "formgrid" }, f.name.node, f.title.node, ph.node, f.bio.node),
    el("div", { class: "rowacts" }, action("Save", m, async () => { if (!f.name.get()) throw new Error("Add your name."); await updateDoc(doc(F.db, "people", me.uid), { name: f.name.get(), title: f.title.get(), bio: f.bio.get(), photo: ph.get() }); }), m.node))];
}

boot().catch((e) => { console.error(e); app$.replaceChildren(el("p", { class: "boot" }, "The admin couldn't start: " + e.message)); });
