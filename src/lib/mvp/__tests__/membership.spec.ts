import { type CharacterAccountSighting, accountOfName, accountOfOcid } from '../membership'

// 루디는 1월부터 4월까지 A 의 캐릭터였고 이름을 바꿨다. 6월부터 B 의 다른 캐릭터가 그 이름을 쓴다.
const SIGHTINGS: CharacterAccountSighting[] = [
  { ocid: 'x', name: '루디', accountId: 'A', firstSeenOn: '2026-01-10', lastSeenOn: '2026-04-10' },
  { ocid: 'x', name: '루디2', accountId: 'A', firstSeenOn: '2026-04-11', lastSeenOn: '2026-09-22' },
  { ocid: 'y', name: '루디', accountId: 'B', firstSeenOn: '2026-06-01', lastSeenOn: '2026-09-22' },
]

describe('이름으로 찾는 소속', () => {
  it('그 날 이하에서 가장 늦게 본 기록의 ID 다', () => {
    expect(accountOfName(SIGHTINGS, '루디', '2026-03-01')).toBe('A')
    expect(accountOfName(SIGHTINGS, '루디', '2026-05-01')).toBe('A') // 이름을 바꾼 뒤지만 B 는 아직 안 봤다
    expect(accountOfName(SIGHTINGS, '루디', '2026-07-01')).toBe('B')
  })

  it('처음 본 날보다 앞이면 모른다', () => {
    expect(accountOfName(SIGHTINGS, '루디', '2026-01-09')).toBeNull()
    expect(accountOfName(SIGHTINGS, '없는이름', '2026-07-01')).toBeNull()
  })
})

describe('ocid 로 찾는 소속', () => {
  it('가장 늦게 본 기록의 ID 다', () => {
    expect(accountOfOcid(SIGHTINGS, 'y')).toBe('B')
    expect(accountOfOcid(SIGHTINGS, 'z')).toBeNull()
  })
})
