# Half Fast Racing

Website and team admin for Half Fast Racing, a 24 Hours of Lemons endurance team.

- Site: https://half-fast-racing.web.app
- Admin: https://half-fast-racing.web.app/admin (email and password; accounts are created by a site admin)

## Status

- **Built:** the public pages (Home, Results by season, Cars, About, Gallery), rendered on the server from the database, and the admin: race schedule, Home and About text, race reports, cars, photos, Instagram post links, people and roles.
- **Not built yet:** automatic results, standings and schedule updates (they are typed in or seeded for now), and AI-drafted race reports.
- Pages carry `noindex` until the owner switches on "Launch" in the admin.

## How it fits together

| Part | Where | Notes |
|---|---|---|
| Public pages | `functions/render.js`, served by the `site` function | Reads Firestore through `functions/data.js`; anything missing falls back to `functions/seed.json`, so a page never renders blank. Cached about two minutes. |
| Admin | `web/admin/` (bundled by esbuild) | Talks to Firestore and Storage directly, under `firestore.rules` and `storage.rules`. |
| People and roles | the `api` function in `functions/index.js` | Owner only. Roles are custom claims: `owner`, `carowner` (with their car number), `member`. |
| Static files | `web/static/` | Styles, fonts, logo. |

Roles: a **site admin** (`owner` in the code) edits everything and manages people; it doesn't have to be the team's owner. A **car owner** edits their own car and publishes photos. A **teammate** uploads photos. Who appears on the public About page is a separate tick box per person.

## Working on it

```bash
npm ci && npm ci --prefix functions
npm test                      # renderer and data-merge tests
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
