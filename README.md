# Supercharged Flaky Gating

A gating workflow demonstrating the Stable / Experimental / Quarantine test model using Playwright and GitHub Actions.

---

## 1. The Rule

Tests earn the right to block a merge. When every new test is immediately added to the required gating build, an unstable test blocks merges and drives teams to blindly re-run CI until it passes.

This model separates tests into three tiers:

- **`@stable`**: Proven tests that have demonstrated reliability.
  - Required CI check: **Blocks merges** if failing.
  - Retries: **1**.
  - Waits: Condition-based assertions only (no fixed sleeps).
  - State: Must clean up all created data so zero residues remain.
- **`@experimental`**: Newly added or candidate tests under observation.
  - Advisory CI check: **Cannot block merges** (`continue-on-error: true`).
  - Retries: **0**.
  - Graduation: Promoted to `@stable` only after **5 consecutive clean runs** (first-attempt pass, 0 retries, zero leftover state).
- **`@quarantine`**: Broken or problematic tests isolated from the main gate.
  - Advisory CI check: **Cannot block merges** (`continue-on-error: true`).
  - Retries: **0**.
  - Purpose: Isolates broken tests for future fixes without deleting them or ignoring build failures.

---

## 2. How to Run It

### Setup

```bash
npm install
npx playwright install --with-deps chromium
```

### Run Tests by Project

Run tests for specific projects locally:

```bash
# Run only stable tests (configured with 1 retry)
npm run test:stable

# Run experimental tests (configured with 0 retries)
npm run test:experimental

# Run quarantine tests (always fails; configured with 0 retries)
npm run test:quarantine

# Run all projects
npm test
```

### Run the Graduate Script

The graduate script monitors experimental test runs, records clean execution streaks (first-attempt pass, zero retries, zero leftover residue), and automatically promotes tests to `@stable` once 5 consecutive clean runs are reached.

```bash
# Local demo shortcut (runs 5 repetitions in one go)
npm run graduate:demo

# Single run check (for CI streak tracking)
npm run graduate
```

---

## 3. How to Read the Results

### GitHub Actions Pull Request Checks

When a pull request runs, GitHub Actions displays three parallel jobs:

| Job | Configuration | Required in Branch Protection | Can Block Merge? |
|---|---|---|---|
| `stable` | Standard execution | **Yes** | **Yes** |
| `experimental` | `continue-on-error: true` | No | No |
| `quarantine` | `continue-on-error: true` | No | No |

- **`stable` is green**: The pull request can be merged, even if `experimental` or `quarantine` are failing.
- **`experimental` or `quarantine` are failing**: The checks display with warning indicators on GitHub without failing the overall pull request check or blocking the merge button.
- **`stable` is red**: The pull request is blocked until the stable test suite passes.

### Branch Protection Configuration

To enforce this gating model in GitHub:
1. Navigate to **Settings** > **Branches** > **Branch protection rules**.
2. Select or add a rule for `main`.
3. Check **Require status checks to pass before merging**.
4. Search for and check only the **`stable`** status check.
5. Leave `experimental` and `quarantine` unchecked.

---

## Honesty Note & Practice-Site Caveat

- **Repeat Shortcut Note**: Using `--repeat-each 5` in `npm run graduate:demo` is a local demonstration shortcut to simulate 5 passes quickly. In production practice, the rule requires 5 clean runs in a row across independent CI builds over time.
- **Target Site Caveat**: This demo runs against `saucedemo.com` solely as a public web application target for testing workflows. It is not affiliated with the site, and the site is not described as official or free to use.
