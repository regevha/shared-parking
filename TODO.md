# TODO: Advanced Testing & Refinements (v2.0+)

The following test suites and refinements are recommended to further harden the system against extreme edge cases and ensure long-term stability.

## 🧪 Upcoming Test Suites

### 1. 🕒 Stress-Testing 24/7 Conflict Logic
- [ ] **DST (Daylight Saving Time)**: Verify no segments are lost or double-booked during the "spring forward" (loss of 1h) or "fall back" (gain of 1h) transitions.
- [ ] **The "36-Hour Wall"**: Add strict negative tests for 36h 1m payloads to ensure rejection (already handled in Pydantic, but need deeper integration test).
- [ ] **Tight Segment Transitions**: Verify a request ending at 12:00:00 and another starting at 12:00:00 on the same lot do not conflict.

### 2. 🛡️ Scheduler & Concurrency
- [ ] **Resource Starvation**: Simulate a full lot with 35-hour bookings and verify the scheduler handles 1-hour voids efficiently.
- [ ] **Race Conditions**: Verify `run-auto-approve` locking when called by two managers simultaneously.
- [ ] **Bulk Submission Stress**: Submit 100+ overlapping requests for a single lot and verify scheduler stability.

### 3. 🌐 Internationalization & UX
- [ ] **Visual RTL Audit**: Automated screenshot tests for the mobile layout in Hebrew (specifically the `MyRequests` stats alignment).
- [ ] **I18n Translation Completeness**: Integrate `scripts/check_i18n.py` into the CI/CD pipeline to block PRs with missing keys.

### 4. 📜 Audit Trail Extensions
- [ ] **Detailed Diffs**: In `AuditLog`, store the specific fields that were updated (e.g., "Duration changed from 2h to 4h").
- [ ] **Bulk Management Hub**: A manager-only view for the entire system's audit trail, searchable by date range.

## 🛠️ Refactor Ideas
- [ ] **Native Date Handling**: Migrate all ISO strings to native `DateTime` objects in the Database layer if we move away from SQLite.
- [ ] **Real-time Notifications**: Replace polling with WebSockets for immediate approval/rejection alerts.
