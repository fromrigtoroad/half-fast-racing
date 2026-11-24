# Half Fast Racing

Website for Half Fast Racing, a 24 Hours of Lemons endurance team.

## Status

- **Built:** the public site (Home, Results by season, Cars, About, Gallery) as static pages, and a manual Deploy workflow.
- **Not built yet:** the admin, teammate logins, photo uploads, the info form with voice input, and the automatic results update. Photo and bio slots are placeholders.
- The pages carry `noindex` until the owner approves the site for launch.

## Layout

- `site/build.py`: builds the site into `public/` from the data files. `python3 site/build.py`
  - `python3 site/build.py --preview out.html` writes the single-file design preview, which also holds the admin mock-up.
- `site/style.css`, `site/static/`: styles, fonts and the logo.
- `site/data/results.json`: Half-Fast Racing rows from official Lemons timing (MyLaps Speedhive), 2018 to 2026.
- `site/data/schedule.json`: upcoming races from the Lemons schedule page.
- `tools/scan/`: the scripts that pulled the results from the Speedhive event-results API.
- `scripts/setup-github-deploy.sh`: one-time Google setup (already run).
- `.github/workflows/deploy.yml`: deploys to Firebase Hosting, project `half-fast-racing`. Started by hand.

## Where the numbers come from

- Race results: MyLaps Speedhive, organization 145414 (24 Hours of Lemons).
- Points standings: https://24hoursoflemons.com/standings (typed in by hand for now).

## Rules

No secrets, logins or personal contact details in this repo. It is public. Photos and teammate details will live in the database, not here.
