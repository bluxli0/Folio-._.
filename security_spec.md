# Firestore Security Rules Specification

## 1. Data Invariants
- Every user profile document at `/users/{userId}` can only be read, created, updated, or deleted by the verified authenticated user matching `userId == request.auth.uid`.
- Every custom instruction at `/users/{userId}/instructions/{instructionId}` must belong to its parent `{userId}` (`ownerId == request.auth.uid == userId`), enforce a valid ID regex (`^[a-zA-Z0-9_\\-]+$`), verify parent profile existence via `exists(/databases/$(database)/documents/users/$(userId))`, and enforce immutable `ownerId` and `createdAt`.
- Every custom function tool at `/users/{userId}/tools/{toolId}` must belong to `{userId}`, validate tool name regex (`^[a-zA-Z_][a-zA-Z0-9_]*$`), enforce strict string length limits, and prohibit shadow fields via `hasOnly()`.
- All `list` operations explicitly verify `resource.data.ownerId == request.auth.uid` without issuing `get()` or `exists()` reads.
- `test/connection` document allows authenticated or health-check get only? Wait: test connection catches permission-denied cleanly or is denied by catch-all — per guidelines `allow read, write: if false` global safety net covers unknown collections, and `testConnection()` uses `getDocFromServer` expecting network reachability rather than offline error.

## 2. Dirty Dozen Adversarial Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read on `/users/user_123`
2. Authenticated non-owner (`uid: attacker`) `get` on `/users/user_123` (PII protection)
3. Unverified email (`email_verified: false`) `create` on `/users/user_123`
4. Shadow field injection (`isAdmin: true`) in `/users/user_123` `create`
5. Spoofed `uid` (`uid: "other_uid"`) inside `/users/user_123` `create`
6. Forged client `createdAt` timestamp not equal to `request.time`
7. Updating immutable `createdAt` or `uid` on `/users/user_123`
8. Value poisoning with 50KB `displayName` string on `/users/user_123`
9. Malicious oversized document ID (`> 128 chars`) on `/users/{userId}/instructions/{longId}`
10. Creating instruction without parent `/users/{userId}` document existing
11. Invalid function tool name containing spaces or dashes (`"bad tool!"`)
12. Cross-tenant `list` attempt by querying `/users/victim/tools` as `attacker`
