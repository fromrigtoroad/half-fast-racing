#!/usr/bin/env bash
# One-time setup so this repo's GitHub "Deploy" workflow can deploy the Half Fast Racing site.
# Run on the owner's Mac from the repo root:  bash scripts/setup-github-deploy.sh
# Safe to run again: every step checks first.
#
# What it does, all inside the half-fast-racing Google project:
#   1. Turns on the Google services the site uses (hosting, functions, database, photo storage, logins, scheduler).
#   2. Creates the database (Firestore) if there isn't one.
#   3. Lets GitHub Actions from this repo's Deploy workflow sign in with short-lived tokens.
#      No key is created or stored anywhere.
#   4. Creates one deploy identity with the roles a deploy needs.
set -euo pipefail
PROJECT="${1:-half-fast-racing}"
REPO="fromrigtoroad/half-fast-racing"
POOL="github"
PROVIDER="half-fast-racing"
REGION="us-east1"

command -v gcloud >/dev/null || { echo "gcloud is missing: brew install --cask google-cloud-sdk"; exit 1; }

echo "Setting up GitHub deploys for the Google project: $PROJECT"
PNUM="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
G=(--project="$PROJECT" --quiet)

echo "1/5 Google services"
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com iam.googleapis.com \
  firebase.googleapis.com firebasehosting.googleapis.com cloudfunctions.googleapis.com run.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com eventarc.googleapis.com pubsub.googleapis.com \
  firestore.googleapis.com firebasestorage.googleapis.com storage.googleapis.com identitytoolkit.googleapis.com \
  cloudscheduler.googleapis.com secretmanager.googleapis.com cloudbilling.googleapis.com firebaseextensions.googleapis.com "${G[@]}"

echo "2/5 Database"
# A service that was just switched on can take a few minutes to be usable, so this step retries.
if ! gcloud firestore databases describe --database="(default)" "${G[@]}" >/dev/null 2>&1; then
  made=""
  for try in 1 2 3 4 5 6 7 8; do
    if gcloud firestore databases create --database="(default)" --location="$REGION" --type=firestore-native "${G[@]}" 2>/tmp/hfr-firestore.err; then made=1; break; fi
    if grep -q "already exists" /tmp/hfr-firestore.err; then made=1; break; fi
    echo "   Database service not ready yet, waiting 30 s (try $try of 8)"; sleep 30
  done
  [ -n "$made" ] || { cat /tmp/hfr-firestore.err; echo "The database could not be created. Run this script again in a few minutes."; exit 1; }
fi

echo "3/5 Identity pool and GitHub provider"
if ! gcloud iam workload-identity-pools describe "$POOL" --location=global "${G[@]}" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL" --location=global --display-name="GitHub Actions" "${G[@]}"
fi
# Only this repo's Deploy workflow file may sign in. Other workflows, forks and every other repo are refused.
CONDITION="assertion.repository=='$REPO' && assertion.workflow_ref.startsWith('$REPO/.github/workflows/deploy.yml@')"
MAPPING="google.subject=assertion.sub,attribute.repository=assertion.repository"
if gcloud iam workload-identity-pools providers describe "$PROVIDER" --location=global --workload-identity-pool="$POOL" "${G[@]}" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers update-oidc "$PROVIDER" --location=global --workload-identity-pool="$POOL" \
    --attribute-mapping="$MAPPING" --attribute-condition="$CONDITION" "${G[@]}"
else
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --location=global --workload-identity-pool="$POOL" \
    --display-name="$PROVIDER" --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="$MAPPING" --attribute-condition="$CONDITION" "${G[@]}"
fi

echo "4/5 Deploy identity and its roles (inside $PROJECT only)"
ROLES="roles/firebasehosting.admin roles/cloudfunctions.admin roles/run.admin roles/iam.serviceAccountUser roles/artifactregistry.admin roles/cloudbuild.builds.editor roles/secretmanager.admin roles/cloudscheduler.admin roles/firebaserules.admin roles/datastore.indexAdmin roles/firebasestorage.admin roles/serviceusage.apiKeysViewer roles/serviceusage.serviceUsageConsumer roles/serviceusage.serviceUsageViewer"
EMAIL="deploy@$PROJECT.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "$EMAIL" "${G[@]}" >/dev/null 2>&1; then
  gcloud iam service-accounts create deploy --display-name="GitHub deploy" "${G[@]}"
fi
for role in $ROLES; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$EMAIL" --role="$role" --condition=None --quiet >/dev/null
done
MEMBER="principalSet://iam.googleapis.com/projects/$PNUM/locations/global/workloadIdentityPools/$POOL/attribute.repository/$REPO"
gcloud iam service-accounts add-iam-policy-binding "$EMAIL" --member="$MEMBER" --role="roles/iam.workloadIdentityUser" "${G[@]}" >/dev/null

echo "5/5 Where GitHub signs in (not secret; already written in .github/workflows/deploy.yml)"
echo "   projects/$PNUM/locations/global/workloadIdentityPools/$POOL/providers/$PROVIDER"

echo
echo "Done. GitHub can now deploy $PROJECT, and only $PROJECT."
