import {
  loadEnhancementChecks,
  loadEnhancementHistory,
  loadKnownHistoryIds,
  loadObservedItemLevels,
  markEnhancementChecked,
  saveEnhancementHistory,
} from '../enhancement-history'

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

const row = (id: string) => ({
  id,
  characterName: '낟낟',
  createdAt: `2026-09-04T07:02:32.597+09:00`,
  dateKey: '2026-09-04',
  targetItem: '아케인셰이드 클로',
  itemLevel: 200,
  payload: { id, foo: 1 },
})

describe('내역 쓰기', () => {
  it('한 문장으로 모아 넣는다', async () => {
    await saveEnhancementHistory('cube', [row('a'), row('b')])

    expect(runMock).toHaveBeenCalledTimes(1)
    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('INSERT OR IGNORE INTO enhancement_history')
    expect(values).toHaveLength(16)
    expect(values.slice(0, 8)).toEqual([
      'a', 'cube', '2026-09-04', '2026-09-04T07:02:32.597+09:00', '낟낟', '아케인셰이드 클로', 200,
      JSON.stringify({ id: 'a', foo: 1 }),
    ])
  })

  // 한 줄에 8개라 200줄이면 1,600 변수다. SQLite 의 기본 상한(999)을 넘겨 조용히 던진다.
  it('많으면 나눠 넣는다', async () => {
    await saveEnhancementHistory('cube', Array.from({ length: 250 }, (_, i) => row(String(i))))

    expect(runMock).toHaveBeenCalledTimes(3)
  })

  it('빈 배열이면 안 부른다', async () => {
    await saveEnhancementHistory('cube', [])

    expect(runMock).not.toHaveBeenCalled()
  })

  // 같은 줄을 두 번 받는 일이 정상이다. 커서를 이어받다 겹치고, 오늘 날짜는 여러 번 부른다.
  it('id 가 겹치면 무시한다. 갱신하지 않는다', async () => {
    await saveEnhancementHistory('cube', [row('a')])

    expect(runMock.mock.calls[0][0]).toContain('OR IGNORE')
  })
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

// 스타포스 응답에는 item_level 이 없다. 같은 이름의 큐브·잠재 행이 그 자리를 든다.
describe('관측된 장비 레벨', () => {
  it('이름에서 레벨로 가는 표를 만든다', async () => {
    queryMock.mockResolvedValue({
      values: [{ target_item: '아케인셰이드 클로', item_level: 200 }],
    })

    expect(await loadObservedItemLevels()).toEqual(new Map([['아케인셰이드클로', 200]]))
  })

  it('공백을 지운 이름으로 담는다', async () => {
    queryMock.mockResolvedValue({ values: [{ target_item: '데아 시두스 이어링', item_level: 130 }] })

    expect((await loadObservedItemLevels()).get('데아시두스이어링')).toBe(130)
  })
})

describe('조회 원장', () => {
  it('종류와 날짜로 찾는다', async () => {
    queryMock.mockResolvedValue({
      values: [{ kind: 'cube', date_key: '2026-09-04', next_cursor: 'c1', settled: 1 }],
    })

    const checks = await loadEnhancementChecks(['2026-09-04'])

    expect(checks.get('cube|2026-09-04')).toEqual({ nextCursor: 'c1', settled: true })
  })

  it('없는 날짜는 없는 대로 둔다', async () => {
    expect((await loadEnhancementChecks(['2026-09-04'])).size).toBe(0)
  })

  it('날짜가 없으면 조회하지 않는다', async () => {
    expect((await loadEnhancementChecks([])).size).toBe(0)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('굳힘을 적는다', async () => {
    await markEnhancementChecked('cube', '2026-09-04', 'c1', true, '2026-09-06T00:00:00.000Z')

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('INSERT INTO enhancement_history_checks')
    expect(values).toEqual(['cube', '2026-09-04', 'c1', 1, '2026-09-06T00:00:00.000Z'])
  })

  it('안 굳힌 것도 적는다. 커서를 다음 회차가 이어받는다', async () => {
    await markEnhancementChecked('cube', '2026-09-06', null, false, '2026-09-06T00:00:00.000Z')

    expect(runMock.mock.calls[0][1]).toEqual(['cube', '2026-09-06', null, 0, '2026-09-06T00:00:00.000Z'])
  })
})

describe('아는 id', () => {
  it('종류와 날짜로 모은다', async () => {
    queryMock.mockResolvedValue({ values: [{ id: 'a' }, { id: 'b' }] })

    expect(await loadKnownHistoryIds('cube', '2026-09-04')).toEqual(new Set(['a', 'b']))
    expect(queryMock.mock.calls[0][1]).toEqual(['cube', '2026-09-04'])
  })

  it('없으면 빈 집합이다', async () => {
    expect((await loadKnownHistoryIds('cube', '2026-09-04')).size).toBe(0)
  })
})
