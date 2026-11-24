#!/usr/bin/env bash
# Creates the team owner's login for the admin. Run once on the owner's Mac:  bash scripts/create-owner.sh
# It asks for the email and password here in the terminal (the password is hidden as you type).
# Nothing is written to the repo, and the password is never shown or stored on this computer.
set -euo pipefail
PROJECT="${1:-half-fast-racing}"
command -v gcloud >/dev/null || { echo "gcloud is missing: brew install --cask google-cloud-sdk"; exit 1; }
command -v python3 >/dev/null || { echo "python3 is missing."; exit 1; }

read -r -p "Your name (shown on the About page): " NAME
read -r -p "Email for the admin login: " EMAIL
read -r -s -p "Password (12 characters or more): " PASS; echo
read -r -s -p "Password again: " PASS2; echo
[ "$PASS" = "$PASS2" ] || { echo "The two passwords don't match. Nothing was created."; exit 1; }
[ "${#PASS}" -ge 12 ] || { echo "Use at least 12 characters. Nothing was created."; exit 1; }

TOKEN="$(gcloud auth print-access-token)"
export HFR_NAME="$NAME" HFR_EMAIL="$EMAIL" HFR_PASS="$PASS" HFR_PROJECT="$PROJECT" HFR_TOKEN="$TOKEN"
unset PASS PASS2
# The request bodies are built in Python from environment variables, so nothing sensitive appears in a command line.
python3 - <<'PY'
import json, os, sys, urllib.request, urllib.error
P, T = os.environ["HFR_PROJECT"], os.environ["HFR_TOKEN"]
name, email = os.environ["HFR_NAME"].strip(), os.environ["HFR_EMAIL"].strip().lower()
def call(method, url, body):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode(),
        headers={"Authorization": "Bearer " + T, "Content-Type": "application/json", "x-goog-user-project": P})
    try:
        return json.load(urllib.request.urlopen(req, timeout=30))
    except urllib.error.HTTPError as e:
        msg = e.read().decode(errors="replace")
        if "EMAIL_EXISTS" in msg: sys.exit("That email already has a login. Use the admin's \"Forgot or need to set a password?\" link instead.")
        sys.exit(f"Google refused ({e.code}): {msg[:400]}")
IDT = f"https://identitytoolkit.googleapis.com/v1/projects/{P}"
uid = call("POST", f"{IDT}/accounts", {"email": email, "password": os.environ["HFR_PASS"], "displayName": name, "emailVerified": True})["localId"]
call("POST", f"{IDT}/accounts:update", {"localId": uid, "customAttributes": json.dumps({"role": "owner", "car": ""})})
s = lambda v: {"stringValue": v}
call("PATCH", f"https://firestore.googleapis.com/v1/projects/{P}/databases/(default)/documents/people/{uid}",
     {"fields": {"name": s(name), "email": s(email), "role": s("owner"), "car": s(""), "bio": s(""), "photo": s(""), "title": s("Team owner"), "showOnAbout": {"booleanValue": True}}})
print(f"Done. Sign in at https://{P}.web.app/admin with {email}.")
PY
