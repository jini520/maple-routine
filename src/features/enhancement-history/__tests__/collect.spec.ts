import { collectEnhancementHistory, measureEnhancementHistory, planEnhancementHistory } from '../collect'

jest.mock('../../../storage/api-key', () => ({ getAuthConfig: jest.fn() }))
jest.mock('../../../nexon/history/client', () => ({ fetchEnhancementHistory: jest.fn() }))
jest.mock('../../../nexon/character', () => ({ fetchCharacterList: jest.fn() }))
jest.mock('../../../storage/event-world-names', () => ({ saveEventWorldNames: jest.fn() }))
jest.mock('../../../storage/enhancement-history', () => ({
  checkKey: (kind: string, dateKey: string) => `${kind}|${dateKey}`,
  loadEnhancementChecks: jest.fn(),
  loadKnownHistoryIds: jest.fn(),
  markEnhancementChecked: jest.fn(),
  saveEnhancementHistory: jest.fn(),
}))

const { getAuthConfig } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>
const { fetchEnhancementHistory } = jest.requireMock('../../../nexon/history/client') as Record<string, jest.Mock>
const { fetchCharacterList } = jest.requireMock('../../../nexon/character') as Record<string, jest.Mock>
const store = jest.requireMock('../../../storage/enhancement-history') as Record<string, jest.Mock>
const { saveEventWorldNames } = jest.requireMock('../../../storage/event-world-names') as Record<string, jest.Mock>

const NOW = new Date('2026-09-06T12:00:00+09:00')
const KINDS = ['cube', 'starforce', 'potential']

const page = (ids: string[], nextCursor: string | null = null) => ({
  rows: ids.map((id) => ({
    id,
    characterName: '낟낟',
    createdAt: '2026-09-05T07:00:00.000+09:00',
    dateKey: '2026-09-05',
    targetItem: '아케인셰이드 클로',
    itemLevel: 200,
    payload: { id },
  })),
  nextCursor,
})

beforeEach(() => {
  getAuthConfig.mockReset().mockResolvedValue({ apiKey: 'k' })
  fetchCharacterList.mockReset().mockResolvedValue([
    { accountId: 'a', characters: [{ ocid: '1', name: '머리맨들맨둘', world: '스페셜', jobClass: '', level: 1 }] },
  ])
  fetchEnhancementHistory.mockReset().mockResolvedValue(page([]))
  store.loadEnhancementChecks.mockReset().mockResolvedValue(new Map())
  store.loadKnownHistoryIds.mockReset().mockResolvedValue(new Set())
  store.markEnhancementChecked.mockReset().mockResolvedValue(undefined)
  store.saveEnhancementHistory.mockReset().mockResolvedValue(undefined)
  saveEventWorldNames.mockReset().mockResolvedValue(undefined)
})

describe('계획', () => {
  // 분모가 여기서 확정된다. 콜은 한 건도 안 나간다.
  it('날짜마다 세 종류를 센다', async () => {
    expect(await planEnhancementHistory(['2026-09-04', '2026-09-05'], '2026-09-06')).toHaveLength(6)
    expect(fetchEnhancementHistory).not.toHaveBeenCalled()
  })

  it('굳은 날짜는 안 센다', async () => {
    store.loadEnhancementChecks.mockResolvedValue(
      new Map(KINDS.map((kind) => [`${kind}|2026-09-04`, { nextCursor: null, settled: true }])),
    )

    expect(await planEnhancementHistory(['2026-09-04', '2026-09-05'], '2026-09-06')).toHaveLength(3)
  })

  // 오늘은 굳을 수 없다. 원장에 settled 가 서 있어도 다시 센다.
  it('오늘은 언제나 센다', async () => {
    store.loadEnhancementChecks.mockResolvedValue(
      new Map(KINDS.map((kind) => [`${kind}|2026-09-06`, { nextCursor: 'c', settled: true }])),
    )

    expect(await planEnhancementHistory(['2026-09-06'], '2026-09-06')).toHaveLength(3)
  })

  it('내일 이후는 안 센다', async () => {
    expect(await planEnhancementHistory(['2026-09-07'], '2026-09-06')).toHaveLength(0)
  })
})

// 층이 이것으로 두 가지를 정한다. 모달을 띄울지(`hasPast`)와 **진행 바의 분모**(`total`)다.
// 분모를 회차 안에서 다시 세면 바가 모달보다 늦게 뜬다.
describe('회차 크기 미리 재기', () => {
  const 굳음 = (dateKeys: string[]) =>
    new Map(
      dateKeys.flatMap((dateKey) =>
        KINDS.map((kind) => [`${kind}|${dateKey}`, { nextCursor: null, settled: true }] as const),
      ),
    )

  it('원장이 비어 있으면 전부 할 일이다', async () => {
    expect(await measureEnhancementHistory(['2026-09-04', '2026-09-05'], NOW)).toEqual({
      total: 6,
      hasPast: true,
    })
    expect(fetchEnhancementHistory).not.toHaveBeenCalled()
  })

  it('지난 날이 전부 굳었으면 안 띄운다', async () => {
    store.loadEnhancementChecks.mockResolvedValue(굳음(['2026-09-04', '2026-09-05']))

    expect(await measureEnhancementHistory(['2026-09-04', '2026-09-05'], NOW)).toEqual({
      total: 0,
      hasPast: false,
    })
  })

  // 오늘은 굳을 수 없어 어느 회차에나 든다. 세면 이미 받아 둔 달로 돌아올 때도 참이 된다.
  // 다만 **분모에는 든다**. 그 셋도 실제로 부르는 일이다.
  it('오늘만 남으면 분모는 있고 모달은 없다', async () => {
    store.loadEnhancementChecks.mockResolvedValue(굳음(['2026-09-05']))

    expect(await measureEnhancementHistory(['2026-09-05', '2026-09-06'], NOW)).toEqual({
      total: 3,
      hasPast: false,
    })
  })

  // 월간 격자는 앞뒤 달의 날을 함께 그린다. 지난 달에서 한 칸 더 물러나면 꼬리에 **이미 받아 둔
  // 다음 달**의 며칠이 들어오는데, 굳은 칸이 하나라도 있나 로 물으면 처음 여는 달에서 모달이 영영
  // 안 뜬다(실기기 2026-09-07).
  it('이웃 달의 굳은 칸이 꼬리에 섞여 있어도 띄운다', async () => {
    store.loadEnhancementChecks.mockResolvedValue(굳음(['2026-09-01', '2026-09-02']))

    const grid = ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02']
    expect(await measureEnhancementHistory(grid, NOW)).toEqual({ total: 6, hasPast: true })
  })

  // 격자 꼬리의 미래 날짜는 계획이 이미 뺀다. 분모에도 안 든다.
  it('아직 오지 않은 날은 안 센다', async () => {
    store.loadEnhancementChecks.mockResolvedValue(굳음(['2026-09-05']))

    expect(await measureEnhancementHistory(['2026-09-05', '2026-09-07', '2026-09-08'], NOW)).toEqual({
      total: 0,
      hasPast: false,
    })
  })
})

describe('수집', () => {
  it('분모를 콜 전에 알린다', async () => {
    const seen: [number, number][] = []
    await collectEnhancementHistory(['2026-09-05'], NOW, (done, total) => seen.push([done, total]))

    expect(seen[0]).toEqual([0, 3])
    expect(seen[seen.length - 1]).toEqual([3, 3])
  })

  it('부를 것이 없어도 한 번은 알린다', async () => {
    const seen: [number, number][] = []
    await collectEnhancementHistory([], NOW, (done, total) => seen.push([done, total]))

    expect(seen).toEqual([[0, 0]])
  })

  it('받은 줄을 넣는다', async () => {
    fetchEnhancementHistory.mockResolvedValue(page(['a', 'b']))
    await collectEnhancementHistory(['2026-09-05'], NOW)

    expect(store.saveEnhancementHistory).toHaveBeenCalledWith('cube', expect.arrayContaining([
      expect.objectContaining({ id: 'a' }),
    ]))
  })

  it('커서가 있으면 이어 받는다', async () => {
    fetchEnhancementHistory.mockImplementation((_key, kind, query) => {
      if (kind !== 'cube') return Promise.resolve(page([]))
      return Promise.resolve(query.cursor === undefined ? page(['a'], 'c1') : page(['b'], null))
    })

    await collectEnhancementHistory(['2026-09-05'], NOW)

    const cube = fetchEnhancementHistory.mock.calls.filter((call) => call[1] === 'cube')
    expect(cube.map((call) => call[2])).toEqual([{ dateKey: '2026-09-05' }, { cursor: 'c1' }])
  })

  // 커서를 따라가다 이미 넣은 줄을 만나면 그 아래는 다 들어 있다.
  it('아는 id 를 만나면 멈춘다', async () => {
    store.loadKnownHistoryIds.mockResolvedValue(new Set(['b']))
    // 커서가 끊이지 않는다. 멈추는 것은 아는 id 뿐이다.
    fetchEnhancementHistory.mockImplementation((_key, _kind, query) =>
      Promise.resolve(query.cursor === undefined ? page(['a'], 'c1') : page(['b'], 'c2')),
    )

    await collectEnhancementHistory(['2026-09-05'], NOW)

    // 종류마다 2쪽씩. 3쪽째는 안 부른다.
    expect(fetchEnhancementHistory).toHaveBeenCalledTimes(6)
  })

  // 안전핀. 커서가 영영 안 끊기고 아는 id 도 안 나오면 그 칸이 무한히 돈다.
  it('쪽수에 상한이 있다', async () => {
    fetchEnhancementHistory.mockResolvedValue(page(['x'], 'endless'))

    await collectEnhancementHistory(['2026-09-05'], NOW)

    expect(fetchEnhancementHistory).toHaveBeenCalledTimes(150)
  })

  it('지난 날짜는 다 받으면 굳힌다', async () => {
    await collectEnhancementHistory(['2026-09-05'], NOW)

    expect(store.markEnhancementChecked).toHaveBeenCalledWith(
      'cube', '2026-09-05', null, true, expect.any(String),
    )
  })

  it('오늘은 안 굳힌다', async () => {
    await collectEnhancementHistory(['2026-09-06'], NOW)

    expect(store.markEnhancementChecked).toHaveBeenCalledWith(
      'cube', '2026-09-06', null, false, expect.any(String),
    )
  })

  // 읽는 쪽이 이것을 쓴다. 칸 하나 그릴 때마다 계정 목록을 부를 수는 없다.
  it('받은 스페셜 이름을 남긴다', async () => {
    await collectEnhancementHistory(['2026-09-05'], NOW)

    expect(saveEventWorldNames).toHaveBeenCalledWith(new Set(['머리맨들맨둘']))
  })

  // 정정 4. 목록을 못 받으면 큐브·잠재의 스페셜을 가릴 수가 없다.
  it('계정 목록을 못 받으면 안 굳힌다', async () => {
    fetchCharacterList.mockRejectedValue(new Error('boom'))
    await collectEnhancementHistory(['2026-09-05'], NOW)

    expect(store.markEnhancementChecked).toHaveBeenCalledWith(
      'cube', '2026-09-05', null, false, expect.any(String),
    )
  })

  it('그래도 줄은 받아 둔다. 사실은 사실이다', async () => {
    fetchCharacterList.mockRejectedValue(new Error('boom'))
    fetchEnhancementHistory.mockResolvedValue(page(['a']))
    await collectEnhancementHistory(['2026-09-05'], NOW)

    expect(store.saveEnhancementHistory).toHaveBeenCalled()
  })

  // 던지면 원장에 안 적혀 다음 회차가 다시 온다.
  it('한 종류가 던져도 나머지는 나간다', async () => {
    fetchEnhancementHistory
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(page(['a']))

    await collectEnhancementHistory(['2026-09-05'], NOW)

    expect(store.markEnhancementChecked).toHaveBeenCalledTimes(2)
  })

  it('키가 없으면 아무것도 안 부른다', async () => {
    getAuthConfig.mockResolvedValue(null)
    const seen: [number, number][] = []
    await collectEnhancementHistory(['2026-09-05'], NOW, (d, t) => seen.push([d, t]))

    expect(fetchEnhancementHistory).not.toHaveBeenCalled()
    expect(seen).toEqual([[0, 0]])
  })
})
