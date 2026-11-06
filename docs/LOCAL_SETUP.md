# Running the app locally

Works on Windows (PowerShell or Git Bash), macOS, Linux and **WSL**. WSL specifics and phone
access from WSL are in their own sections below. For a deployed demo see `AZURE_DEPLOY.md`.

## Prerequisites

- **Python 3.11+** (the README's minimum; Ubuntu 22.04 ships 3.10, so add 3.11 from the
  deadsnakes PPA or use Ubuntu 24.04)
- **Node.js 18+** (22 recommended; CI uses 22)
- Git

## Quick start (any OS)

```bash
git clone https://github.com/regevha/shared-parking.git
cd shared-parking
cp .env.example .env            # includes a local SECRET_KEY; the backend won't start without one
```

**Backend** (first terminal)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python seed.py                  # creates/resets parking.db with demo data
python -m uvicorn main:app --reload
```

API: http://localhost:8000 (docs at http://localhost:8000/docs).

**Frontend** (second terminal, project root)

```bash
npm install
npm start                       # opens http://localhost:3000
```

**Sign in** with `sarah@parking.dev` (owner), `mike@parking.dev` (owner) or `admin@parking.dev`
(manager), password `password123`. To try the plain user role, register a new account; the
password needs an uppercase letter and a digit (e.g. `Parking123`).

Reset the demo data any time with `python seed.py`. Stop both servers with `Ctrl+C`, or run
`bash stop.sh` to free ports 3000 and 8000.

## WSL (Ubuntu)

```bash
sudo apt update
sudo apt install -y git python3 python3-venv python3-pip curl
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
```

Then follow the quick start above, with these WSL rules:

- **Clone into the Linux filesystem** (`~/shared-parking`), never under `/mnt/c/...`. Installs are
  much slower on the Windows drive and file watching (hot reload) often stops working there.
- **Use a virtual environment.** Ubuntu 24.04 refuses `pip install` into the system Python.
- Use `BROWSER=none npm start` so it doesn't try to open a Linux browser.
- Open **http://localhost:3000 from your Windows browser**. WSL forwards localhost automatically.

## Testing on a phone (same Wi-Fi)

Also see `MOBILE_ACCESS.md` for the step-by-step with firewall rules.

1. Find your computer's LAN IP (`ipconfig` on Windows, `ip addr` on Linux).
2. **Allow that origin in CORS.** The backend only accepts `http://localhost:3000` by default,
   so a phone at `http://192.168.x.x:3000` is blocked until you add it:

   ```bash
   CORS_ORIGINS=http://192.168.1.23:3000 python -m uvicorn main:app --host 0.0.0.0 --reload
   ```
   PowerShell: `$env:CORS_ORIGINS = "http://192.168.1.23:3000"` first.
3. Open `http://192.168.1.23:3000` on the phone. The frontend calls the backend on the same
   host, port 8000, automatically.
4. If it won't load, allow ports 3000 and 8000 in Windows Firewall (commands in `MOBILE_ACCESS.md`).

### Phone access when running in WSL

The phone reaches Windows, and Windows has to pass the traffic to WSL. Pick one:

- **Mirrored networking (Windows 11 22H2+), easiest.** Put this in `C:\Users\<you>\.wslconfig`:
  ```
  [wsl2]
  networkingMode=mirrored
  ```
  Run `wsl --shutdown` in PowerShell and reopen WSL. WSL now shares the Windows IP, so use that
  IP in steps 1-3 above.
- **Port forwarding.** In an administrator PowerShell (use the address from `wsl hostname -I`):
  ```powershell
  netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=<WSL-IP>
  netsh interface portproxy add v4tov4 listenport=8000 listenaddress=0.0.0.0 connectport=8000 connectaddress=<WSL-IP>
  ```
  The WSL IP changes after a restart, so repeat when it does. Remove with
  `netsh interface portproxy reset`.

## Tests and lint

```bash
cd backend && pip install -r requirements-test.txt
pytest tests/ -v                 # backend
ruff check .                     # backend lint
cd .. && npm test                # frontend (CI=true npm test -- --ci --watchAll=false for a single run)
npm run lint                     # frontend lint
```

Browser accessibility checks (Playwright + axe) need both servers running and a seeded
database, see `e2e/README.md`.

## Backups

See `BACKUP.md` for a safe backup and restore of `parking.db` (local and Azure).

## Troubleshooting

| Problem | Cause / fix |
|---------|-------------|
| `SECRET_KEY environment variable is not set` | Run `cp .env.example .env` in the project root, or `export SECRET_KEY=...` |
| Phone loads the page but data fails / "Network Error" | CORS: start the backend with `CORS_ORIGINS=http://<LAN-IP>:3000` |
| Phone can't load the page at all | Firewall (ports 3000/8000), different Wi-Fi network, or WSL networking (see above) |
| `externally-managed-environment` from pip | Use the virtual environment |
| Hot reload does nothing in WSL | Project is under `/mnt/c`; move it to `~` |
| `Address already in use` | `bash stop.sh` |
| Language resets to English after login | Fixed in PR #95; update to the latest `master` |
