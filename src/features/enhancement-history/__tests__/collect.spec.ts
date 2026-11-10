import { queryClient } from '../../query/client'
import { collectEnhancementHistory, measureEnhancementHistory, planEnhancementHistory } from '../collect'

jest.mock('../../../storage/api-key', () => ({ getAuthConfig: jest.fn() }))
jest.mock('../../auth/legacy-account-ids', () => ({ fillLegacyAccountIds: jest.fn() }))
jest.mock('../../../nexon/history/client', () => ({ fetchEnhancementHistory: jest.fn() }))
jest.mock('../../../nexon/character', () => ({ fetchCharacterList: jest.fn() }))
jest.mock('../event-world-names', () => ({ saveEventWorldNames: jest.fn() }))
jest.mock('../../../storage/enhancement-history', () => ({
  checkKey: (kind: string, dateKey: string) => `${kind}|${dateKey}`,
  loadEnhancementChecks: jest.fn(),
  markEnhancementChecked: jest.fn(),
}))
jest.mock('../../../storage/enhancement-totals', () => ({ replaceEnhancementTotals: jest.fn(), markEventWorldTotals: jest.fn() }))
jest.mock('../../../storage/event-world-characters', () => ({
  loadEventWorldCharacters: jest.fn(),
  rememberEventWorldCharacters: jest.fn(),
}))
jest.mock('../legacy-totals', () => ({ ensureEnhancementTotals: jest.fn() }))
jest.mock('../../../storage/enhancement-recomputes', () => ({
  loadRecomputeProgress: jest.fn(),
  saveRecomputeProgress: jest.fn(),
}))
jest.mock('../anomalies', () => ({ ...jest.requireActual('../anomalies'), reportEnhancementAnomalies: jest.fn() }))
jest.mock('../recompute', () => ({ ...jest.requireActual('../recompute'), RECOMPUTE_REQUESTS: [] }))

const { getAuthConfig } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>
const { fetchEnhancementHistory } = jest.requireMock('../../../nexon/history/client') as Record<string, jest.Mock>
const { fetchCharacterList } = jest.requireMock('../../../nexon/character') as Record<string, jest.Mock>
const store = jest.requireMock('../../../storage/enhancement-history') as Record<string, jest.Mock>
const { saveEventWorldNames } = jest.requireMock('../event-world-names') as Record<string, jest.Mock>
const { fillLegacyAccountIds } = jest.requireMock('../../auth/legacy-account-ids') as Record<string, jest.Mock>
const { replaceEnhancementTotals, markEventWorldTotals } = jest.requireMock('../../../storage/enhancement-totals') as Record<string, jest.Mock>
const remembered = jest.requireMock('../../../storage/event-world-characters') as Record<string, jest.Mock>
const { ensureEnhancementTotals } = jest.requireMock('../legacy-totals') as Record<string, jest.Mock>
const recomputes = jest.requireMock('../../../storage/enhancement-recomputes') as Record<string, jest.Mock>
const { RECOMPUTE_REQUESTS } = jest.requireMock('../recompute') as { RECOMPUTE_REQUESTS: unknown[] }
const { reportEnhancementAnomalies } = jest.requireMock('../anomalies') as Record<string, jest.Mock>
const setRequests = (requests: unknown[]) => RECOMPUTE_REQUESTS.splice(0, RECOMPUTE_REQUESTS.length, ...requests)

const NOW = new Date('2026-09-06T12:00:00+09:00')
const KINDS = ['cube', 'starforce', 'potential']

const page = (ids: string[], nextCursor: string | null = null) => ({
  rows: ids.map((id) => ({
    id,
    characterName: '낟낟',
    createdAt: '2026-09-05T07:00:00.000+09:00',
    dateKey: '2026-09-05',
    targetItem: '아케인셰이드 클로',
    itemKey: 'arcane_umbra_knuckle',
    itemLevel: 200,
    payload: { id },
  })),
  nextCursor,
})

beforeEach(() => {
  queryClient.clear()
  getAuthConfig.mockReset().mockResolvedValue({ login: null, mainKeyId: 'account-key', apiKeys: [{ type: 'key', id: 'account-key', label: '', value: 'k', loginId: null }] })
  fetchCharacterList.mockReset().mockResolvedValue([
    { accountId: 'a', characters: [{ ocid: '1', name: '머리맨들맨둘', world: '스페셜', worldKey: 'special', jobClass: '', level: 1 }] },
  ])
  fetchEnhancementHistory.mockReset().mockResolvedValue(page([]))
  store.loadEnhancementChecks.mockReset().mockResolvedValue(new Map())
  store.markEnhancementChecked.mockReset().mockResolvedValue(undefined)
  replaceEnhancementTotals.mockReset().mockResolvedValue(undefined)
  markEventWorldTotals.mockReset().mockResolvedValue(undefined)
  remembered.loadEventWorldCharacters.mockReset().mockResolvedValue(new Map())
  remembered.rememberEventWorldCharacters.mockReset().mockResolvedValue(undefined)
  ensureEnhancementTotals.mockReset().mockResolvedValue(undefined)
  recomputes.loadRecomputeProgress.mockReset().mockResolvedValue(new Map())
  recomputes.saveRecomputeProgress.mockReset().mockResolvedValue(undefined)
  setRequests([])
  reportEnhancementAnomalies.mockReset().mockResolvedValue(undefined)
  saveEventWorldNames.mockReset()
})

describe('계획', () => {
  // 분모가 여기서 확정된다. 콜은 한 건도 안 나간다.
  // 채우기 전에 읽으면 옛 조회 기록이 안 보여 이미 받은 날짜를 모두 다시 받는다.
  it('옛 조회 기록을 메인 계정으로 채운 뒤에 그 계정의 기록을 읽는다', async () => {
    const order: string[] = []
    fillLegacyAccountIds.mockImplementation(async () => {
      order.push('fill')
    })
    store.loadEnhancementChecks.mockImplementation(async () => {
      order.push('load')
      return new Map()
    })

    await planEnhancementHistory('account-key', ['2026-09-05'], '2026-09-06')

    expect(order).toEqual(['fill', 'load'])
    expect(store.loadEnhancementChecks).toHaveBeenCalledWith('account-key', ['2026-09-05'])
  })

  it('날짜마다 세 종류를 센다', async () => {
    expect(await planEnhancementHistory('account-key', ['2026-09-04', '2026-09-05'], '2026-09-06')).toHaveLength(6)
    expect(fetchEnhancementHistory).not.toHaveBeenCalled()
  })

  it('굳은 날짜는 안 센다', async () => {
    store.loadEnhancementChecks.mockResolvedValue(
      new Map(KINDS.map((kind) => [`${kind}|2026-09-04`, { nextCursor: null, settled: true }])),
    )

    expect(await planEnhancementHistory('account-key', ['2026-09-04', '2026-09-05'], '2026-09-06')).toHaveLength(3)
  })

  // 오늘은 굳을 수 없다. 원장에 settled 가 서 있어도 다시 센다.
  it('오늘은 언제나 센다', async () => {
    store.loadEnhancementChecks.mockResolvedValue(
      new Map(KINDS.map((kind) => [`${kind}|2026-09-06`, { nextCursor: 'c', settled: true }])),
    )

    expect(await planEnhancementHistory('account-key', ['2026-09-06'], '2026-09-06')).toHaveLength(3)
  })

  it('내일 이후는 안 센다', async () => {
    expect(await planEnhancementHistory('account-key', ['2026-09-07'], '2026-09-06')).toHaveLength(0)
  })

  // 소울 잠재능력은 2026-09-17 패치로 생겼다. 그 전 날짜는 부를 것이 없다.
  it('소울은 2026-09-17 부터만 센다', async () => {
    const jobs = await planEnhancementHistory('account-key', ['2026-09-16', '2026-09-17'], '2026-09-19')

    expect(jobs.filter((job) => job.kind === 'soul_potential')).toEqual([
      { kind: 'soul_potential', dateKey: '2026-09-17' },
    ])
    expect(jobs).toHaveLength(7)
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

  it('패치 뒤의 날짜는 소울 사용 내역도 부른다', async () => {
    await collectEnhancementHistory(['2026-09-18'], new Date('2026-09-19T12:00:00+09:00'))

    expect(fetchEnhancementHistory.mock.calls.map((call) => call[1]).sort()).toEqual(
      ['cube', 'potential', 'soul_potential', 'starforce'],
    )
  })

  it('받은 줄을 합계로 묶어 그 날 그 종류를 바꿔 적는다', async () => {
    fetchEnhancementHistory.mockImplementation((_key: string, kind: string) =>
      Promise.resolve(kind === 'cube' ? page(['a', 'b']) : page([])),
    )
    await collectEnhancementHistory(['2026-09-05'], NOW)

    expect(replaceEnhancementTotals).toHaveBeenCalledWith(
      'account-key',
      'cube',
      '2026-09-05',
      [expect.objectContaining({ itemKey: 'arcane_umbra_knuckle', attempts: 2, eventWorld: false })],
      NOW,
    )
  })

  // 합계에는 응답 줄의 id 가 없어 이미 받은 쪽을 가릴 수 없다. 앞쪽에서 멈추면 그 날 합계가 모자란다.
  it('커서가 있으면 끝까지 받아 모든 쪽을 한 합계로 묶는다', async () => {
    fetchEnhancementHistory.mockImplementation((_key, kind, _itemKeyOf, query) => {
      if (kind !== 'cube') return Promise.resolve(page([]))
      return Promise.resolve(query.cursor === undefined ? page(['a'], 'c1') : page(['b'], null))
    })

    await collectEnhancementHistory(['2026-09-05'], NOW)

    const cube = fetchEnhancementHistory.mock.calls.filter((call) => call[1] === 'cube')
    expect(cube.map((call) => call[3])).toEqual([{ dateKey: '2026-09-05' }, { cursor: 'c1' }])
    const cubeTotals = replaceEnhancementTotals.mock.calls.find((call) => call[1] === 'cube')
    expect(cubeTotals?.[3]).toEqual([expect.objectContaining({ attempts: 2 })])
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
      'account-key', 'cube', '2026-09-05', null, true, expect.any(String),
    )
  })

  it('오늘은 안 굳힌다', async () => {
    await collectEnhancementHistory(['2026-09-06'], NOW)

    expect(store.markEnhancementChecked).toHaveBeenCalledWith(
      'account-key', 'cube', '2026-09-06', null, false, expect.any(String),
    )
  })

  // 읽는 쪽이 이것을 쓴다. 칸 하나 그릴 때마다 계정 목록을 부를 수는 없다.
  it('받은 스페셜 이름을 남긴다', async () => {
    await collectEnhancementHistory(['2026-09-05'], NOW)

    expect(saveEventWorldNames).toHaveBeenCalledWith(new Set(['머리맨들맨둘']))
  })

  it('5분 안의 회차는 계정 목록을 다시 안 부른다. 캐릭터 관리와 같은 응답을 쓴다', async () => {
    await collectEnhancementHistory(['2026-09-05'], NOW)
    await collectEnhancementHistory(['2026-09-04'], NOW)

    expect(fetchCharacterList).toHaveBeenCalledTimes(1)
    expect(saveEventWorldNames).toHaveBeenCalledTimes(2)
  })

  // 정정 4. 목록을 못 받으면 큐브·잠재의 스페셜을 가릴 수가 없다.
  it('계정 목록을 못 받으면 안 굳힌다', async () => {
    fetchCharacterList.mockRejectedValue(new Error('boom'))
    await collectEnhancementHistory(['2026-09-05'], NOW)

    expect(store.markEnhancementChecked).toHaveBeenCalledWith(
      'account-key', 'cube', '2026-09-05', null, false, expect.any(String),
    )
  })

  // 합계는 적되 이벤트 월드 판정을 비운다. 비운 줄은 지출로 세지도 서버로 보내지도 않는다.
  it('그래도 합계는 적는다. 이벤트 월드 판정은 비운다', async () => {
    fetchCharacterList.mockRejectedValue(new Error('boom'))
    fetchEnhancementHistory.mockResolvedValue(page(['a']))
    await collectEnhancementHistory(['2026-09-05'], NOW)

    const cubeTotals = replaceEnhancementTotals.mock.calls.find((call) => call[1] === 'cube')
    expect(cubeTotals?.[3]).toEqual([expect.objectContaining({ eventWorld: null })])
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

// 계산 코드나 비용 표를 고친 기간은 굳은 날이라도 넥슨 API 에서 다시 받아야 지난 합계가 바뀐다.
/** 그 월드에서 한 스타포스 한 줄. 값을 매길 수 있는 줄이라 합계에 든다. */
const starforceRow = (characterName: string, worldName: string) => ({
  id: `${characterName}-${worldName}`,
  characterName,
  createdAt: '2026-09-05T07:00:00.000+09:00',
  dateKey: '2026-09-05',
  targetItem: '아케인셰이드 클로',
  itemKey: 'arcane_umbra_knuckle',
  itemLevel: null,
  payload: { world_name: worldName, before_starforce_count: 10, after_starforce_count: 11, upgrade_item: '' },
})

const starforceDay = (...rows: ReturnType<typeof starforceRow>[]) =>
  fetchEnhancementHistory.mockImplementation(async (_credential: unknown, kind: string) =>
    kind === 'starforce' ? { rows, nextCursor: null } : page([]),
  )

describe('이벤트 월드 판정', () => {
  // 이벤트가 끝나기 전에 캐릭터를 지우면 목록에서 사라진다. 그때 큐브 · 잠재 · 소울 줄을 가를 단서가 이것뿐이다.
  it('이벤트 월드 스타포스 줄의 이름과 월드를 남기고, 일반 월드 줄은 안 남긴다', async () => {
    starforceDay(starforceRow('지운캐릭', '스페셜2'), starforceRow('낟낟', '엘리시움'))

    await collectEnhancementHistory(['2026-09-05'], NOW)

    expect(remembered.rememberEventWorldCharacters).toHaveBeenCalledWith(
      'account-key',
      [{ characterName: '지운캐릭', worldKey: 'special_2' }],
      NOW,
    )
  })

  // 표에 넣으면 다음 회차가 다시 받아 판정해야 한다. 굳히면 그 기회가 사라진다.
  it('표에 없는 월드의 줄이 있는 날은 굳히지 않고 그 월드 이름을 알린다', async () => {
    starforceDay(starforceRow('새캐릭', '스페셜3'))

    await collectEnhancementHistory(['2026-09-05'], NOW)

    expect(store.markEnhancementChecked).toHaveBeenCalledWith(
      'account-key', 'starforce', '2026-09-05', null, false, expect.any(String),
    )
    expect(store.markEnhancementChecked).toHaveBeenCalledWith(
      'account-key', 'cube', '2026-09-05', null, true, expect.any(String),
    )
    expect(reportEnhancementAnomalies).toHaveBeenCalledWith([
      expect.objectContaining({ enhancementType: 'starforce', anomalyType: 'event_world_unknown', detail: '스페셜3' }),
    ])
  })

  // 한 회차의 일은 동시에 돈다. 큐브 날을 스타포스보다 먼저 매기면 이름을 남기기 전에 판정되고, 굳으면 다시 안 받는다.
  it('회차가 끝나면 목록에 없는 남겨 둔 이름의 줄을 그 월드의 기간으로 고친다', async () => {
    remembered.loadEventWorldCharacters.mockResolvedValue(
      new Map([
        ['지운캐릭', ['special_2']],
        ['머리맨들맨둘', ['special']],
      ]),
    )

    await collectEnhancementHistory(['2026-09-05'], NOW)

    expect(markEventWorldTotals.mock.calls).toEqual([['account-key', '지운캐릭', '2025-11-20', '2025-12-19']])
    const lastReplace = Math.max(...replaceEnhancementTotals.mock.invocationCallOrder)
    expect(markEventWorldTotals.mock.invocationCallOrder[0]).toBeGreaterThan(lastReplace)
  })

  // 목록이 1순위다. 목록 없이는 그 이름이 목록에 없는지 알 수 없다.
  it('목록을 못 받은 회차는 고치지 않는다', async () => {
    fetchCharacterList.mockRejectedValue(new Error('boom'))
    remembered.loadEventWorldCharacters.mockResolvedValue(new Map([['지운캐릭', ['special_2']]]))

    await collectEnhancementHistory(['2026-09-05'], NOW)

    expect(markEventWorldTotals).not.toHaveBeenCalled()
  })
})

describe('다시 매기기 요청', () => {
  const cubeRequest = (from: string, to: string) => ({ id: 'r1', from, to, kinds: ['cube'] })
  const settledDay = (dateKey: string) =>
    new Map(KINDS.map((kind) => [`${kind}|${dateKey}`, { nextCursor: null, settled: true }]))

  it('굳은 날도 요청이면 다시 받고 분모에 든다', async () => {
    store.loadEnhancementChecks.mockResolvedValue(settledDay('2026-09-04'))
    setRequests([cubeRequest('2026-09-04', '2026-09-04')])

    const jobs = await planEnhancementHistory('account-key', ['2026-09-05'], '2026-09-06')

    expect(jobs).toHaveLength(4)
    expect(jobs).toContainEqual({ kind: 'cube', dateKey: '2026-09-04' })
  })

  // 다시 매기기의 날은 이미 합계가 있어 화면에 그릴 것이 있다. 모달로 화면을 막을 이유가 없다.
  it('다시 매기기의 날만 남으면 분모에는 들고 모달은 없다', async () => {
    store.loadEnhancementChecks.mockResolvedValue(settledDay('2026-09-05'))
    setRequests([cubeRequest('2026-09-01', '2026-09-03')])

    expect(await measureEnhancementHistory(['2026-09-05'], NOW)).toEqual({ total: 3, hasPast: false })
  })

  // 범위의 날이 아직 안 받은 날이면 다시 매기기와 겹쳐도 그릴 것이 없다.
  it('다시 매기기와 겹친 범위의 날이 받을 날이면 모달을 띄운다', async () => {
    setRequests([cubeRequest('2026-09-04', '2026-09-04')])

    expect(await measureEnhancementHistory(['2026-09-04'], NOW)).toEqual({ total: 3, hasPast: true })
  })

  it('화면 범위의 일과 겹치면 한 번만 받는다', async () => {
    setRequests([cubeRequest('2026-09-05', '2026-09-05')])

    expect(await planEnhancementHistory('account-key', ['2026-09-05'], '2026-09-06')).toHaveLength(3)
  })

  it('끝난 요청은 다시 돌지 않는다', async () => {
    recomputes.loadRecomputeProgress.mockResolvedValue(new Map([['r1', { doneThroughDate: '2026-09-04', completed: true }]]))
    setRequests([cubeRequest('2026-09-04', '2026-09-04')])

    expect(await planEnhancementHistory('account-key', ['2026-09-05'], '2026-09-06')).toHaveLength(3)
  })

  it('요청의 날을 모두 받으면 마지막 날과 끝을 적는다', async () => {
    setRequests([cubeRequest('2026-09-03', '2026-09-04')])

    await collectEnhancementHistory([], NOW)

    expect(recomputes.saveRecomputeProgress).toHaveBeenCalledWith('account-key', 'r1', '2026-09-04', true, NOW)
  })

  // 적으면 실패한 날을 다시 받을 계기가 사라진다.
  it('하루라도 실패하면 진행을 적지 않는다', async () => {
    setRequests([cubeRequest('2026-09-03', '2026-09-04')])
    fetchEnhancementHistory.mockImplementation((_key, _kind, _itemKeyOf, query) =>
      query.dateKey === '2026-09-03' ? Promise.reject(new Error('boom')) : Promise.resolve(page([])),
    )

    await collectEnhancementHistory([], NOW)

    expect(recomputes.saveRecomputeProgress).not.toHaveBeenCalled()
  })

  // 로그인 계정의 강화 내역은 서버 스트림을 거친다. 스트림 요청 하나가 16MB 를 넘으면 남은 날이 실패해 같은 날들을 끝없이 다시 받는다.
  it('넥슨 로그인 계정은 한 회차에 60일만 받고 끝을 적지 않는다', async () => {
    getAuthConfig.mockResolvedValue({ login: { id: 'account-login', session: 's' }, mainKeyId: null, apiKeys: [] })
    setRequests([cubeRequest('2026-06-01', '2026-08-20')])

    await collectEnhancementHistory([], NOW)

    expect(fetchEnhancementHistory.mock.calls.map((call) => call[3].dateKey)).toHaveLength(60)
    expect(recomputes.saveRecomputeProgress).toHaveBeenCalledWith('account-login', 'r1', '2026-07-30', false, NOW)
  })

  it('기간이 통째로 조회 하한 앞이면 받지 않고 끝을 적는다', async () => {
    setRequests([cubeRequest('2020-01-01', '2020-01-02')])

    await collectEnhancementHistory([], NOW)

    expect(fetchEnhancementHistory).not.toHaveBeenCalled()
    expect(recomputes.saveRecomputeProgress).toHaveBeenCalledWith('account-key', 'r1', null, true, NOW)
  })
})

// 원본을 버리므로 빠진 줄은 받은 회차에서 알려야 원인을 볼 수 있다.
describe('합계에서 빠진 줄 알리기', () => {
  it('받은 날의 빠진 줄을 세어 알린다', async () => {
    // 이 줄은 시도 전 성수가 없어 비용을 못 매긴다.
    fetchEnhancementHistory.mockImplementation((_key: string, kind: string) =>
      Promise.resolve(kind === 'starforce' ? page(['sf']) : page([])),
    )

    await collectEnhancementHistory(['2026-09-05'], NOW)

    expect(reportEnhancementAnomalies).toHaveBeenCalledWith([
      expect.objectContaining({ historyDate: '2026-09-05', enhancementType: 'starforce', anomalyType: 'no_star', rowCount: 1 }),
    ])
  })

  it('목록을 못 받은 회차는 판정하지 못한 줄과 실패 이유를 알린다', async () => {
    fetchCharacterList.mockRejectedValue(new Error('boom'))
    fetchEnhancementHistory.mockImplementation((_key: string, kind: string) =>
      Promise.resolve(kind === 'cube' ? page(['a']) : page([])),
    )

    await collectEnhancementHistory(['2026-09-05'], NOW)

    expect(reportEnhancementAnomalies).toHaveBeenCalledWith([
      expect.objectContaining({ anomalyType: 'event_world_unknown', detail: 'Error: boom' }),
    ])
  })

  // 날마다 보내면 요청이 받은 날 수만큼 나간다. 로그인은 날들을 한꺼번에 받아 같은 순간에 몰려 nginx 속도 제한에 걸린다.
  it('회차에 받은 날들의 빠진 줄을 회차가 끝날 때 한 번에 알린다', async () => {
    fetchEnhancementHistory.mockImplementation((_key: string, kind: string) =>
      Promise.resolve(kind === 'starforce' ? page(['sf']) : page([])),
    )

    await collectEnhancementHistory(['2026-09-04', '2026-09-05'], NOW)

    expect(reportEnhancementAnomalies).toHaveBeenCalledTimes(1)
    expect(reportEnhancementAnomalies.mock.calls[0]?.[0]).toHaveLength(2)
  })
})

// 동시 3건은 API 키가 넥슨을 직접 부를 때의 한도다. 로그인 조회는 서버 스트림이 요청 하나로 묶고 넥슨을 부르는 속도도
// 서버가 정하므로, 3건씩 넘기면 작은 요청이 잦아질 뿐이다.
describe('자격마다 동시에 부르는 수', () => {
  const 닷새 = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']

  function 동시최대(): () => number {
    let inFlight = 0
    let max = 0
    fetchEnhancementHistory.mockImplementation(async () => {
      inFlight += 1
      max = Math.max(max, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 0))
      inFlight -= 1
      return page([])
    })
    return () => max
  }

  it('API 키는 한 번에 3건까지 부른다', async () => {
    const max = 동시최대()

    await collectEnhancementHistory(닷새, NOW)

    expect(max()).toBe(3)
  })

  it('로그인은 회차의 일을 한꺼번에 부른다', async () => {
    getAuthConfig.mockResolvedValue({ login: { id: 'account-login', session: 's' }, mainKeyId: null, apiKeys: [] })
    const max = 동시최대()

    await collectEnhancementHistory(닷새, NOW)

    expect(max()).toBe(닷새.length * KINDS.length)
  })
})

// 강화 내역은 계정 단위 API 다. 넥슨 계정마다 그 계정의 자격으로 받고, 조회 기록과 합계도 계정 id 로 나뉜다.
describe('넥슨 계정이 여럿', () => {
  beforeEach(() => {
    getAuthConfig.mockResolvedValue({
      login: { type: 'login', id: 'account-login', session: 's' },
      mainKeyId: null,
      apiKeys: [{ type: 'key', id: 'account-부', label: '', value: '부-키', loginId: 'account-login' }],
    })
    fetchCharacterList.mockImplementation(async (credential: { accountId: string }) => [
      {
        accountId: `maple-${credential.accountId}`,
        characters: [{ ocid: credential.accountId, name: `스페셜-${credential.accountId}`, world: '스페셜', worldKey: 'special', jobClass: '', level: 1 }],
      },
    ])
  })

  it('계정마다 그 계정의 자격으로 받아 그 계정 id 로 적고, 분모는 모든 계정의 합이다', async () => {
    const seen: [number, number][] = []

    await collectEnhancementHistory(['2026-09-05'], NOW, (done, total) => seen.push([done, total]))

    const pairs = fetchEnhancementHistory.mock.calls.map(([credential, kind]: [{ accountId: string }, string]) => `${credential.accountId}:${kind}`)
    expect(pairs.sort()).toEqual(
      ['account-login', 'account-부'].flatMap((account) => KINDS.map((kind) => `${account}:${kind}`)).sort(),
    )
    expect(new Set(replaceEnhancementTotals.mock.calls.map(([accountId]) => accountId))).toEqual(new Set(['account-login', 'account-부']))
    expect(seen[0]).toEqual([0, 6])
    expect(seen[seen.length - 1]).toEqual([6, 6])
    await expect(measureEnhancementHistory(['2026-09-05'], NOW)).resolves.toEqual({ total: 6, hasPast: true })
  })

  // 한 계정의 실패로 다른 계정의 강화 내역까지 멈추면 안 된다.
  it('한 계정의 날을 못 받아도 다른 계정의 날은 굳힌다', async () => {
    fetchEnhancementHistory.mockImplementation(async (credential: { accountId: string }) => {
      if (credential.accountId === 'account-부') throw new Error('401')
      return page([])
    })

    await collectEnhancementHistory(['2026-09-05'], NOW)

    const marked = store.markEnhancementChecked.mock.calls.map(([accountId]) => accountId)
    expect(new Set(marked)).toEqual(new Set(['account-login']))
    expect(marked).toHaveLength(3)
  })

  // 옛 원본은 계정 칸이 생기기 전의 메인 계정 기록이라, 부계정의 스페셜 이름이 섞이면 메인 계정의 줄을 잘못 가른다.
  it('옛 원본을 옮기는 단계에 남기는 스페셜 이름은 메인 계정의 목록에서만 온다', async () => {
    await collectEnhancementHistory(['2026-09-05'], NOW)

    expect(saveEventWorldNames).toHaveBeenCalledTimes(1)
    expect(saveEventWorldNames).toHaveBeenCalledWith(new Set(['스페셜-account-login']))
  })
})
