"""Take screenshots of every screen in dark mode for the review document."""
import time
from playwright.sync_api import sync_playwright

API   = "http://localhost:8000"
APP   = "http://localhost:3000"
OUT   = r"C:\Dev\AI\ClaudeCode\shared-parking\docs\screenshots"

ACCOUNTS = {
    "alice": "alice@parking.dev",
    "sarah": "sarah@parking.dev",
    "admin": "admin@parking.dev",
}

def login(page, email):
    resp = page.request.post(
        f"{API}/auth/login",
        form={"username": email, "password": "password123"},
    )
    token = resp.json()["access_token"]
    page.evaluate(f"localStorage.setItem('parking_token', '{token}')")
    return token

def shot(page, name, url, wait_ms=1200):
    page.goto(url)
    page.wait_for_timeout(wait_ms)
    page.screenshot(path=f"{OUT}\\{name}.png", full_page=True)
    print(f"  saved {name}.png")

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        page = ctx.new_page()

        # ── 1. Login page (unauthenticated) ──────────────────────────────
        page.goto(APP)
        page.wait_for_timeout(800)
        page.screenshot(path=f"{OUT}\\01_login.png", full_page=True)
        print("  saved 01_login.png")

        # ── User screens (Alice) ──────────────────────────────────────────
        page.goto(APP)
        login(page, ACCOUNTS["alice"])
        shot(page, "02_my_requests",      f"{APP}/my-requests")
        shot(page, "03_new_request",      f"{APP}/submit-request")
        shot(page, "04_requests_view",    f"{APP}/calendar")
        shot(page, "05_request_detail",   f"{APP}/request/REQ-001", wait_ms=1500)

        # ── Owner screens (Sarah) ─────────────────────────────────────────
        login(page, ACCOUNTS["sarah"])
        shot(page, "06_pending_requests", f"{APP}/pending")
        shot(page, "07_approvals",        f"{APP}/approvals")
        shot(page, "08_parking_status",   f"{APP}/lot-status")
        shot(page, "09_lot_calendar",     f"{APP}/lot-calendar")
        shot(page, "10_my_lots",          f"{APP}/my-lots")

        # ── Manager screen (Admin) ────────────────────────────────────────
        login(page, ACCOUNTS["admin"])
        shot(page, "11_admin_panel",      f"{APP}/admin")

        browser.close()
    print("All done.")

if __name__ == "__main__":
    run()
