# Quick start for the team

## Run it locally

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` and add the TinyFish key you obtain from <https://agent.tinyfish.ai/api-keys>:

```env
TINYFISH_API_KEY=paste_your_own_key_here
```

Then run:

```bash
npm run dev
```

Open <http://localhost:3000>.

## First thing to test

1. Open `Track shipment`.
2. Select Maersk.
3. Enter a valid tracking reference you are authorized to access.
4. Click `Track shipment`.
5. Check the result against the official carrier page.
6. Repeat with MSC only after you have confirmed a valid, public reference.

If you see `TinyFish is not configured`, check `.env.local` and restart `npm run dev`. If the carrier requires login, is blocked, or cannot find the reference, use another verified test case; do not make up data.

## Put it on GitHub

Create one empty repository on GitHub, then run from this project directory:

```bash
git init
git add .
git commit -m "Initial Global Freight Command Center"
git branch -M main
git remote add origin https://github.com/Abpattar/Navora.git
git push -u origin main
```

Add your team members as collaborators on GitHub. Never add `.env.local` to GitHub.

## Divide work

- Member 1: `src/lib/tinyfish/**` and `src/app/api/**` — TinyFish/backend.
- Member 2: `src/components/**`, `src/app/globals.css`, and coordinated page styling — interface.
- Member 3: `src/lib/carriers.ts`, `src/lib/validation.ts`, tests, and the carrier checklist — source verification/QA.

Before splitting work, agree to the shared `ShipmentResult` model in `src/lib/types.ts`. Commit each person's work on a separate branch. Merge the working backend and frontend only after the data contract matches.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
