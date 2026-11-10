import type { MapleAccount } from '../../../types'
import { eventWorldCharacterNames, judgeEventWorld, type OwnerWorld } from '../world'

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

/** 줄을 붙인 캐릭터. 기본은 리프 전이 아니고 월드를 모른다. */
const owner = (over: Partial<OwnerWorld> = {}): OwnerWorld => ({ worldName: null, worldKey: null, preLeap: false, ...over })

/** 큐브 · 잠재 · 소울 줄. 응답에 월드가 없다. */
const nameOnly = (of: OwnerWorld) => judgeEventWorld('', of)

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
    expect(nameOnly(owner({ worldName: '스페셜2' })).eventWorld).toBe(true)
  })
})

// 스타포스는 줄이 그때의 월드를 준다. 캐릭터의 지금 월드보다 정확하고, 캐릭터를 지워도 남는다.
describe('월드를 주는 줄', () => {
  it('그 월드로 판정하고 캐릭터의 월드는 안 본다', () => {
    expect(judgeEventWorld('스페셜2', owner({ worldName: '엘리시움' })).eventWorld).toBe(true)
    expect(judgeEventWorld('엘리시움', owner({ worldName: '스페셜' })).eventWorld).toBe(false)
    expect(judgeEventWorld('챌린저스2', owner({ preLeap: true })).eventWorld).toBe(false)
  })

  // 표에 없는 월드를 일반 월드로 세면 새 이벤트 월드의 지출이 그대로 굳는다(스페셜2 가 그랬다).
  it('표에 없는 월드는 모름이고 그 월드 이름을 든다', () => {
    expect(judgeEventWorld('스페셜3', owner())).toEqual({ eventWorld: null, unknownWorld: '스페셜3' })
  })
})

// 큐브 · 잠재 · 소울은 줄을 붙인 캐릭터의 월드로 가른다. 같은 ocid 의 월드는 바뀌지 않는다.
describe('월드를 주지 않는 줄', () => {
  it('붙인 캐릭터의 월드로 판정한다. 월드 이름이 없으면 월드 key 로 본다', () => {
    expect(nameOnly(owner({ worldName: '스페셜' })).eventWorld).toBe(true)
    expect(nameOnly(owner({ worldName: '엘리시움' })).eventWorld).toBe(false)
    expect(nameOnly(owner({ worldKey: 'special_2' })).eventWorld).toBe(true)
  })

  it('붙인 캐릭터의 월드가 표에 없으면 모름이고 그 월드 이름을 든다', () => {
    expect(nameOnly(owner({ worldName: '스페셜3' }))).toEqual({ eventWorld: null, unknownWorld: '스페셜3' })
  })

  // 스페셜 월드에서 일반 월드로는 리프할 수 없다. 리프 전 줄을 모름으로 두면 그 날이 굳지 않는다.
  it('리프 전 줄은 이벤트 월드가 아니다', () => {
    expect(nameOnly(owner({ preLeap: true, worldKey: 'challengers_2' })).eventWorld).toBe(false)
  })

  // 목록에서 사라진 캐릭터의 월드를 모를 수 있다. 모름으로 두면 그 날을 영원히 다시 부른다.
  it('캐릭터의 월드를 모르면 일반 월드다', () => {
    expect(nameOnly(owner())).toEqual({ eventWorld: false, unknownWorld: null })
  })
})
