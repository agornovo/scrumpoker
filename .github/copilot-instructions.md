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

## Merge Conflicts

Before finalizing any PR, always check whether the base branch (`main`) has moved ahead of the PR branch.
If it has, merge the base branch into the PR branch and resolve any conflicts automatically, keeping both sides of any non-overlapping changes.

```bash
git fetch origin main
git merge FETCH_HEAD --no-edit
```

Resolve any conflict markers (keeping both feature changes where appropriate), then run tests to confirm nothing is broken, and commit the merge via `report_progress`.

Only proceed to `code_review` and `codeql_checker` once all tests pass locally.

## Screenshots on Pull Requests

Always supply relevant screenshots on pull requests that include any UI or visual changes.
Take screenshots of all affected states (e.g. welcome screen, voting room, revealed results) and embed them in the PR description or commit them to `docs/screenshots/`.
This helps reviewers verify the visual impact without having to run the app.
