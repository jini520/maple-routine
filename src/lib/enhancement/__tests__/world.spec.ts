import type { MapleAccount } from '../../../types'
import { eventWorldCharacterNames, judgeEventWorld, listedJudgmentsOf, type EventWorldEvidence } from '../world'

const accounts: MapleAccount[] = [
  {
    accountId: 'a',
    characters: [
      { ocid: '1', name: '머리맨들맨둘', world: '스페셜', worldKey: 'special', jobClass: '히어로', level: 290 },
      { ocid: '2', name: '낟낟', world: '엘리시움', worldKey: 'elysium', jobClass: '비숍', level: 285 },
      { ocid: '3', name: '지내우시', world: '챌린저스2', worldKey: 'challengers_2', jobClass: '팔라딘', level: 260 },
      { ocid: '4', name: '새월드', world: '스페셜3', worldKey: null, jobClass: '팔라딘', level: 260 },
    ],
  },
]

const evidence = (over: Partial<EventWorldEvidence> = {}): EventWorldEvidence => ({
  listed: listedJudgmentsOf(accounts),
  remembered: new Map(),
  ...over,
})

/** 큐브 · 잠재 · 소울 줄. 응답에 월드가 없다. */
const nameOnly = (characterName: string, dateKey: string, from: EventWorldEvidence) =>
  judgeEventWorld('', characterName, dateKey, from)

// 이벤트 월드인지는 월드 표의 칸이 정한다(`lib/world/worlds` 의 `isEventWorld`). 챌린저스는 재화가 본섭으로 넘어와 아니다.
describe('이름으로 거를 대상', () => {
  it('이벤트 월드 캐릭터의 이름만 모은다', () => {
    expect(eventWorldCharacterNames(accounts)).toEqual(new Set(['머리맨들맨둘']))
  })

  // 목록 캐시가 월드 표를 받기 전에 정규화되면 worldKey 가 빈다. 그 key 로 가르면 스페셜 캐릭터가 일반 월드로 풀린다.
  it('캐시의 worldKey 가 비어도 월드 이름을 지금 표에서 다시 찾는다', () => {
    const stale: MapleAccount[] = [
      { accountId: 'b', characters: [{ ocid: '5', name: '빈키', world: '스페셜2', worldKey: null, jobClass: '히어로', level: 1 }] },
    ]
    expect(eventWorldCharacterNames(stale)).toEqual(new Set(['빈키']))
    expect(nameOnly('빈키', '2025-11-25', evidence({ listed: listedJudgmentsOf(stale) })).eventWorld).toBe(true)
  })
})

// 스타포스는 줄이 그때의 월드를 준다. 지금 목록보다 정확하고, 캐릭터를 지워도 남는다.
describe('월드를 주는 줄', () => {
  it('그 월드로 판정하고 목록은 안 본다', () => {
    expect(judgeEventWorld('스페셜2', '낟낟', '2025-11-25', evidence()).eventWorld).toBe(true)
    expect(judgeEventWorld('엘리시움', '머리맨들맨둘', '2025-11-25', evidence()).eventWorld).toBe(false)
    expect(judgeEventWorld('챌린저스2', '누구든', '2025-11-25', evidence({ listed: null })).eventWorld).toBe(false)
  })

  // 표에 없는 월드를 일반 월드로 세면 새 이벤트 월드의 지출이 그대로 굳는다(스페셜2 가 그랬다).
  it('표에 없는 월드는 모름이고 그 월드 이름을 든다', () => {
    expect(judgeEventWorld('스페셜3', '누구든', '2025-11-25', evidence())).toEqual({
      eventWorld: null,
      unknownWorld: '스페셜3',
    })
  })
})

describe('월드를 주지 않는 줄', () => {
  it('목록에 있는 이름은 그 캐릭터의 월드로 판정한다', () => {
    expect(nameOnly('머리맨들맨둘', '2025-11-25', evidence()).eventWorld).toBe(true)
    expect(nameOnly('낟낟', '2025-11-25', evidence()).eventWorld).toBe(false)
  })

  it('목록 캐릭터의 월드가 표에 없으면 모름이고 그 월드 이름을 든다', () => {
    expect(nameOnly('새월드', '2025-11-25', evidence())).toEqual({ eventWorld: null, unknownWorld: '스페셜3' })
  })

  // 목록이 1순위다. 남겨 둔 이름이라도 목록에 일반 월드로 있으면 일반 월드다.
  it('목록에 있으면 남겨 둔 이름보다 목록이 이긴다', () => {
    const remembered = new Map([['낟낟', ['special']]])
    expect(nameOnly('낟낟', '2025-11-25', evidence({ remembered })).eventWorld).toBe(false)
  })

  // 이벤트가 끝나기 전에 지운 캐릭터는 목록에 없다. 스타포스에서 본 월드의 기간 안이면 뺀다.
  it('목록에 없는 이름은 남겨 둔 월드의 기간 안이면 이벤트 월드다', () => {
    const remembered = new Map([['지운캐릭', ['special_2']]])
    expect(nameOnly('지운캐릭', '2025-11-20', evidence({ remembered })).eventWorld).toBe(true)
    expect(nameOnly('지운캐릭', '2025-12-18', evidence({ remembered })).eventWorld).toBe(true)
  })

  it('남겨 둔 이름이라도 기간 밖이면 일반 월드다', () => {
    const remembered = new Map([['지운캐릭', ['special_2']]])
    expect(nameOnly('지운캐릭', '2025-11-19', evidence({ remembered })).eventWorld).toBe(false)
    expect(nameOnly('지운캐릭', '2025-12-19', evidence({ remembered })).eventWorld).toBe(false)
  })

  // 삭제 · 이전으로 목록에서 사라진 일반 캐릭터는 앞으로도 영영 목록에 안 나온다. 모름으로 두면 그 날을 영원히 다시 부른다.
  it('목록에도 없고 남겨 둔 이름도 아니면 일반 월드다', () => {
    expect(nameOnly('살름', '2025-11-25', evidence()).eventWorld).toBe(false)
    expect(nameOnly('살름', '2025-11-25', evidence({ listed: new Map() })).eventWorld).toBe(false)
  })

  // 목록을 못 받은 것과 목록에 없는 것은 다르다. 앞은 다음 회차가 회복하고 뒤는 답이 난 것이다.
  it('목록을 못 받았으면 모름이다', () => {
    const remembered = new Map([['지운캐릭', ['special_2']]])
    expect(nameOnly('머리맨들맨둘', '2025-11-25', evidence({ listed: null }))).toEqual({ eventWorld: null, unknownWorld: null })
    expect(nameOnly('지운캐릭', '2025-11-25', evidence({ listed: null, remembered })).eventWorld).toBeNull()
  })
})
