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

### What counts as a clean run

A run is clean only if the test **passed on its first attempt (no retry)** and the run **left no test data or state behind** (a cart, a user, a created record). The tests check this themselves in `afterEach`, so a leftover cart makes the test fail.

### The flaky test

The `@experimental` test (`user can sort products by price`) is **deliberately flaky**. It fails at random, about 4 times in 10, so you can see the model work. Two switches change that:

- `FLAKY_FAIL=true` forces it to fail (the pull request demo uses this).
- `STABILIZE_FLAKY=true` forces it to pass (the graduate demo uses this).

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

The graduate script runs the experimental tests, counts clean runs in a row (first-attempt pass, no retry, no leftover state), and changes a test's tag to `@stable` after 5 clean runs in a row.

```bash
# Local demo shortcut: 5 repeats in one go, with the flaky test forced to pass
npm run graduate:demo

# One run, counted locally in .graduation-history.json (not committed)
npm run graduate
```

The streak is saved only on your machine. No CI job runs the script, so this repo does not track a streak across CI builds.

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
- **`experimental` or `quarantine` are failing**: Those two jobs show as failed on the pull request, but the workflow run still finishes as a success and they are not required checks, so they do not stop the merge. (Seen on pull request #1: stable passed, the other two failed, the run was a success.)
- **`stable` is red**: The required check fails, and GitHub blocks the merge for people the branch rule applies to. Note: `enforce_admins` is off in this repo, so the repo owner can still merge. Turn it on if you want the rule to apply to admins too.

### Branch Protection Configuration

To enforce this gating model in GitHub:
1. Navigate to **Settings** > **Branches** > **Branch protection rules**.
2. Select or add a rule for `main`.
3. Check **Require status checks to pass before merging**.
4. Search for and check only the **`stable`** status check.
5. Leave `experimental` and `quarantine` unchecked.

---

## Honesty Note & Practice-Site Caveat

- **Repeat Shortcut Note**: Using `--repeat-each 5` in `npm run graduate:demo` is a local demonstration shortcut to simulate 5 passes quickly. The real rule needs 5 clean CI runs in a row, across separate builds over time.
- **Forced pass in the graduate demo**: `npm run graduate:demo` forces the flaky test to pass (`STABILIZE_FLAKY=true`), so it always graduates. That shows how promotion works. It does not show that the test became reliable.
- **Target Site Caveat**: This demo runs against `saucedemo.com` solely as a public web application target for testing workflows. It is not affiliated with the site, and the site is not described as official or free to use.
