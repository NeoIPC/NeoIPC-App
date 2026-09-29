import { loadValidationRules } from './reportConfig'

const rulesResponse = (rules: { id: number; summary: string }[]): Response =>
    ({ ok: true, status: 200, json: async () => ({ rules }) }) as unknown as Response

const problemResponse = (status: number): Response =>
    ({
        ok: false,
        status,
        statusText: 'Bad Request',
        headers: new Headers({ 'content-type': 'application/problem+json' }),
        json: async () => ({ status, code: 'unsupported-locale' }),
        text: async () => '',
    }) as unknown as Response

describe('loadValidationRules', () => {
    const realFetch = global.fetch
    afterEach(() => {
        global.fetch = realFetch
        jest.restoreAllMocks()
    })

    it('asks for the rules in the requested language', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValue(rulesResponse([{ id: 3, summary: 'Das Aufnahmedatum weicht ab.' }]))
        global.fetch = fetchMock as unknown as typeof fetch

        const rules = await loadValidationRules('https://dhis.example', 'de')

        expect(rules).toEqual([{ id: 3, summary: 'Das Aufnahmedatum weicht ab.' }])
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock.mock.calls[0][0]).toContain('/validation-report/rules?locale=de')
    })

    it('asks again in English when the report does not serve the language', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce(problemResponse(400))
            .mockResolvedValueOnce(rulesResponse([{ id: 3, summary: 'The admission date differs.' }]))
        global.fetch = fetchMock as unknown as typeof fetch

        const rules = await loadValidationRules('https://dhis.example', 'xx')

        expect(rules).toEqual([{ id: 3, summary: 'The admission date differs.' }])
        expect(fetchMock.mock.calls[1][0]).toContain('/validation-report/rules?locale=en')
    })

    it('does not mask another failure as a language fallback', async () => {
        const fetchMock = jest.fn().mockResolvedValue(problemResponse(500))
        global.fetch = fetchMock as unknown as typeof fetch

        await expect(loadValidationRules('https://dhis.example', 'de')).rejects.toThrow()
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
})
