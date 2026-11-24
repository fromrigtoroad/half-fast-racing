# Half Fast Racing

Website and team admin for Half Fast Racing, a 24 Hours of Lemons endurance team.

- Site: https://half-fast-racing.web.app
- Admin: https://half-fast-racing.web.app/admin (email and password; accounts are created by a site admin)

## Status

- **Built:** the public pages (Home, Results by season, Cars, About, Gallery), rendered on the server from the database; the admin (race schedule, Home and About text, race reports, cars, photos, Instagram post links, admins); and a daily check of the official results, standings and schedule.
- **Not built yet:** AI-drafted race reports, hand-correcting a single result from the admin, and an email when a check keeps failing (the admin's Overview shows it instead).
- Pages carry `noindex` until an admin switches on "Launch".

## How it fits together

| Part | Where | Notes |
|---|---|---|
| Public pages | `functions/render.js`, served by the `site` function | Reads Firestore through `functions/data.js`; anything missing falls back to `functions/seed.json`, so a page never renders blank. Cached about two minutes. |
| Admin | `web/admin/` (bundled by esbuild) | Talks to Firestore and Storage directly, under `firestore.rules` and `storage.rules`. |
| People and roles | the `api` function in `functions/index.js` | Owner only. Roles are custom claims: `owner`, `carowner` (with their car number), `member`. |
| Daily update | `functions/sync.js`, run by the `sync` function at 6:00 ET and by "Check now" in the admin | Results from the Speedhive API; standings and schedule read from the Lemons pages. Each source is independent: if one can't be read, the site keeps the last good numbers and the admin says so. A report or note written for a race survives a results refresh. |
| Static files | `web/static/` | Styles, fonts, logo. |

Everyone with a login is an **admin** (`owner` in the code) and can edit everything and add or remove other admins. The first admin account ever created is the **main admin** and can't be removed. Who appears on the public About page is a tick box per person. The rules still understand two narrower roles (`carowner`, `member`), but nobody is given them.

The gallery holds 20 photos at most, to keep storage small.

### Cars and numbers

A car is known by its **name**, not its race number: numbers change between races, and two cars can share a number at different races. `functions/cars.js` decides which car a result belongs to (the admin bundles the same file):

1. a pick an admin made for that race (`assign` on the event) wins;
2. otherwise the one car that lists the number;
3. if several cars list it, the result belongs to no car until an admin picks.

Results nobody claims still appear on the Results page under their number. Car docs created before this (keyed by number, no `numbers` list) keep working.

## Working on it

```bash
npm ci && npm ci --prefix functions
npm test                      # renderer, data-merge and update-job tests (the update job runs against saved copies of the real pages in functions/fixtures/)
npm run build                 # static files and the admin bundle into public/
npx firebase emulators:start --project demo-hfr    # the whole thing locally, with fake data
node tools/e2e.js             # end-to-end test against the running emulators (needs Playwright)
```

Deploys run from the **Deploy** workflow in the Actions tab (by hand). One-time setup scripts: `scripts/setup-github-deploy.sh` (already run) and `scripts/create-owner.sh` (creates the first site admin's login; asks for the password in a hidden prompt).

## Where the numbers come from

- Race results: MyLaps Speedhive, organization 145414 (24 Hours of Lemons). `tools/` has the scripts that pulled them.
- Points standings: https://24hoursoflemons.com/standings
- Schedule: https://24hoursoflemons.com/schedule

## Rules

This repo is public. No secrets, logins or personal contact details in it. Photos, people and passwords live in Firebase, not here.
