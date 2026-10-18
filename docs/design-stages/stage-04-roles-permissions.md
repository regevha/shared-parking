# Stage 4 — Role & Permission Matrix

Comprehensive permissions view, cross-referenced with backend guards and frontend route-visibility logic.

## Role Definitions

| Role | Description | Inherits From |
|---|---|---|
| `user` | Default role. Submits parking requests; cannot approve or administer. | — |
| `owner` | Owns one or more lots; approves/rejects requests; manages own lots and availability. | `user` |
| `manager` | System administrator. Full control over users, lots, requests, notifications. | `owner` |

Backend guards live in `auth.py`:
- `get_current_user` — any authenticated caller.
- `require_owner` — allows `owner` OR `manager`.
- `require_manager` — allows `manager` only.

Frontend route visibility is driven in `App.tsx` from `user.role`; the menu is built conditionally.

## Consolidated Permission Matrix

### Requests
| Action | User | Owner | Manager |
|---|---|---|---|
| Create request | ✓ | ✓ | ✓ |
| View own requests (`/me`) | ✓ | ✓ | ✓ |
| View all pending (`/pending`) | ✓ | ✓ | ✓ |
| View all approved (`/approved`) | ✓ | ✓ | ✓ |
| View all requests (all statuses) | ✗ | ✗ | ✓ |
| Approve | ✗ | ✓ | ✓ |
| Reject | ✗ | ✓ | ✓ |
| Edit own pending | ✓ | ✓ | ✓ |
| Cancel own — pending | ✓ | ✓ | ✓ |
| Cancel own — approved (within window) | ✗ | ✗ | ✓ |
| Cancel own — approved (outside window) | ✓ | ✓ | ✓ |
| View audit trail — own request | ✓ | ✓ | ✓ |
| View audit trail — involved lot owner | — | ✓ | ✓ |
| View audit trail — any pending request | — | ✓ | ✓ |
| View audit trail — any request any status | ✗ | ✗ | ✓ |
| Trigger auto-approval manually | ✗ | ✗ | ✓ |

### Lots
| Action | User | Owner | Manager |
|---|---|---|---|
| List all lots | ✓ | ✓ | ✓ |
| List own lots (`/mine`) | — | ✓ | ✓ |
| Create lot | ✗ | ✗ | ✓ |
| Update lot status on own lot | — | ✓ | ✓ |
| Update `blocked_until` on own lot | — | ✓ | ✓ |
| Reassign lot ownership | ✗ | ✗ | ✓ |
| Update any lot | ✗ | ✗ | ✓ |
| Delete lot | ✗ | ✗ | ✓ |

### Users
| Action | User | Owner | Manager |
|---|---|---|---|
| List all users | ✗ | ✗ | ✓ |
| View own profile (`/me`) | ✓ | ✓ | ✓ |
| View any profile by ID | self only | self only | ✓ |
| Update own name / email / password | ✓ | ✓ | ✓ |
| Update own role | ✗ | ✗ | — (via manager) |
| Update any user | ✗ | ✗ | ✓ |
| Delete any user | ✗ | ✗ | ✓ |
| Delete self | ✗ | ✗ | ✗ |
| Register new account | public endpoint | public | public |

### Preferences
| Action | User | Owner | Manager |
|---|---|---|---|
| Read own preferences | ✓ | ✓ | ✓ |
| Update own preferences | ✓ | ✓ | ✓ |
| Read another user's preferences | ✗ | ✗ | ✓ |
| Update another user's preferences | ✗ | ✗ | ✓ |

### Messages
| Action | User | Owner | Manager |
|---|---|---|---|
| Read thread on own request | ✓ | ✓ | ✓ |
| Post to own request | ✓ | ✓ | ✓ |
| Read thread on any request | ✗ | ✓ | ✓ |
| Post to any request | ✗ | ✓ | ✓ |

### Notifications
| Action | User | Owner | Manager |
|---|---|---|---|
| List own notifications | ✓ | ✓ | ✓ |
| Mark own as read | ✓ | ✓ | ✓ |
| Broadcast | ✗ | ✗ | ✓ |

### Admin / System
| Action | User | Owner | Manager |
|---|---|---|---|
| Read system config | ✓ | ✓ | ✓ |
| CSV import — users | ✗ | ✗ | ✓ |
| CSV import — lots | ✗ | ✗ | ✓ |

## Frontend Screen Visibility

| Screen | User | Owner | Manager |
|---|---|---|---|
| LotStatusBoard (`/lot-status`) | ✓ | ✓ | ✓ |
| CalendarView (`/calendar`) | ✓ | ✓ | ✓ |
| AllPendingRequests (`/pending`) | ✓ | ✓ | ✓ |
| AllApprovals (`/approvals`) | ✓ | ✓ | ✓ |
| MyRequests (`/my-requests`) | ✓ | ✓ | — (hidden for manager) |
| ParkingRequestForm (`/submit-request`) | ✓ | ✓ | ✓ |
| RequestDetail (`/request/:id`) | ✓ | ✓ | ✓ |
| MyLots (`/my-lots`) | ✗ | ✓ | ✗ |
| LotCalendarView (`/lot-calendar`) | ✗ | ✓ | ✓ |
| AdminPanel (`/admin`) | ✗ | ✗ | ✓ |
| AvailabilityWindows (`/availability`) | ✓ | ✓ | ✓ |
| NotificationWindows (`/notifications`) | ✓ | ✓ | ✓ |

Note: "MyRequests" is intentionally hidden from managers in `App.tsx` because the manager workflow is admin-focused; managers still *can* submit requests but use a different entry point.

## Authorization Cross-Cuts

- **Self-vs-other checks**: Users, preferences, and audit-trail lookups all implement "self OR manager" logic; ownership is asserted from `current_user.id`.
- **Ownership derivation**: Lot ownership uses `owner_id`; request ownership uses `requester_id`; involved-owner on audit uses `lot_owner` name (denormalised).
- **Edit guards**: Editing a request requires both `requester_id == current_user.id` AND `status == pending`.
- **Cancellation window**: 2 h before start, enforced only on approved requests and bypassed for managers.
- **Public endpoints**: `POST /auth/register`, `POST /auth/login`, `GET /` (root status).

## Known Authorization Gaps & Notes (for architect review)
- Rejection endpoint does not explicitly enforce "only pending can be rejected"; relies on UI.
- No endpoint to cancel another user's request administratively — managers currently have no dedicated path (can DELETE via direct API call but UI doesn't expose it broadly).
- Owner broadcast permission is not supported — intentional design choice, managers only.
