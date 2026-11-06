# Backing up and restoring the database

All data lives in one SQLite file (`parking.db`). A backup is a consistent copy of that file.
Do **not** just copy it while the app is running and writing; use SQLite's online backup
(below), which is safe at any time.

## Local

A small script that works anywhere Python is installed (run from `backend/`):

```bash
python - <<'PY'
import sqlite3, datetime
stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
src = sqlite3.connect("parking.db")
dst = sqlite3.connect(f"parking-backup-{stamp}.db")
with dst:
    src.backup(dst)
print("wrote", f"parking-backup-{stamp}.db")
PY
```

`parking-backup-*.db` is not committed (keep backups outside the repo or add them to `.gitignore`).

**Restore:** stop the backend, then copy the backup over the database and start again.

```bash
cp parking-backup-20261106-110000.db parking.db
python -m uvicorn main:app --reload
```

**Start over instead:** `python seed.py` wipes the file's contents and loads the demo data.

## Azure demo (App Service)

The database is `/home/data/parking.db`. The demo re-seeds itself when the file is empty, so a
backup only matters if you have added data you want to keep. The built-in App Service backup
needs a higher plan tier than the demo's B1 (check the current Azure docs for your tier), so use the manual method.

**1. Make a consistent copy on the server**

```bash
az webapp ssh -n $APP -g $RG
# then, inside the container:
python - <<'PY'
import os, sqlite3, datetime
os.makedirs("/home/data/backups", exist_ok=True)
stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
src = sqlite3.connect("/home/data/parking.db")
dst = sqlite3.connect(f"/home/data/backups/parking-{stamp}.db")
with dst:
    src.backup(dst)
print("wrote", stamp)
PY
exit
```

**2. Download it** with the deployment credentials from the publish profile (the Kudu file
API maps `/home` to `/api/vfs/`):

```bash
USER=$(az webapp deployment list-publishing-profiles -n $APP -g $RG --query "[?publishMethod=='MSDeploy'].userName | [0]" -o tsv)
PASS=$(az webapp deployment list-publishing-profiles -n $APP -g $RG --query "[?publishMethod=='MSDeploy'].userPWD | [0]" -o tsv)
curl -u "$USER:$PASS" -o parking-backup.db "https://$APP.scm.azurewebsites.net/api/vfs/data/backups/parking-<stamp>.db"
```

Keep the downloaded file somewhere private: it contains user emails and password hashes.

**Restore on Azure:** stop the app (`az webapp stop`), upload the file over
`/home/data/parking.db` (Kudu `PUT` to `/api/vfs/data/parking.db` with the same credentials),
then `az webapp start`. Or simply delete `/home/data/parking.db` to go back to the fresh demo data.

## Moving beyond a demo

For real data use a managed database (Azure Database for PostgreSQL) with automatic backups and
point-in-time restore, see the last section of `AZURE_DEPLOY.md`.
