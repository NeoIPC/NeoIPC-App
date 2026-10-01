import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

// React 18's act() warns unless the environment opts in. The d2-app-scripts
// jest config declares no setupFiles, so we set the flag here — every test
// that renders a hook imports this helper.
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

export interface RenderHookHandle<T> {
    /** Latest value returned by the hook; refreshed on every render. */
    result: { current: T }
    /**
     * Render the harness again, as a parent's re-render would, so the hook
     * re-reads what it takes from outside React (a changed mock, a changed
     * `i18n.language`).
     */
    rerender: () => void
    /** Unmount the harness and detach its container. */
    unmount: () => void
}

/**
 * Minimal `renderHook` for this repo's raw react-dom test setup (no
 * `@testing-library`). Renders `useHook` inside a throwaway component and
 * captures its return value into `result.current`. Wrap state-updating
 * calls (an async `submit`, a `reset`, etc.) in `act(...)` from `react`
 * before asserting on `result.current`.
 */
export const renderHook = <T,>(useHook: () => T): RenderHookHandle<T> => {
    const result = { current: undefined as unknown as T }
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const Harness = () => {
        result.current = useHook()
        return null
    }
    act(() => {
        root.render(<Harness />)
    })
    return {
        result,
        rerender: () => {
            act(() => {
                root.render(<Harness />)
            })
        },
        unmount: () => {
            act(() => root.unmount())
            container.remove()
        },
    }
}
