import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for the neoipc-app end-to-end (e2e) suite.
 *
 * The suite runs against an **installed** app bundle served from the
 * DHIS2/nginx origin (production fidelity — not the `yarn start:dev`
 * proxy). Point it at a stack with `DHIS2_BASE_URL`; it defaults to the
 * local integration stack on port 8080.
 */
const baseURL = process.env.DHIS2_BASE_URL ?? 'http://localhost:8080'

/**
 * Single source of truth for the browser engines under test — the three
 * independent engine cores (Blink / Gecko / WebKit). Adding or removing an
 * engine is a one-token edit here; the `projects` below are derived from
 * this list, so there are no copy-pasted per-engine blocks. Pick one with
 * `npx playwright test --project=<name>`, as `e2e/README.md` shows.
 *
 * Residual gap: Playwright's `webkit` is the WebKit engine core run
 * cross-platform, not shipping Safari.
 */
const ENGINES = ['chromium', 'firefox', 'webkit'] as const
const DEVICE: Record<(typeof ENGINES)[number], string> = {
    chromium: 'Desktop Chrome',
    firefox: 'Desktop Firefox',
    webkit: 'Desktop Safari',
}

export default defineConfig({
    testDir: './e2e',
    // 90 s lets a browser-side hang fail fast, with a retained trace. A backend
    // render (Quarto/R via NeoIPC-Reporting) can take longer than a test has
    // left, so the render helpers in e2e/report-actions.ts give their wait time
    // of its own, up to RENDER_TIMEOUT, and the rest of the test keeps its 90 s.
    timeout: 90 * 1000,
    // In CI, the whole suite stops after an hour, so that renders that hang
    // test after test, each of which may wait up to RENDER_TIMEOUT, end the run
    // with its report rather than outlast the CI job running it. A run stopped
    // so skips its global teardown, which a CI stack, discarded with its job,
    // does not need.
    globalTimeout: process.env.CI ? 60 * 60 * 1000 : 0,
    expect: { timeout: 30 * 1000 },
    // One worker, no intra-file parallelism: every engine shares one DHIS2
    // substrate and the singleton validation-exceptions resource, so admin
    // CRUD is the binding constraint and tests must not race.
    workers: 1,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    reporter: [['list'], ['html', { open: 'never' }]],
    // One-time, engine-independent setup: install the app bundle, assert the
    // seed is present, upload the reference-dataset fixture (teardown deletes
    // it). Per-user login → storageState is the `setup` project below.
    globalSetup: './e2e/global-setup.ts',
    globalTeardown: './e2e/global-teardown.ts',
    use: {
        baseURL,
        // Pin the browser locale so what still follows it is deterministic. Once
        // the report's language list has loaded, a blank report language makes
        // the app send the DHIS2 interface language where the report is
        // available in it, and English otherwise; DHIS2 answers the
        // interface-language setting from the instance default for a user who
        // has none, so the browser decides a rendered report's language only
        // when that list fails to load. It always decides the Partner Report's
        // JSON download, which sends no language and is negotiated from
        // Accept-Language. en-GB is a served report locale.
        locale: 'en-GB',
        trace: 'retain-on-failure',
        video: 'retain-on-failure',
        // Local DHIS2 dev stacks commonly serve a self-signed cert on https.
        ignoreHTTPSErrors: true,
    },
    projects: [
        // Mints a per-user JSESSIONID session via DHIS2 form-login and saves
        // it as storageState; every engine project depends on it.
        { name: 'setup', testMatch: /auth\.setup\.ts/ },
        ...ENGINES.map((name) => ({
            name,
            use: { ...devices[DEVICE[name]] },
            dependencies: ['setup'],
        })),
    ],
})
