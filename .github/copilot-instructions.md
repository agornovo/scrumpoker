# Copilot Agent Instructions

## CI Before PR Review

Always run `npm run test:unit` locally before calling `code_review` or finalizing any PR.
This mirrors what GitHub Actions CI runs (`ci.yml`): unit tests on Node 18.x, 20.x, and 24.x.

```bash
npm run test:unit
```

If unit tests pass, also verify E2E tests with:

```bash
npm run test:e2e
```

Only proceed to `code_review` and `codeql_checker` once all tests pass locally.

## Screenshots on Pull Requests

Always supply relevant screenshots on pull requests that include any UI or visual changes.
Take screenshots of all affected states (e.g. welcome screen, voting room, revealed results) and embed them in the PR description or commit them to `docs/screenshots/`.
This helps reviewers verify the visual impact without having to run the app.
