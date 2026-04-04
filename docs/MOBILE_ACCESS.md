# Accessing the App from a Phone or Tablet (Local Network)

Both the frontend and backend are configured to listen on **all network interfaces**,
so any device on the same WiFi as your development machine can reach them.

---

## Step 1 — Find your machine's LAN IP

**Windows**
```
ipconfig
```
Look for the **IPv4 Address** under your active adapter (usually "Wireless LAN adapter Wi-Fi"):
```
IPv4 Address. . . . . . . . . . . : 192.168.1.42
```

**macOS / Linux**
```bash
ip addr   # Linux
ifconfig  # macOS
```

---

## Step 2 — Start the servers

### Backend (binds to 0.0.0.0 by default via uvicorn)
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0
```

### Frontend (binds to 0.0.0.0 via HOST env var in .env)
```bash
npm start
```
The `.env` file at the project root already sets `HOST=0.0.0.0`.

---

## Step 3 — Open on your phone

On your phone's browser, go to:

| What | URL |
|------|-----|
| Frontend app | `http://<LAN-IP>:3000` |
| Backend API (Swagger) | `http://<LAN-IP>:8000/docs` |

**Example** (if your LAN IP is `192.168.1.42`):
- App → `http://192.168.1.42:3000`
- API → `http://192.168.1.42:8000/docs`

---

## Step 4 — Configure Windows Firewall (If necessary)

If the app fails to load or API calls fail with "Network Error" or "Failed to fetch", your computer's firewall is likely blocking local traffic. You must allow traffic on ports `3000` (React) and `8000` (FastAPI).

Open an **elevated PowerShell** (Run as Administrator) and run:

```powershell
New-NetFirewallRule -DisplayName "Shared Parking - React Dev (3000)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000
New-NetFirewallRule -DisplayName "Shared Parking - API (8000)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000
```

---

## Notes

- Both devices must be on the **same WiFi network**.
- **CORS is handled automatically**: In development, the backend automatically allows all origins (`*`) unless explicitly overridden with the `CORS_ORIGINS` env var, so LAN access works out of the box.
- **Dynamic API Host**: The frontend automatically uses the hostname the browser loaded (`window.location.hostname`), meaning both `localhost` and your LAN IP will resolve the backend appropriately on port `8000`.
