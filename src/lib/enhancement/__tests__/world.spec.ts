import type { MapleAccount } from '../../../types'
import { eventWorldCharacterNames, isEventWorld, isSpendingRecord } from '../world'

const accounts: MapleAccount[] = [
  {
    accountId: 'a',
    characters: [
      { ocid: '1', name: '머리맨들맨둘', world: '스페셜', jobClass: '히어로', level: 290 },
      { ocid: '2', name: '낟낟', world: '엘리시움', jobClass: '비숍', level: 285 },
      { ocid: '3', name: '지내우시', world: '챌린저스2', jobClass: '팔라딘', level: 260 },
    ],
  },
]

describe('이벤트 월드', () => {
  it('스페셜만 이벤트 월드다', () => {
    expect(isEventWorld('스페셜')).toBe(true)
  })

  // 챌린저스는 시즌 월드지만 재화가 본섭으로 넘어온다(사용자 지정).
  it('챌린저스는 일반 월드다', () => {
    expect(isEventWorld('챌린저스')).toBe(false)
    expect(isEventWorld('챌린저스2')).toBe(false)
    expect(isEventWorld('엘리시움')).toBe(false)
  })
})

describe('이름으로 거를 대상', () => {
  it('이벤트 월드 캐릭터의 이름만 모은다', () => {
    expect(eventWorldCharacterNames(accounts)).toEqual(new Set(['머리맨들맨둘']))
  })

  it('계정이 없으면 빈 집합이다', () => {
    expect(eventWorldCharacterNames([])).toEqual(new Set())
  })
})

describe('지출로 세나', () => {
  const names = eventWorldCharacterNames(accounts)

  // 스타포스는 줄이 월드를 직접 준다. 그때의 월드라 지금 목록보다 정확하다.
  it('월드를 아는 줄은 그 값으로 판정한다', () => {
    expect(isSpendingRecord('스페셜', '누구든', names)).toBe(false)
    expect(isSpendingRecord('엘리시움', '머리맨들맨둘', names)).toBe(true)
  })

  // 큐브·잠재는 world_name 이 아예 없다. 이름이 유일한 단서다.
  it('월드를 모르는 줄은 이름으로 판정한다', () => {
    expect(isSpendingRecord(null, '머리맨들맨둘', names)).toBe(false)
    expect(isSpendingRecord(null, '낟낟', names)).toBe(true)
  })

  // 삭제·이전으로 목록에서 사라진 캐릭터가 실제로 다섯 있었다. 이 이름들은 **앞으로도 영영**
  // 목록에 안 나온다. 판정 불가로 두면 그 날짜를 영원히 다시 부른다.
  it('목록을 받았는데 없는 이름은 일반 캐릭터로 센다', () => {
    expect(isSpendingRecord(null, '살름', names)).toBe(true)
  })
})

// **목록을 못 받은 것과 목록에 없는 것은 다르다.** 앞은 회복되고 뒤는 안 된다.
describe('목록을 못 받았을 때', () => {
  it('월드를 모르는 줄은 판정 불가다', () => {
    expect(isSpendingRecord(null, '머리맨들맨둘', null)).toBeNull()
    expect(isSpendingRecord(null, '낟낟', null)).toBeNull()
  })

  // 스타포스는 줄이 월드를 들고 있어 목록이 없어도 답이 난다.
  it('월드를 아는 줄은 목록 없이도 판정된다', () => {
    expect(isSpendingRecord('스페셜', '머리맨들맨둘', null)).toBe(false)
    expect(isSpendingRecord('엘리시움', '낟낟', null)).toBe(true)
  })

  it('빈 목록은 못 받은 것이 아니다. 스페셜 캐릭터가 없는 계정이다', () => {
    expect(isSpendingRecord(null, '낟낟', new Set())).toBe(true)
  })
})
