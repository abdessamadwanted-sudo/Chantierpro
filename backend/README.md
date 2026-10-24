# SiteTeam Backend Foundation — draft

This is an **isolated development scaffold**. It does not replace the existing Capacitor Android app and is not production-ready.

## Local verification
1. Install Node.js 20+.
2. `cd backend && npm install`
3. `npm run typecheck && npm run build`
4. `npm run start:dev`; GET `http://127.0.0.1:3000/api/v1/health`

## Security boundary
Only health endpoint is exposed. Do not add project/company/document endpoints until bearer tokens, tenant memberships, per-request authorization, audit logging and isolation tests are implemented.

## Next
Add reviewed PostgreSQL/Prisma schema, authorization policy tests, Firebase Admin verification, and migration plan for IndexedDB and Drive. Preserve the existing APK/OTA and signing path until migration tests pass.
