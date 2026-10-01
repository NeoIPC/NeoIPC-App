import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import InlineHtmlReport from './InlineHtmlReport'

// Jest 27 ignores the `exports` map through which KaTeX publishes its
// auto-render entry point; typesetting the report's math is not what these
// tests are about.
jest.mock('katex/contrib/auto-render', () => ({ __esModule: true, default: jest.fn() }), {
    virtual: true,
})

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const FRAGMENT = `
<p><a id="to-details" href="#sec-problem-details-3">See the details.</a></p>
<p><a id="to-nowhere" href="#sec-missing">A reference to nothing.</a></p>
<p><a id="to-escaped" href="#a%20b">A reference written with an escape.</a></p>
<h2 id="sec-problem-details-3">Details</h2>
<h2 id="a%20b">The id as written</h2>
<h2 id="a b">The id decoded</h2>
<p><a id="to-cafe" href="#caf%C3%A9">A reference only its decoded form finds.</a></p>
<h2 id="café">Café</h2>
<p>A claim.<a id="fnref1" href="#fn1" class="footnote-ref">1</a></p>
<ol><li id="fn1">The footnote. <a id="fnback1" href="#fnref1" class="footnote-back">↩︎</a></li></ol>
<p><a id="to-percent" href="#100%">A reference with a malformed escape.</a></p>
<p><a id="to-anchor" href="#bare-anchor">A reference to an anchor without an address.</a></p>
<p><a id="bare-anchor">An anchor without an address</a></p>
<h3><a id="dashboard" href="https://dhis.example/dhis-web-tracker-capture/index.html#/dashboard?tei=T1" rel="external">P1</a></h3>
<p><a id="support" href="mailto:support@example.org">Support</a></p>
<p><a id="table-file" href="tables/problems.csv" download>The problems as a table</a></p>
<p><a id="foreign-file" href="https://example.org/problems.csv" download>The problems elsewhere</a></p>
<svg><a id="figure-source" xlink:href="https://example.org/figure-source"><text id="figure-label">Source</text></a></svg>
`

/**
 * The app's routing reduced to what the report depends on: the page that
 * shows it, and the catch-all redirect to the first page that a fragment the
 * router cannot place leads to. The router takes the app's own future flags,
 * so it updates and resolves routes as the app's does.
 */
const App = () => (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
            <Route path="/reports/validation" element={<InlineHtmlReport fragmentHtml={FRAGMENT} />} />
            <Route path="/reports/partner" element={<p id="first-page">First page</p>} />
            <Route path="*" element={<Navigate to="/reports/partner" replace />} />
        </Routes>
    </HashRouter>
)

/** jsdom follows a link a task after its click; let that and the router run. */
const settle = () =>
    act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
    })

describe('InlineHtmlReport', () => {
    let host: HTMLDivElement
    let root: Root
    let scrolledTo: Element[]
    let opened: jest.SpyInstance

    beforeEach(() => {
        // jsdom lays nothing out, so it has no scrollIntoView of its own.
        scrolledTo = []
        Element.prototype.scrollIntoView = function (this: Element) {
            scrolledTo.push(this)
        }
        // jsdom opens no windows; the tabs a link opens are what is asserted.
        opened = jest.spyOn(window, 'open').mockImplementation(() => null)
        window.location.hash = '#/reports/validation'
        host = document.createElement('div')
        document.body.appendChild(host)
        root = createRoot(host)
        act(() => root.render(<App />))
    })

    afterEach(() => {
        act(() => root.unmount())
        host.remove()
        opened.mockRestore()
    })

    const element = (id: string): HTMLElement => {
        const found = Array.from(host.querySelectorAll<HTMLElement>('[id]')).find(
            (candidate) => candidate.id === id
        )
        if (!found) throw new Error(`no element #${id} on the page`)
        return found
    }

    const dispatch = (link: Element, type: 'click' | 'auxclick', button = 0): boolean => {
        const event = new MouseEvent(type, { bubbles: true, cancelable: true, button })
        act(() => {
            link.dispatchEvent(event)
        })
        return event.defaultPrevented
    }

    it('keeps the report on screen when a reference to a place in it is followed', async () => {
        act(() => element('to-details').click())
        await settle()

        const target = element('sec-problem-details-3')
        expect(window.location.hash).toBe('#/reports/validation')
        expect(host.querySelector('#first-page')).toBeNull()
        expect(scrolledTo).toEqual([target])
        expect(document.activeElement).toBe(target)
        expect(target.getAttribute('tabindex')).toBe('-1')
    })

    it('keeps the report on screen for a reference whose target is missing too', async () => {
        act(() => element('to-nowhere').click())
        await settle()

        expect(window.location.hash).toBe('#/reports/validation')
        expect(host.querySelector('#first-page')).toBeNull()
        expect(scrolledTo).toEqual([])
    })

    it('follows a middle click on a reference in place, and leaves other buttons alone', () => {
        expect(dispatch(element('to-details'), 'auxclick', 1)).toBe(true)
        expect(document.activeElement).toBe(element('sec-problem-details-3'))
        expect(dispatch(element('to-details'), 'auxclick', 2)).toBe(false)
    })

    it('looks a reference up by id: the text as written first, then percent-decoded', () => {
        dispatch(element('to-escaped'), 'click')

        expect(document.activeElement).toBe(element('a%20b'))
    })

    it('finds a target by the percent-decoded id when no id matches the text as written', () => {
        expect(host.querySelector('[id="caf%C3%A9"]')).toBeNull()

        dispatch(element('to-cafe'), 'click')

        expect(document.activeElement).toBe(element('café'))
    })

    // Pandoc's footnote back-link targets the footnote reference, an `a[href]`
    // that is in the Tab order already; `tabindex="-1"` would take it out.
    it('focuses a target that can take the focus without changing its tabindex', () => {
        dispatch(element('fnback1'), 'click')

        const reference = element('fnref1')
        expect(document.activeElement).toBe(reference)
        expect(reference.hasAttribute('tabindex')).toBe(false)
    })

    // An `a` without `href` reports a tabIndex of 0 but cannot take the focus.
    it('makes a target focusable when the focus does not reach it', () => {
        const anchor = element('bare-anchor')
        expect(anchor.tabIndex).toBe(0)

        dispatch(element('to-anchor'), 'click')

        expect(document.activeElement).toBe(anchor)
        expect(anchor.getAttribute('tabindex')).toBe('-1')
    })

    it('keeps the report on screen for a reference with a malformed escape', async () => {
        const errors: unknown[] = []
        const recordError = (event: ErrorEvent): void => {
            errors.push(event.error)
            event.preventDefault()
        }
        window.addEventListener('error', recordError)
        try {
            expect(dispatch(element('to-percent'), 'click')).toBe(true)
            await settle()
        } finally {
            window.removeEventListener('error', recordError)
        }

        expect(errors).toEqual([])
        expect(window.location.hash).toBe('#/reports/validation')
        expect(host.querySelector('#first-page')).toBeNull()
        expect(scrolledTo).toEqual([])
    })

    it('opens a web link that leaves the report in exactly one new tab, without an opener', () => {
        expect(dispatch(element('dashboard'), 'click')).toBe(true)

        expect(opened.mock.calls).toEqual([
            [
                'https://dhis.example/dhis-web-tracker-capture/index.html#/dashboard?tei=T1',
                '_blank',
                'noopener,noreferrer',
            ],
        ])
    })

    it('opens one new tab for a middle click on a web link, and leaves other buttons alone', () => {
        expect(dispatch(element('dashboard'), 'auxclick', 1)).toBe(true)
        expect(dispatch(element('dashboard'), 'auxclick', 2)).toBe(false)

        expect(opened).toHaveBeenCalledTimes(1)
    })

    it('opens a web link that a report script adds after rendering in a new tab', () => {
        const container = host.querySelector('#neoipc-rendered-report')
        act(() => {
            container?.insertAdjacentHTML(
                'beforeend',
                '<p><a id="added-later" href="https://example.org/added">Added by a script</a></p>'
            )
        })

        expect(dispatch(element('added-later'), 'click')).toBe(true)
        expect(opened).toHaveBeenCalledWith(
            'https://example.org/added',
            '_blank',
            'noopener,noreferrer'
        )
    })

    it('opens an SVG link written with xlink:href in a new tab', () => {
        const label = host.querySelector('[id="figure-label"]')
        if (!label) throw new Error('no SVG link label on the page')

        expect(dispatch(label, 'click')).toBe(true)
        expect(opened).toHaveBeenCalledWith(
            'https://example.org/figure-source',
            '_blank',
            'noopener,noreferrer'
        )
    })

    it('marks the web links present at rendering to open in a new tab, without an opener', () => {
        const dashboard = element('dashboard')

        expect(dashboard.getAttribute('target')).toBe('_blank')
        expect(dashboard.getAttribute('rel')?.split(' ').sort()).toEqual(
            ['external', 'noopener', 'noreferrer']
        )
    })

    it('leaves a click a report script has cancelled to that script', () => {
        const dashboard = element('dashboard')
        const cancel = (event: Event): void => event.preventDefault()
        dashboard.addEventListener('click', cancel)
        try {
            dispatch(dashboard, 'click')
        } finally {
            dashboard.removeEventListener('click', cancel)
        }

        expect(opened).not.toHaveBeenCalled()
    })

    it('leaves a link of another scheme to the browser', () => {
        const support = element('support')

        expect(support.hasAttribute('target')).toBe(false)
        expect(dispatch(support, 'click')).toBe(false)
        expect(opened).not.toHaveBeenCalled()
    })

    // A browser saves the file a `download` link of the document's own origin
    // names; opened in a tab, it would be shown instead and lose its name.
    it('leaves a download link of the app\'s own origin to the browser, which saves the file', () => {
        const tableFile = element('table-file')

        expect(tableFile.hasAttribute('target')).toBe(false)
        expect(tableFile.hasAttribute('rel')).toBe(false)
        expect(dispatch(tableFile, 'click')).toBe(false)
        expect(dispatch(tableFile, 'auxclick', 1)).toBe(false)
        expect(opened).not.toHaveBeenCalled()
    })

    // Browsers ignore `download` across origins and follow the link, which
    // in place would replace the app.
    it('opens a download link of another origin in a new tab, like any web link', () => {
        const foreignFile = element('foreign-file')

        expect(foreignFile.getAttribute('target')).toBe('_blank')
        expect(dispatch(foreignFile, 'click')).toBe(true)
        expect(opened.mock.calls).toEqual([
            ['https://example.org/problems.csv', '_blank', 'noopener,noreferrer'],
        ])
    })
})
