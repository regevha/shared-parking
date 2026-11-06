# Deploying the demo to Azure

A low-cost demo setup (about $13/month):

| Part | Azure service | Cost |
|------|---------------|------|
| React frontend | Static Web Apps, Free plan | $0 |
| FastAPI backend + SQLite file | App Service (Linux), B1, one instance | ~$13/month |

The SQLite file lives in `/home/data`, the only folder App Service keeps across restarts and
redeploys. If it is ever lost, the backend re-seeds the demo data on start (`AUTO_SEED_DEMO`).
**This is for demos only.** Keep real data out of it, and use PostgreSQL if it becomes a real service.

The deploy workflow (`.github/workflows/deploy-azure.yml`) does nothing until you finish step 5.

## One-time setup

Prerequisites: an Azure subscription, the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
(`az login`), and the GitHub CLI (`gh auth login`). Pick unique names for `APP` and `WEB`.

```bash
RG=parking-demo-rg
LOC=westeurope          # any Azure region near you
APP=parking-demo-api    # becomes https://parking-demo-api.azurewebsites.net (must be globally unique)
WEB=parking-demo-web
REPO=regevha/shared-parking

az group create -n $RG -l $LOC
```

### 1. Frontend (Static Web Apps)

```bash
az staticwebapp create -n $WEB -g $RG -l $LOC --sku Free
WEB_HOST=$(az staticwebapp show -n $WEB -g $RG --query defaultHostname -o tsv)
WEB_TOKEN=$(az staticwebapp secrets list -n $WEB -g $RG --query properties.apiKey -o tsv)
echo "Frontend will be at https://$WEB_HOST"
```

### 2. Backend (App Service)

```bash
az appservice plan create -n parking-demo-plan -g $RG --is-linux --sku B1 --number-of-workers 1
az webapp create -n $APP -g $RG -p parking-demo-plan --runtime "PYTHON:3.12"

az webapp config appsettings set -n $APP -g $RG --settings \
  SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_hex(32))')" \
  DATABASE_URL="sqlite:////home/data/parking.db" \
  AUTO_SEED_DEMO=true \
  DEBUG=false \
  CORS_ORIGINS="https://$WEB_HOST" \
  LOG_DIR=/home/LogFiles/parking \
  SCM_DO_BUILD_DURING_DEPLOYMENT=true \
  WEBSITES_PORT=8000

az webapp config set -n $APP -g $RG --always-on true \
  --startup-file "python -m uvicorn main:app --host 0.0.0.0 --port 8000"
```

Keep the plan at **one instance**: the 15-minute auto-approve job runs inside the app and would
run twice with more.

### 3. Let GitHub deploy with a publish profile

New subscriptions disable basic-auth publishing by default; turn it on for the SCM site only:

```bash
az resource update -g $RG -n scm --namespace Microsoft.Web \
  --resource-type basicPublishingCredentialsPolicies --parent sites/$APP --set properties.allow=true
PROFILE=$(az webapp deployment list-publishing-profiles -n $APP -g $RG --xml)
```

### 4. Store the credentials in GitHub

```bash
gh secret set AZURE_WEBAPP_PUBLISH_PROFILE -R $REPO --body "$PROFILE"
gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN -R $REPO --body "$WEB_TOKEN"
gh variable set AZURE_WEBAPP_NAME -R $REPO --body "$APP"
```

### 5. Turn deployment on and run it

```bash
gh variable set AZURE_DEPLOY -R $REPO --body true
gh workflow run "Deploy demo to Azure" -R $REPO
```

Open `https://$WEB_HOST` and sign in with `sarah@parking.dev` / `password123`
(also `mike@` and `admin@parking.dev`). The first request after a deploy can take 30–60 seconds
while the backend builds and starts.

From now on every push to `master` redeploys both parts.

## Things to know

- **Change the demo password** if you share the link widely: the seeded accounts are public knowledge.
  Edit `backend/seed.py`, or sign in as the manager and change the passwords in the Admin Panel.
- **Reset the demo data:** delete `/home/data/parking.db` (App Service → SSH, or Kudu) and restart the app.
- **Logs:** `az webapp log tail -n $APP -g $RG`, or the files in `/home/LogFiles/parking`.
- **Custom domain:** optional. If you add one for the frontend, update `CORS_ORIGINS` to match.
- **Stop paying:** `az group delete -n $RG` removes everything.
- **Moving past a demo:** switch `DATABASE_URL` to Azure Database for PostgreSQL (SQLAlchemy is
  already used), add Key Vault for secrets, and allow more than one instance.
