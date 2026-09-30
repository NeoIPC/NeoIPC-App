/**
 * The Validation Report's rule selection after one rule's box is ticked or
 * unticked. `selected` is the current selection, `null` standing for every
 * rule in `allIds`. A selection that holds every rule folds back to `null`,
 * which the request expresses by leaving `rules` out so the report applies
 * its own full set. Any other selection stays in ascending order, given
 * `allIds` and `selected` in ascending order, as the rule catalogue lists
 * its rules.
 */
export const toggleRuleSelection = (
    selected: readonly number[] | null,
    allIds: readonly number[],
    id: number,
    checked: boolean
): number[] | null => {
    const current = selected ?? allIds
    const next = checked
        ? [...current.filter((rule) => rule !== id), id].sort((a, b) => a - b)
        : current.filter((rule) => rule !== id)
    const everyRule = allIds.length > 0 && allIds.every((rule) => next.includes(rule))
    return everyRule ? null : next
}
