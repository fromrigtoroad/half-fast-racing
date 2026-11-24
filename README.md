# Half Fast Racing

Website for Half Fast Racing, a 24 Hours of Lemons endurance team.

## Status

Design preview only. The real site (hosting, admin, teammate logins, automatic results) is not built yet.

## What's here

- `design/build_preview.py`: builds the single-file design preview (`design/site/half-fast-preview.html`) from the results data. Run it from `design/`: `python3 build_preview.py`.
- `design/style2.css`: the preview's styles.
- `design/hfr_hits.json`, `design/hfr_hits_old.json`: Half-Fast Racing rows from official Lemons timing (MyLaps Speedhive), 2018 to 2026.
- `design/scan/`: the scripts that pulled those rows from the Speedhive event-results API.

## Where the numbers come from

- Race results: MyLaps Speedhive, organization 145414 (24 Hours of Lemons).
- Points standings: https://24hoursoflemons.com/standings

## Rules

No secrets, logins or personal contact details in this repo. It is public. Photos and teammate details live in the database, not here.
