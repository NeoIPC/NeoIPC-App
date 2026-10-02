#!/usr/bin/env node
/*
 * Schema-as-contract drift check for the report forms.
 *
 * Two modes:
 *
 *  1. Default (always runs) — compare the field-name set in each
 *     vendored `src/schemas/<report>.json` snapshot against the
 *     hand-written tuple in `src/forms/<Form>.wire-fields.ts`. Fails
 *     the build if either side carries a field the other doesn't.
 *
 *  2. Upstream diff (opt-in via the NEOIPC_REPORTING_REPO env var) —
 *     run `dotnet run --project $NEOIPC_REPORTING_REPO/src/NeoIPC.Reporting --
 *     --emit-schemas <tmpdir>` and diff its output against the
 *     vendored snapshots. Catches the case where the snapshot is
 *     stale because the backend's [ApiParameter] surface moved.
 *
 * The script imports nothing beyond Node's standard library and reads
 * each tuple with a narrow regex rather than loading the TypeScript
 * compiler, so it supports one shape: `export const <name> = [ ... ]
 * as const`, without a type annotation, whose entries are quoted string
 * literals. A declaration the regex does not find, such as one with a
 * type annotation or without `as const`, fails the check. An entry that
 * is not a string literal (a spread, a template literal, a reference to
 * a constant) is not read, so the check compares the schema against the
 * tuple without it, and a quoted string in a comment inside the tuple is
 * read as a field.
 */

import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

const reports = [
    {
        label: 'Partner Report',
        schemaPath: join(repoRoot, 'src/schemas/partner-report.json'),
        specPath: join(repoRoot, 'src/forms/PartnerReportForm.wire-fields.ts'),
        specExport: 'partnerReportWireFields',
    },
    {
        label: 'Reference Report',
        schemaPath: join(repoRoot, 'src/schemas/reference-report.json'),
        specPath: join(repoRoot, 'src/forms/ReferenceReportForm.wire-fields.ts'),
        specExport: 'referenceReportWireFields',
    },
    {
        label: 'Validation Report',
        schemaPath: join(repoRoot, 'src/schemas/validation-report.json'),
        specPath: join(repoRoot, 'src/forms/ValidationReportForm.wire-fields.ts'),
        specExport: 'validationReportWireFields',
    },
]

const readSchemaNames = (path) => {
    const json = JSON.parse(readFileSync(path, 'utf8'))
    return new Set(json.fields.map((f) => f.name))
}

const readSpecNames = (path, exportName) => {
    const src = readFileSync(path, 'utf8')
    const pattern = new RegExp(
        `export\\s+const\\s+${exportName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s+const`,
        'm'
    )
    const match = src.match(pattern)
    if (!match) {
        throw new Error(
            `Could not locate \`export const ${exportName} = [...] as const\` in ${path}`
        )
    }
    const stringLiteral = /['"]([^'"]+)['"]/g
    const names = new Set()
    let m
    while ((m = stringLiteral.exec(match[1])) !== null) names.add(m[1])
    return names
}

const setDiff = (a, b) => [...a].filter((x) => !b.has(x))

let hasError = false
const reportError = (message) => {
    process.stderr.write(`error: ${message}\n`)
    hasError = true
}

for (const r of reports) {
    let schemaNames
    let specNames
    try {
        schemaNames = readSchemaNames(r.schemaPath)
    } catch (err) {
        reportError(`${r.label}: failed to read schema snapshot — ${err.message}`)
        continue
    }
    try {
        specNames = readSpecNames(r.specPath, r.specExport)
    } catch (err) {
        reportError(`${r.label}: failed to read form spec — ${err.message}`)
        continue
    }

    const missingInSpec = setDiff(schemaNames, specNames)
    const missingInSchema = setDiff(specNames, schemaNames)

    if (missingInSpec.length === 0 && missingInSchema.length === 0) {
        process.stdout.write(
            `ok ${r.label}: ${schemaNames.size} fields in sync\n`
        )
        continue
    }
    if (missingInSpec.length > 0) {
        reportError(
            `${r.label}: schema has fields the form spec doesn't list: ${missingInSpec.join(', ')}`
        )
    }
    if (missingInSchema.length > 0) {
        reportError(
            `${r.label}: form spec lists fields the schema doesn't carry: ${missingInSchema.join(', ')}`
        )
    }
}

const upstreamRepo = process.env.NEOIPC_REPORTING_REPO
if (upstreamRepo) {
    process.stdout.write(
        `Running upstream schema diff against ${upstreamRepo}\n`
    )
    const upstreamDir = mkdtempSync(join(tmpdir(), 'neoipc-schemas-'))
    try {
        const result = spawnSync(
            'dotnet',
            [
                'run',
                '--project',
                resolve(upstreamRepo, 'src/NeoIPC.Reporting'),
                '--no-launch-profile',
                '--',
                '--emit-schemas',
                upstreamDir,
            ],
            { stdio: 'inherit' }
        )
        if (result.status !== 0) {
            reportError(
                `Upstream --emit-schemas exited with status ${result.status}`
            )
        } else {
            for (const r of reports) {
                const upstreamPath = join(
                    upstreamDir,
                    r.schemaPath.replace(/^.*[\\/]/, '')
                )
                const upstream = readSchemaNames(upstreamPath)
                const vendored = readSchemaNames(r.schemaPath)
                const missingInVendored = setDiff(upstream, vendored)
                const missingInUpstream = setDiff(vendored, upstream)
                if (
                    missingInVendored.length === 0 &&
                    missingInUpstream.length === 0
                ) {
                    process.stdout.write(
                        `ok ${r.label}: vendored snapshot matches upstream\n`
                    )
                    continue
                }
                if (missingInVendored.length > 0) {
                    reportError(
                        `${r.label}: upstream has fields the vendored snapshot doesn't: ${missingInVendored.join(', ')} (re-vendor with dotnet run -- --emit-schemas)`
                    )
                }
                if (missingInUpstream.length > 0) {
                    reportError(
                        `${r.label}: vendored snapshot has fields the upstream doesn't: ${missingInUpstream.join(', ')} (re-vendor with dotnet run -- --emit-schemas)`
                    )
                }
            }
        }
    } finally {
        rmSync(upstreamDir, { recursive: true, force: true })
    }
} else {
    process.stdout.write(
        'Skipping upstream diff (set NEOIPC_REPORTING_REPO to enable)\n'
    )
}

process.exit(hasError ? 1 : 0)
