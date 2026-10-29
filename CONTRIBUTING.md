# Contributing

## Start here

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd global-freight-command-center
npm install
cp .env.example .env.local
```

Add your own TinyFish key in `.env.local` only if you need to run real lookups.

## Branch workflow

```bash
git checkout main
git pull
git checkout -b feat/your-task
# edit your assigned files
git add <specific-files>
git commit -m "Describe the change"
git push -u origin feat/your-task
```

Open a pull request on GitHub and request another teammate to review it. Do not commit directly to `main` unless the team explicitly agrees.

## Before merging

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The live TinyFish test needs a valid API key and a reference the tester is authorized to access. If the lookup can't be run in CI, state that clearly; do not replace it with fabricated success data.

## File ownership

See [TEAM_SPLIT.md](./TEAM_SPLIT.md). Coordinate before modifying shared API types, route response contracts, or carrier IDs.
