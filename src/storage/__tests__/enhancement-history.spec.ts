import { loadEnhancementChecks, loadEnhancementHistory, markEnhancementChecked } from '../enhancement-history'

jest.mock('../sqlite/db', () => ({ getBossProfitDb: jest.fn() }))
const { getBossProfitDb: getBossProfitDbMock } = jest.requireMock('../sqlite/db') as Record<
  string,
  jest.Mock
>

const runMock = jest.fn()
const queryMock = jest.fn()

beforeEach(() => {
  runMock.mockReset().mockResolvedValue({})
  queryMock.mockReset().mockResolvedValue({ values: [] })
  getBossProfitDbMock.mockReset().mockResolvedValue({ run: runMock, query: queryMock })
})

describe('내역 읽기', () => {
  it('날짜 여러 개를 한 번에 읽는다', async () => {
    await loadEnhancementHistory(['2026-09-04', '2026-09-05'])

    const [sql, values] = queryMock.mock.calls[0]
    expect(sql).toContain('date_key IN (?, ?)')
    expect(values).toEqual(['2026-09-04', '2026-09-05'])
  })

  it('날짜가 없으면 조회하지 않는다', async () => {
    expect(await loadEnhancementHistory([])).toEqual([])
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('payload 를 풀어서 준다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          id: 'a',
          kind: 'starforce',
          date_key: '2026-09-04',
          created_at: '2026-09-04T07:02:32.597+09:00',
          character_name: '낟낟',
          target_item: '아케인셰이드 클로',
          item_key: 'arcane_umbra_knuckle',
          item_level: null,
          payload: '{"before_starforce_count":17}',
        },
      ],
    })

    expect(await loadEnhancementHistory(['2026-09-04'])).toEqual([
      {
        id: 'a',
        kind: 'starforce',
        dateKey: '2026-09-04',
        createdAt: '2026-09-04T07:02:32.597+09:00',
        characterName: '낟낟',
        targetItem: '아케인셰이드 클로',
        itemKey: 'arcane_umbra_knuckle',
        itemLevel: null,
        payload: { before_starforce_count: 17 },
      },
    ])
  })

  // 깨진 payload 하나가 그 날 지출을 통째로 죽이면 안 된다.
  it('payload 가 깨져도 그 줄만 null 이 된다', async () => {
    queryMock.mockResolvedValue({
      values: [{ id: 'a', kind: 'cube', date_key: '2026-09-04', created_at: '', character_name: '', target_item: '', item_level: null, payload: '{{{' }],
    })

    expect((await loadEnhancementHistory(['2026-09-04']))[0].payload).toBeNull()
  })
})

describe('조회 원장', () => {
  it('그 계정의 종류와 날짜로 찾는다', async () => {
    queryMock.mockResolvedValue({
      values: [{ enhancement_type: 'cube', history_date: '2026-09-04', next_cursor: 'c1', settled: 1 }],
    })

    const checks = await loadEnhancementChecks('account-a', ['2026-09-04'])

    expect(checks.get('cube|2026-09-04')).toEqual({ nextCursor: 'c1', settled: true })
    expect(queryMock.mock.calls[0][1]).toEqual(['account-a', '2026-09-04'])
  })

  it('날짜가 없으면 조회하지 않는다', async () => {
    expect((await loadEnhancementChecks('account-a', [])).size).toBe(0)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('굳힘을 적는다', async () => {
    await markEnhancementChecked('account-a', 'cube', '2026-09-04', 'c1', true, '2026-09-06T00:00:00.000Z')

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('INSERT INTO enhancement_history_checks')
    expect(values).toEqual(['account-a', 'cube', '2026-09-04', 'c1', 1, '2026-09-06T00:00:00.000Z'])
  })

  it('안 굳힌 것도 적는다. 커서를 다음 회차가 이어받는다', async () => {
    await markEnhancementChecked('account-a', 'cube', '2026-09-06', null, false, '2026-09-06T00:00:00.000Z')

    expect(runMock.mock.calls[0][1]).toEqual(['account-a', 'cube', '2026-09-06', null, 0, '2026-09-06T00:00:00.000Z'])
  })
})
