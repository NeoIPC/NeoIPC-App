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
<h3><a id="dashboard" href="https://dhis.example/dhis-web-tracker-capture/index.html#/dashboard?tei=T1" rel="external">P1</a></h3>
<p><a id="support" href="mailto:support@example.org">Support</a></p>
`

/**
 * The app's routing reduced to what the report depends on: the page that
 * shows it, and the catch-all redirect to the first page that a fragment the
 * router cannot place leads to.
 */
const App = () => (
    <HashRouter>
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

    beforeEach(() => {
        // jsdom lays nothing out, so it has no scrollIntoView of its own.
        scrolledTo = []
        Element.prototype.scrollIntoView = function (this: Element) {
            scrolledTo.push(this)
        }
        window.location.hash = '#/reports/validation'
        host = document.createElement('div')
        document.body.appendChild(host)
        root = createRoot(host)
        act(() => root.render(<App />))
    })

    afterEach(() => {
        act(() => root.unmount())
        host.remove()
    })

    const element = (id: string): HTMLElement => {
        const found = Array.from(host.querySelectorAll<HTMLElement>('[id]')).find(
            (candidate) => candidate.id === id
        )
        if (!found) throw new Error(`no element #${id} on the page`)
        return found
    }

    const dispatch = (link: HTMLElement, type: 'click' | 'auxclick', button = 0): boolean => {
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

    it('resolves a reference by the id as written before the decoded one, as a browser does', () => {
        dispatch(element('to-escaped'), 'click')

        expect(document.activeElement).toBe(element('a%20b'))
    })

    it('lets a link that leaves the report navigate', () => {
        expect(dispatch(element('dashboard'), 'click')).toBe(false)
    })

    it('opens a web link that leaves the report in a new tab, without an opener', () => {
        const dashboard = element('dashboard')

        expect(dashboard.getAttribute('target')).toBe('_blank')
        expect(dashboard.getAttribute('rel')?.split(' ').sort()).toEqual(
            ['external', 'noopener', 'noreferrer']
        )
    })

    it('leaves a link of another scheme to the browser', () => {
        expect(element('support').hasAttribute('target')).toBe(false)
    })
})
