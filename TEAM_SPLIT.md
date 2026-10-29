# Three-person task split

## Shared contract — agree first

All members use `ShipmentResult` from `src/lib/types.ts`. Do not create a second incompatible result interface. API contract is documented in `API_CONTRACT.md`.

## Person 1 — backend + TinyFish integration

Branch: `feat/tinyfish-backend`

Owns:
- `src/app/api/**`
- `src/lib/tinyfish/**`
- Backend failure handling and response normalization
- Real lookups and API tests

Checklist:
1. Verify the TinyFish key locally.
2. Test a valid reference on one carrier manually first.
3. Run one real agent query and check returned fields against the source page.
4. Keep secrets out of Git.
5. Report actual blockers; never fabricate an agent result.

## Person 2 — frontend and design

Branch: `feat/dashboard-ui`

Owns:
- `src/components/**`
- Pages and styling in `src/app/**` (coordinate around route files)
- Responsive behavior, loading states, and accessibility

Checklist:
1. Make the dashboard render with an empty history.
2. Check every navigation item and interactive button.
3. Use the shared types, not ad hoc incompatible shapes.
4. Verify loading, error, unavailable, and successful-result states.
5. Do not show fabricated activity totals.

## Person 3 — carriers, validation, QA, and demo

Branch: `feat/carrier-qa`

Owns:
- `src/lib/carriers.ts`
- `src/lib/validation.ts`
- Tests and docs (`CARRIER_TEST_CHECKLIST.md`, `DEMO_SCRIPT.md`)

Checklist:
1. Test the official carrier pages manually.
2. Record which tracking reference types and fields each page supports.
3. Choose two reliable carriers for the demo.
4. Run typecheck/lint/build and record failures.
5. Prepare one valid main demo reference and a backup, with authorization to use them.

## Integration in the hackathon

1. Pull the same `main` branch before starting.
2. Work only in your assigned feature branch.
3. Push and open a pull request rather than overwriting `main`.
4. Merge shared types/config early, then backend and frontend branches.
5. Run `npm run typecheck`, `npm run lint`, and `npm run build` after merges.
6. Verify one live reference end-to-end before adding more carrier integrations.

Do not commit `.env.local`. Share the setup instructions, not your API key. Each team member should use their own key unless the team has explicitly agreed on a secure shared secret-handling method.
