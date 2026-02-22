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

## README Must Stay Current

Whenever you add, change, or remove a feature, **always update `README.md`** in the same PR to reflect the new state:

- Add new features to the **Features** list.
- Update the **Card Values** table, **How to Use** steps, or any other section that describes the changed behaviour.
- Replace the screenshots in `docs/screenshots/` with fresh ones that show the new UI, and update any image references in `README.md`.
- Keep the **Prerequisites** Node.js version and the **Continuous Integration** node matrix in sync with `.github/workflows/ci.yml`.
