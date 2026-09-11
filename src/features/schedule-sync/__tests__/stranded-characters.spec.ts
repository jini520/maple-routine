jest.mock('../../character-profile/resolve', () => ({ resolveDisplayProfiles: jest.fn() }))
jest.mock('../../../storage/schedule-probe-ledger', () => ({
  getScheduleProbeLedger: jest.fn(),
  markScheduleProbeUnavailable: jest.fn(),
}))
const {
  getScheduleProbeLedger: getScheduleProbeLedgerMock,
  markScheduleProbeUnavailable: markScheduleProbeUnavailableMock,
} = jest.requireMock('../../../storage/schedule-probe-ledger') as Record<string, jest.Mock>
const { resolveDisplayProfiles: resolveDisplayProfilesMock } = jest.requireMock(
  '../../character-profile/resolve',
) as Record<string, jest.Mock>

import {
  applyKnownUnavailable,
  findStrandedOcids,
  persistUnavailable,
  resolveStrandedCharacters,
} from '../stranded-characters'

const 프로필 = (name: string, world: string | null = '챌린저스2') => ({
  name,
  imageUrl: 'https://example.test/a.png',
  world,
  level: 285,
  unavailable: true,
})

beforeEach(() => {
  resolveDisplayProfilesMock.mockReset().mockResolvedValue(new Map())
  markScheduleProbeUnavailableMock.mockReset().mockResolvedValue(undefined)
  getScheduleProbeLedgerMock.mockReset().mockResolvedValue({ unavailable: false, dates: {} })
})

// 월드 이전으로 `character/list` 에서 빠진 ocid 는 `syncSchedules` 가 아예 안 돌려준다. 그것을
// 화면에서 버리면 캐릭터가 첫 페인트에 보였다가 동기화가 끝나는 순간 사라진다.
describe('findStrandedOcids', () => {
  it('동기화가 답하지 않은 추적 ocid 를 고른다', () => {
    expect(findStrandedOcids(['a', 'b', 'c'], [{ ocid: 'a' }, { ocid: 'c' }])).toEqual(['b'])
  })

  it('전원이 답했으면 빈 배열이다', () => {
    expect(findStrandedOcids(['a'], [{ ocid: 'a' }])).toEqual([])
  })

  // 401·429 는 전 캐릭터에 폴백 결과가 오므로 여기 안 걸린다. 그 실패까지 조회 불가로 읽으면
  // 키 하나 잘못 넣었을 때 전원이 조회 불가가 된다.
  it('추적 목록 순서를 지킨다', () => {
    expect(findStrandedOcids(['c', 'b', 'a'], [{ ocid: 'b' }])).toEqual(['c', 'a'])
  })
})

describe('resolveStrandedCharacters', () => {
  it('이름과 월드를 스냅샷에서 읽어 채운다', async () => {
    resolveDisplayProfilesMock.mockResolvedValue(new Map([['b', 프로필('지내우시')]]))

    await expect(resolveStrandedCharacters(['a', 'b'], [{ ocid: 'a' }])).resolves.toEqual([
      {
        ocid: 'b',
        characterName: '지내우시',
        world: '챌린저스2',
        level: 285,
        imageUrl: 'https://example.test/a.png',
      },
    ])
  })

  // 이름 없는 칸은 사용자에게 아무것도 안 말한다. 한 번도 조회된 적 없는 ocid 라 세울 수 없다.
  it('이름을 모르면 세우지 않는다', async () => {
    resolveDisplayProfilesMock.mockResolvedValue(new Map())

    await expect(resolveStrandedCharacters(['a', 'b'], [{ ocid: 'a' }])).resolves.toEqual([])
  })

  it('월드를 모르면 undefined 로 둔다', async () => {
    resolveDisplayProfilesMock.mockResolvedValue(new Map([['b', 프로필('지내우시', null)]]))

    const [stranded] = await resolveStrandedCharacters(['b'], [])
    expect(stranded?.world).toBeUndefined()
  })

  it('없으면 조회조차 안 한다', async () => {
    await expect(resolveStrandedCharacters(['a'], [{ ocid: 'a' }])).resolves.toEqual([])
    expect(resolveDisplayProfilesMock).not.toHaveBeenCalled()
  })
})

// 조회 불가는 `character_profiles.unavailable` 에 남아 있다. 동기화가 끝나야 안다고 두면 그
// 사이에 스케줄러가 **낡은 캐시로 컨텐츠 목록을 그린다** - 지금 할 일처럼 읽힌다.
describe('applyKnownUnavailable', () => {
  const 뷰 = (ocid: string) => ({ ocid, isStale: false, error: null })
  const 원장 = (unavailable: boolean) => ({ unavailable, dates: {} })

  it('원장이 조회 불가라고 한 캐릭터에 표식을 얹는다', async () => {
    getScheduleProbeLedgerMock.mockImplementation(async (ocid: string) => 원장(ocid === 'b'))

    const views = await applyKnownUnavailable([뷰('a'), 뷰('b')], (view) => view)

    expect(views[0]).toEqual({ ocid: 'a', isStale: false, error: null })
    expect(views[1]).toEqual({ ocid: 'b', isStale: true, error: { kind: 'characterUnavailable' } })
  })

  // **첫 페인트와 동기화 후가 같은 것을 그려야 한다.** 캐시 단계가 내용을 그대로 두면 링이
  // 진행률을 그렸다가 동기화가 끝나는 순간 빈 링으로 바뀐다(관측된 증상).
  it('그 캐릭터의 내용을 모름 으로 비운다', async () => {
    getScheduleProbeLedgerMock.mockResolvedValue(원장(true))

    const views = await applyKnownUnavailable(
      [{ ...뷰('a'), items: [1, 2, 3] }],
      (view) => ({ ...view, items: [] }),
    )

    expect(views[0].items).toEqual([])
  })

  it('조용한 캐릭터의 내용은 안 비운다', async () => {
    getScheduleProbeLedgerMock.mockResolvedValue(원장(false))

    const views = await applyKnownUnavailable(
      [{ ...뷰('a'), items: [1, 2, 3] }],
      (view) => ({ ...view, items: [] }),
    )

    expect(views[0].items).toEqual([1, 2, 3])
  })

  it('원장이 조용하면 안 건드린다', async () => {
    getScheduleProbeLedgerMock.mockResolvedValue(원장(false))

    const views = await applyKnownUnavailable([뷰('a')], (view) => view)

    expect(views[0].error).toBeNull()
  })

  it('빈 목록이면 조회조차 안 한다', async () => {
    await expect(applyKnownUnavailable([], (view) => view)).resolves.toEqual([])
    expect(getScheduleProbeLedgerMock).not.toHaveBeenCalled()
  })

  // 원장을 못 읽어도 화면은 서야 한다.
  it('못 읽으면 그대로 돌려준다', async () => {
    getScheduleProbeLedgerMock.mockRejectedValue(new Error('prefs down'))

    await expect(applyKnownUnavailable([뷰('a')], (view) => view)).resolves.toEqual([뷰('a')])
  })
})


// 이 사실을 배우는 자리가 동기화라 쓰는 자리도 거기다. 화면 스토어에 두면 그 화면을 안 여는
// 사용자에게는 표가 영영 안 찬다(전에는 보스 수익 스토어가 이 일을 했다).
describe('persistUnavailable', () => {
  it('답하지 않은 캐릭터를 참으로 적는다', async () => {
    await persistUnavailable(['a', 'b'], [{ ocid: 'a' }])

    expect(markScheduleProbeUnavailableMock).toHaveBeenCalledWith('b', true)
  })

  // 안 내리면 조회가 다시 되는데 표식이 영영 남는다.
  it('답한 캐릭터는 거짓으로 되돌린다', async () => {
    await persistUnavailable(['a', 'b'], [{ ocid: 'a' }])

    expect(markScheduleProbeUnavailableMock).toHaveBeenCalledWith('a', false)
  })

  // **답했다고 조회된 것이 아니다.** 목록에는 있는데 400 `OPENAPI00003` 을 주는 캐릭터가 있고,
  // 그 결과까지 답함 으로 읽으면 그 코드가 방금 올린 표식을 여기서 곧바로 내린다.
  it('조회 불가로 답한 캐릭터는 참으로 남긴다', async () => {
    await persistUnavailable(['a'], [{ ocid: 'a', error: { kind: 'characterUnavailable' } }])

    expect(markScheduleProbeUnavailableMock).toHaveBeenCalledWith('a', true)
  })

  // 뒷정리라 못 썼다고 동기화가 실패하면 안 된다.
  it('쓰기가 실패해도 던지지 않는다', async () => {
    markScheduleProbeUnavailableMock.mockRejectedValue(new Error('prefs down'))

    await expect(persistUnavailable(['a'], [])).resolves.toBeUndefined()
  })
})
