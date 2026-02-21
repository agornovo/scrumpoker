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
