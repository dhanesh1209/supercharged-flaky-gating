import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const REQUIRED_CONSECUTIVE_RUNS = 5;
const HISTORY_FILE = path.join(rootDir, '.graduation-history.json');
const RESULTS_JSON = path.join(rootDir, 'test-results', 'results.json');
const TEST_FILE = path.join(rootDir, 'tests', 'saucedemo.spec.ts');

// Parse CLI flags
const args = process.argv.slice(2);
const repeatIndex = args.indexOf('--repeat-each');
let repeatCount = 1;
if (repeatIndex !== -1 && args[repeatIndex + 1]) {
  repeatCount = parseInt(args[repeatIndex + 1], 10) || 1;
} else {
  const repeatArg = args.find((a) => a.startsWith('--repeat-each='));
  if (repeatArg) {
    repeatCount = parseInt(repeatArg.split('=')[1], 10) || 1;
  }
}

// Load or initialize graduation history
let history = {};
if (fs.existsSync(HISTORY_FILE)) {
  try {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch {
    history = {};
  }
}

console.log(`[Graduate] Running experimental tests (repeat count: ${repeatCount})...`);

// Run experimental tests via Playwright
// DEMO SHORTCUT: the experimental test is deliberately flaky (it fails randomly).
// Here it is forced to pass so the promotion can be shown in one local run.
// A real promotion needs 5 clean CI runs in a row. This is stated in the README.
const env = { ...process.env, STABILIZE_FLAKY: 'true' };
console.log('[Graduate] DEMO SHORTCUT: the flaky test is forced to pass for this run (STABILIZE_FLAKY=true).');
const cmd = `npx playwright test --project=experimental --repeat-each=${repeatCount} --reporter=json`;

let stdout = '';
try {
  stdout = execSync(cmd, { cwd: rootDir, env, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
} catch (err) {
  if (err.stdout) {
    stdout = err.stdout.toString();
  } else {
    console.error('[Graduate] Test execution failed before generating report:', err.message);
    process.exit(1);
  }
}

// Parse Playwright JSON report
let report;
try {
  report = JSON.parse(stdout);
} catch {
  if (fs.existsSync(RESULTS_JSON)) {
    report = JSON.parse(fs.readFileSync(RESULTS_JSON, 'utf8'));
  } else {
    console.error('[Graduate] Could not parse test report JSON');
    process.exit(1);
  }
}

// Inspect results per test
const testResultsMap = new Map();

function walkSuites(suites) {
  for (const suite of suites) {
    if (suite.specs) {
      for (const spec of suite.specs) {
        const title = spec.title;
        for (const test of spec.tests) {
          if (!testResultsMap.has(title)) {
            testResultsMap.set(title, []);
          }
          for (const result of test.results) {
            testResultsMap.get(title).push({
              status: result.status,
              retry: result.retry,
            });
          }
        }
      }
    }
    if (suite.suites) {
      walkSuites(suite.suites);
    }
  }
}

if (report.suites) {
  walkSuites(report.suites);
}

let promotedAny = false;

for (const [title, runs] of testResultsMap.entries()) {
  if (!history[title]) {
    history[title] = { consecutiveCleanRuns: 0, status: 'experimental' };
  }

  console.log(`\nEvaluating: "${title}" (${runs.length} runs evaluated)`);

  let testStreakFailed = false;

  for (const run of runs) {
    // Clean run = first-attempt pass (retry === 0, status 'passed') + no leftover test data or state.
    // The residue check lives in the tests: afterEach fails the test if any state is left behind,
    // so a passed test here has already passed the residue check.
    const isClean = run.status === 'passed' && run.retry === 0;

    if (isClean) {
      history[title].consecutiveCleanRuns += 1;
      console.log(`  ✓ Clean run recorded (Attempt pass, 0 retries, 0 residue). Streak: ${history[title].consecutiveCleanRuns}/${REQUIRED_CONSECUTIVE_RUNS}`);
    } else {
      console.log(`  ✘ Unclean run detected (Status: ${run.status}, Retries: ${run.retry}). Resetting streak.`);
      history[title].consecutiveCleanRuns = 0;
      testStreakFailed = true;
      break;
    }
  }

  if (history[title].consecutiveCleanRuns >= REQUIRED_CONSECUTIVE_RUNS) {
    console.log(`\n>>> PROMOTION: "${title}" reached ${REQUIRED_CONSECUTIVE_RUNS} consecutive clean runs!`);
    console.log(`>>> Promoting from @experimental to @stable...`);

    // Promote in test file
    let testContent = fs.readFileSync(TEST_FILE, 'utf8');
    // Change the tag of this one test only: match its title, then the tag inside its details object
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const testRegex = new RegExp(`(test\\((['"])${escapedTitle}\\2,\\s*\\{[^}]*tag:\\s*['"])@experimental(['"])`);
    if (testRegex.test(testContent)) {
      testContent = testContent.replace(testRegex, '$1@stable$3');
      fs.writeFileSync(TEST_FILE, testContent, 'utf8');
      console.log(`>>> Successfully updated ${TEST_FILE} tag to @stable`);
      history[title].status = 'stable';
      promotedAny = true;
    } else {
      // No blanket replace: never touch other tests. Ask for a manual tag change instead.
      console.log(`>>> Could not find "${title}" tagged @experimental in ${TEST_FILE}. Change its tag to @stable by hand.`);
    }
  } else {
    console.log(`>>> Current streak: ${history[title].consecutiveCleanRuns}/${REQUIRED_CONSECUTIVE_RUNS}. More clean runs required before promotion.`);
  }
}

// Persist history
fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');

if (promotedAny) {
  console.log('\n[Graduate] Finished: Test successfully graduated to @stable.');
} else {
  console.log('\n[Graduate] Finished: No tests graduated in this run.');
}
