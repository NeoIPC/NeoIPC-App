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

const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink'

/**
 * The address a link in the report points to: its `href`, or for an SVG link
 * written in the older form, its `xlink:href`. `null` for an `a` without one.
 */
const linkAddress = (link: Element): string | null =>
    link.getAttribute('href') ?? link.getAttributeNS(XLINK_NAMESPACE, 'href')

/**
 * The absolute web address a link leaves the report for, resolved against the
 * document's base URL: `null` for a link to a place in the report, and for
 * every scheme but http(s), which is left to the browser (`mailto:`).
 */
const leavingWebAddress = (address: string): string | null => {
    if (address.startsWith('#')) return null
    let url: URL
    try {
        url = new URL(address, document.baseURI)
    } catch {
        return null
    }
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
}

/**
 * The element of the report `fragment` names, looked up by id: the text as
 * written first, then percent-decoded.
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
 * Scroll the target of a link to a place in the report into view and hand it
 * the focus, the way a skip link does, so keyboard and screen-reader users
 * continue from there; the browser's own fragment navigation would focus
 * nothing for a section. A target the focus does not reach gains
 * `tabindex="-1"`, which makes it focusable without adding it to the Tab
 * order, and is focused again. One that takes the focus already, such as the
 * footnote reference a footnote's back-link returns to, keeps its place in
 * that order. Whether the focus arrived is what decides, not `tabIndex`,
 * which reports 0 for some elements that cannot take it, an `a` without
 * `href` among them.
 */
const focusFragmentTarget = (container: HTMLElement, fragment: string): void => {
    const target = findFragmentTarget(container, fragment)
    if (!target) return
    target.scrollIntoView({ block: 'start' })
    target.focus({ preventScroll: true })
    if (document.activeElement !== target) {
        target.setAttribute('tabindex', '-1')
        target.focus({ preventScroll: true })
    }
}

/**
 * Follow a link in the report without the app losing the report. Delegated
 * from the report's container, so it also covers links the report's own
 * scripts add after it is rendered; an SVG link counts as well, with its
 * address in `href` or `xlink:href`.
 *
 * - A link to a place in the report is followed in place. The app routes on
 *   the URL's fragment (`#/reports/…`), so letting the browser follow
 *   `href="#sec-problem-details-3"` would hand the router a route that does
 *   not exist, and its fallback redirect would unmount the page and discard
 *   the report.
 * - A web link that leaves the report, such as a patient's Tracker Capture
 *   dashboard, opens in a new tab: following it in place would replace the
 *   app. The tab is opened here, with the browser's own navigation
 *   cancelled, so each click opens exactly one tab; `noopener` keeps the
 *   opened page from reaching back into the app through `window.opener`.
 *
 * Both take over a click whatever its modifier keys, and a middle click,
 * which arrives as `auxclick`. For a link to a place in the report that is
 * necessary: a browser left to handle either would open the app's own
 * address in a new tab, which lands on its first page rather than on the
 * report. A web link is treated the same way, so every way of following a
 * link behaves alike and every tab opened for one is opened here with
 * `noopener`; the browser's own variants, such as a background tab for a
 * Ctrl-click, give way to a new tab. Other buttons, and links of any other
 * scheme, are left to the browser, and a click a script of the report has
 * already cancelled is left to that script.
 */
const followLink = (event: MouseEvent): void => {
    if (event.defaultPrevented) return
    if (event.type === 'auxclick' && event.button !== 1) return
    const container = event.currentTarget
    if (!(container instanceof HTMLElement) || !(event.target instanceof Element)) return
    const link = event.target.closest('a')
    if (!link || !container.contains(link)) return
    const address = linkAddress(link)
    if (address === null) return

    if (address.startsWith('#')) {
        event.preventDefault()
        focusFragmentTarget(container, address.slice(1))
        return
    }
    const leaving = leavingWebAddress(address)
    if (leaving === null) return
    event.preventDefault()
    window.open(leaving, '_blank', 'noopener,noreferrer')
}

/**
 * Mark the web links present when the report is rendered as opening in a new
 * tab without an opener or a referrer. A click on one is handled by
 * {@link followLink}; the attributes serve the ways of following a link that
 * bypass it, such as the browser's context menu, and a click that a script of
 * the report stops before it reaches the report's container.
 */
const markLeavingLinks = (container: HTMLElement): void => {
    for (const link of Array.from(container.querySelectorAll('a'))) {
        const address = linkAddress(link)
        if (address === null || leavingWebAddress(address) === null) continue
        link.setAttribute('target', '_blank')
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
        markLeavingLinks(container)
        container.addEventListener('click', followLink)
        container.addEventListener('auxclick', followLink)

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
            container.removeEventListener('click', followLink)
            container.removeEventListener('auxclick', followLink)
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
