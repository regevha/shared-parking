# TODO: Advanced Testing & Refinements (v2.0+)

The following test suites and refinements are recommended to further harden the system against extreme edge cases and ensure long-term stability.

## 🧪 Upcoming Test Suites

### 1. 🕒 Stress-Testing 24/7 Conflict Logic
- [x] **DST (Daylight Saving Time)**: Partially Verified. Demonstrated with `test_dst.py` that current naive math incorrectly handles the "spring forward" jump (02:00 -> 03:00), leading to 1h duration error. Higher priority for refactor.
- [ ] **The "36-Hour Wall"**: Add strict negative tests for 36h 1m payloads to ensure rejection (already handled in Pydantic, but need deeper integration test).
- [ ] **Tight Segment Transitions**: Verify a request ending at 12:00:00 and another starting at 12:00:00 on the same lot do not conflict.

### 2. 🛡️ Scheduler & Concurrency
- [ ] **Resource Starvation**: Simulate a full lot with 35-hour bookings and verify the scheduler handles 1-hour voids efficiently.
- [ ] **Race Conditions**: Verify `run-auto-approve` locking when called by two managers simultaneously.
- [ ] **Bulk Submission Stress**: Submit 100+ overlapping requests for a single lot and verify scheduler stability.

### 3. 🌐 Internationalization & UX
- [ ] **Visual RTL Audit**: Automated screenshot tests for the mobile layout in Hebrew (specifically the `MyRequests` stats alignment).
- [ ] **I18n Translation Completeness**: Integrate `scripts/check_i18n.py` into the CI/CD pipeline to block PRs with missing keys.
- [ ] **Rest of Screens UX Review**: Perform detailed UX audits and proposal reports for the remaining 11 screens (MyRequests, RequestDetail, CalendarView, etc.).

### 4. 📜 Audit Trail Extensions
- [ ] **Detailed Diffs**: In `AuditLog`, store the specific fields that were updated (e.g., "Duration changed from 2h to 4h").
- [ ] **Bulk Management Hub**: A manager-only view for the entire system's audit trail, searchable by date range.

### 5. 👑 Admin Dashboard (UX Refactor)
- [ ] **Visual Lot Map**: Replace the flat table with a grid-based floor map for ownership assignment.
- [ ] **Import Staging Area**: Add a preview/validation step before Excel data is committed to the DB.
- [ ] **Interactive System Config**: Move backend constants (e.g., `blackoutLimit`) to UI-editable settings.
- [ ] **User Search & Bulk Actions**: Add a search bar and batch role updates (e.g., "Set 5 users to Owner").

### 6. 🕒 Pending Requests (Owner UX)
- [ ] **Conflict Highlighting**: Visually tag overlapping requests for the same lot/time to prevent double-booking.
- [ ] **Visual Timeline Mini-Bars**: Add a horizontal 24h bar in each row to visualize the requested segment.
- [ ] **Bulk Approval/Rejection**: Add checkboxes and batch actions ("Approve All Selected").
- [ ] **Mobile Swipe Actions**: Implement intuitive swipe-to-approve/reject on mobile card views.

### 7. 🔐 Security & Hardening
- [ ] **Full Security Review**: Perform a dedicated audit of JWT handling, RBAC decorators, and SQL injection prevention.
- [ ] **Rate Limiting**: Implement API rate limiting to protect against brute-force and DDoS.
- [ ] **Vulnerability Scanning**: Set up automated dependency scanning (e.g., Snyk or GitHub Dependabot).

## 🧹 Technical Debt & Clean Up (v2.1)
- [ ] **Deep Hardcoding Scan**: Perform a recursive scan of the entire codebase (frontend/backend) to identify remaining hardcoded business rules (limits, timeouts, URLs) and move them to `.env` or shared constant files.
- [x] **API Logic Clean Up**: Use Enums consistently across all backend routers (e.g., `UserRole`, `RequestStatus`, `LotStatus`).
- [ ] **DST-Aware Refactor**: Complete the migration of the backend to timezone-aware `datetime` objects to resolve the failing `test_dst.py` test cases.

## 🌐 Pending i18n Work
- [ ] **Notification message i18n**: Backend approval/rejection notification messages are currently English-only hardcoded strings. Migrate to i18n-aware messages (e.g. store a message key + params, render translated in the frontend).

## 🗓️ New Features
- [x] **Available Timeslots View**: Implemented as "Available Slots" filter in the Lot Calendar screen.

## 🏗️ Refactor Ideas
- [ ] **Lot-Specific Availability**: Migrate `notificationWindows` and `availabilityWindows` from `User` to `Lot` objects to allow granular control.
- [ ] **Native Date Handling**: Migrate all ISO strings to native `DateTime` objects in the Database layer if we move away from SQLite.
- [ ] **Real-time Notifications**: Replace polling with WebSockets for immediate approval/rejection alerts.

## 🏗️ Infrastructure & Hardening (Final MVP Sprint) — COMPLETED ✅
- [x] **Secret Management (.env)**: Move `SECRET_KEY` and other hardcoded constants to a protected `.env` file.
- [x] **Backend Logging**: Implement standardized Python logging for better debuggability.
- [x] **Cancellation Policy**: Implement business rule logic (e.g., "Cannot cancel within 2h of start").
- [x] **Notification Hub**: Add a simple UI notification bell/counter for status changes.
- [x] **Hardcoding Audit**: Scan the entire codebase and generate a report of all hardcoded strings and constants that should be externalized.
- [x] **Critical Hardcoding Fixes**: Refactored major backend/frontend components to use shared Enums and Envs.
- [x] **Dev Containers**: Defined `.devcontainer` configuration to standardize the development environment.
- [x] **RBAC & Session Lifecycle**: Migrated to centralized AuthProvider, implemented robust route guards in App.tsx and AdminPanel.tsx, and fixed the logout URL state leak.
- [x] **Test Suite Hardening**: Added matchMedia mocks for Ant Design and refactored tests to use `renderWithProviders` for consistent state injection.
