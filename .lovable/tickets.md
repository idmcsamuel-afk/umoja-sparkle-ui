# Cleanup tickets (deferred)

## TND-CLEAN-1 — claim_signup_bonus fires 3x per page load
Logged 2026-08-11. Not part of the Tenders workstream.
On a single /tenders load, rpc/claim_signup_bonus is called three times (useAuth getSession path + onAuthStateChange path + spark widgets). Idempotent and harmless, but noisy. Fix later by hoisting the call behind a single module-level guard in useAuth.
