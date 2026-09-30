import renderMathInElement from 'katex/contrib/auto-render'
import 'katex/dist/katex.min.css'
import React, { FC, useEffect, useRef } from 'react'

/**
 * Container id the backend's fragment-mode transformer prefix-scopes
 * the report's CSS to. Has to match the `container` parameter the
 * backend emits in `Content-Type: text/html; profile="neoipc-fragment";
 * container="#neoipc-rendered-report"`.
 */
export const REPORT_CONTAINER_ID = 'neoipc-rendered-report'

interface InlineHtmlReportProps {
    fragmentHtml: string
}

/**
 * Typeset the LaTeX math the report emits as literal `$$…$$` text.
 *
 * The math originates in gt table footnotes (`md("$$…$$")`), which gt passes
 * through as raw text — and Quarto's `minimal` HTML ships no math renderer of
 * its own (its MathJax loader lives in the stripped `<head>`), so the app
 * renders it here with bundled KaTeX: no CDN, CSP-safe. Only `$$`/`\[`/`\(`
 * delimiters are recognised (not bare `$`) to avoid mis-parsing stray dollar
 * signs in the report body. `throwOnError: false` renders a malformed formula
 * as its source rather than aborting the whole pass.
 */
const typesetMath = (container: HTMLElement): void => {
    try {
        renderMathInElement(container, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '\\[', right: '\\]', display: true },
                { left: '\\(', right: '\\)', display: false },
            ],
            throwOnError: false,
        })
    } catch (err) {
        console.error('Failed to typeset report math', err)
    }
}

/**
 * The element of the report `fragment` names, looked up the way a browser
 * resolves a fragment: by the text as written first, then percent-decoded.
 */
const findFragmentTarget = (container: HTMLElement, fragment: string): HTMLElement | undefined => {
    const byId = (id: string) =>
        Array.from(container.querySelectorAll<HTMLElement>('[id]')).find((element) => element.id === id)
    const asWritten = byId(fragment)
    if (asWritten) return asWritten
    try {
        return byId(decodeURIComponent(fragment))
    } catch {
        return undefined
    }
}

/**
 * Follow a link to a place in the report without navigating. The app routes on
 * the URL's fragment (`#/reports/…`), so letting the browser follow
 * `href="#sec-problem-details-3"` would hand the router a route that does not
 * exist, and its fallback redirect would unmount the page and discard the
 * report. The target is scrolled into view and takes the focus, the way a skip
 * link hands it over, so keyboard and screen-reader users continue from there;
 * the browser's own fragment navigation would focus nothing for a section.
 * A middle click arrives as `auxclick` and is followed in place too: a new tab
 * of the app would open on its first page, not on the report.
 */
const followLinkWithinReport = (event: MouseEvent): void => {
    if (event.type === 'auxclick' && event.button !== 1) return
    const container = event.currentTarget
    if (!(container instanceof HTMLElement) || !(event.target instanceof Element)) return
    const link = event.target.closest('a[href^="#"]')
    if (!link || !container.contains(link)) return
    event.preventDefault()

    const target = findFragmentTarget(container, (link.getAttribute('href') ?? '#').slice(1))
    if (!target) return
    target.scrollIntoView({ block: 'start' })
    if (!target.matches('a[href], button, input, select, textarea, [tabindex]')) {
        target.setAttribute('tabindex', '-1')
    }
    target.focus({ preventScroll: true })
}

/**
 * Open the web links that leave the report, such as a patient's Tracker
 * Capture dashboard, in a new tab, so the report stays on screen: following
 * one in place replaces the app and discards the rendered report. `noopener`
 * keeps the opened page from reaching back into the app through
 * `window.opener`. Other schemes (`mailto:`) are left to the browser.
 */
const openLeavingLinksInNewTab = (container: HTMLElement): void => {
    for (const link of Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
        if ((link.getAttribute('href') ?? '').startsWith('#')) continue
        if (link.protocol !== 'http:' && link.protocol !== 'https:') continue
        link.target = '_blank'
        const rel = new Set((link.getAttribute('rel') ?? '').split(/\s+/).filter(Boolean))
        rel.add('noopener')
        rel.add('noreferrer')
        link.setAttribute('rel', Array.from(rel).join(' '))
    }
}

/**
 * Render an HTML fragment returned by `fragmentMode=true` from the
 * NeoIPC-Reporting backend. The fragment has no `<html>`/`<head>`/
 * `<body>` wrappers and any `<style>` blocks are already prefix-scoped
 * to `#${REPORT_CONTAINER_ID}`.
 *
 * What the backend can't do for us:
 *
 *   1. Inject the markup. We use `innerHTML` rather than React tree
 *      mounting because the fragment is opaque Quarto output — its
 *      tags / attribute names aren't React-compatible (`class` vs
 *      `className`, `tabindex` vs `tabIndex`, custom widget elements,
 *      etc.) and React would refuse to mount it.
 *   2. Typeset the math the report carries as text (see `typesetMath`).
 *   3. Adapt the links to the app: a link to a place in the report
 *      scrolls there instead of navigating, and a web link that leaves
 *      the report opens in a new tab.
 *   4. Re-execute scripts. Browsers don't execute `<script>` tags
 *      inserted via `innerHTML`; htmlwidgets (plotly, leaflet, DT)
 *      need their bootstraps to run, so we replace each with a fresh
 *      element. External `src` scripts get a load gate so subsequent
 *      inline scripts see their globals.
 *
 * The report shares the app's document; this component is the boundary
 * at which a widget that needs a document of its own would be isolated.
 */
const InlineHtmlReport: FC<InlineHtmlReportProps> = ({ fragmentHtml }) => {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        let cancelled = false
        container.innerHTML = fragmentHtml
        typesetMath(container)
        openLeavingLinksInNewTab(container)
        container.addEventListener('click', followLinkWithinReport)
        container.addEventListener('auxclick', followLinkWithinReport)

        const reExecute = async () => {
            const scripts = Array.from(container.querySelectorAll('script'))
            for (const original of scripts) {
                if (cancelled) return
                await replaceScript(original)
            }
        }

        reExecute().catch((err) => {
            console.error('Failed re-executing report scripts', err)
        })

        return () => {
            cancelled = true
            container.removeEventListener('click', followLinkWithinReport)
            container.removeEventListener('auxclick', followLinkWithinReport)
            container.innerHTML = ''
        }
    }, [fragmentHtml])

    return <div id={REPORT_CONTAINER_ID} ref={containerRef} />
}

const replaceScript = (original: HTMLScriptElement): Promise<void> => {
    const replacement = document.createElement('script')
    for (const { name, value } of Array.from(original.attributes)) {
        replacement.setAttribute(name, value)
    }
    replacement.text = original.text

    const isExternal = original.hasAttribute('src')
    const gate = isExternal
        ? new Promise<void>((resolve) => {
              const settle = () => resolve()
              replacement.addEventListener('load', settle, { once: true })
              replacement.addEventListener('error', settle, { once: true })
          })
        : Promise.resolve()

    original.parentNode?.replaceChild(replacement, original)
    return gate
}

export default InlineHtmlReport
