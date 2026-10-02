import path from 'node:path'

/**
 * Password set on every synthetic play user by the seed (the NeoIPC
 * workspace's `Initialize-TestDhis2.ps1 -PlayUserPassword`, default
 * `NeoIPC-Play1`).
 * Override with `PLAY_USER_PASSWORD` to match a non-default seed.
 */
export const PLAY_USER_PASSWORD = process.env.PLAY_USER_PASSWORD ?? 'NeoIPC-Play1'

/**
 * Directory holding the per-user `storageState` JSON minted by
 * `auth.setup.ts`. Git-ignored — each file carries a live JSESSIONID.
 */
export const AUTH_DIR = path.join(__dirname, '.auth')

export interface E2EUser {
    /** Stable key the specs use to select this user. */
    key: 'superadmin' | 'atReport' | 'chReport'
    /** DHIS2 username, as seeded into the play package. */
    username: string
    /** Path to this user's saved `storageState` (its JSESSIONID session). */
    storageState: string
}

/**
 * The three e2e personas, disjoint by authority and org-unit scope:
 *  - `superadmin` — `play.admin` (Superuser / `ALL`): every nav item, admin CRUD.
 *  - `atReport`   — `play.at.report1` (ReportViewer, scoped to `AT_TEST_TEST`):
 *    report-only nav, sees only the AT department in the picker.
 *  - `chReport`   — `play.ch.report1` (ReportViewer, scoped to `CH_TEST_TEST`):
 *    the disjoint counterpart that proves per-user picker scoping.
 */
export const USERS: E2EUser[] = [
    {
        key: 'superadmin',
        username: 'play.admin',
        storageState: path.join(AUTH_DIR, 'play.admin.json'),
    },
    {
        key: 'atReport',
        username: 'play.at.report1',
        storageState: path.join(AUTH_DIR, 'play.at.report1.json'),
    },
    {
        key: 'chReport',
        username: 'play.ch.report1',
        storageState: path.join(AUTH_DIR, 'play.ch.report1.json'),
    },
]

/** Look up a persona by its stable key. */
export const userByKey = (key: E2EUser['key']): E2EUser => {
    const user = USERS.find((u) => u.key === key)
    if (!user) throw new Error(`Unknown e2e user key: ${key}`)
    return user
}
