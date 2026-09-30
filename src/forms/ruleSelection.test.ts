import { toggleRuleSelection } from './ruleSelection'

const ALL = [1, 2, 3, 25]

describe('toggleRuleSelection', () => {
    it('unticking one rule of every rule leaves the others, in order', () => {
        expect(toggleRuleSelection(null, ALL, 2, false)).toEqual([1, 3, 25])
    })

    it('ticking the last missing rule folds the selection back to every rule', () => {
        expect(toggleRuleSelection([1, 3, 25], ALL, 2, true)).toBeNull()
    })

    it('ticking a rule into a partial selection keeps it partial and sorted', () => {
        expect(toggleRuleSelection([25], ALL, 3, true)).toEqual([3, 25])
    })

    it('unticking the only selected rule leaves an empty selection', () => {
        expect(toggleRuleSelection([3], ALL, 3, false)).toEqual([])
    })

    it('never folds an empty catalogue to every rule', () => {
        expect(toggleRuleSelection([], [], 3, true)).toEqual([3])
    })
})
