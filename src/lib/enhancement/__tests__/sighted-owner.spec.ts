// 강화 줄의 이름을 ocid 에 붙이는 첫 차례. 앱이 그 이름으로 그 캐릭터를 본 기간 안의 날이면 넥슨을 부르지 않고 붙인다.
import { sightedOwnerOf, type OwnerSighting } from '../sighted-owner'

function 본것(ocid: string, name: string, from: string, to: string, nexonAccountId: string | null = 'account-a'): OwnerSighting {
  return { ocid, name, accountId: `maple-${ocid}`, nexonAccountId, firstSeenOn: from, lastSeenOn: to }
}

describe('sightedOwnerOf', () => {
  it('그 이름으로 본 기간 안의 날이면 그 캐릭터다. 기간 밖이면 없다', () => {
    const sightings = [본것('o-1', '낟낟', '2026-01-08', '2026-03-01')]

    expect(sightedOwnerOf(sightings, '낟낟', '2026-02-01', 'account-a')?.ocid).toBe('o-1')
    expect(sightedOwnerOf(sightings, '낟낟', '2026-01-07', 'account-a')).toBeNull()
    expect(sightedOwnerOf(sightings, '낟낟', '2026-03-02', 'account-a')).toBeNull()
  })

  // 이름을 바꾸면 줄이 둘이다. 그날 그 이름이었던 캐릭터를 찾는 것이라 지금 이름으로 맞추지 않는다.
  it('이름을 바꾼 캐릭터는 그날의 이름으로 찾는다', () => {
    const sightings = [본것('o-1', '살름', '2026-01-01', '2026-01-07'), 본것('o-1', '낟낟', '2026-01-08', '2026-03-01')]

    expect(sightedOwnerOf(sightings, '살름', '2026-01-05', 'account-a')?.ocid).toBe('o-1')
    expect(sightedOwnerOf(sightings, '낟낟', '2026-01-05', 'account-a')).toBeNull()
  })

  // 계정 id 는 기기가 만든 값이라 옛 번호로 받은 줄과 새 번호로 적힌 소속이 엇갈릴 수 있다. 그래도 그 캐릭터의 줄이다.
  it('같은 넥슨 계정에서 본 것을 먼저 고르고, 없으면 다른 계정 id 나 계정을 모르는 기록도 본다', () => {
    const sightings = [본것('o-다른', '루디', '2026-01-01', '2026-03-01', 'account-b'), 본것('o-내', '루디', '2026-01-01', '2026-03-01')]

    expect(sightedOwnerOf(sightings, '루디', '2026-02-01', 'account-a')?.ocid).toBe('o-내')
    expect(sightedOwnerOf([본것('o-옛', '루디', '2026-01-01', '2026-03-01', '')], '루디', '2026-02-01', 'account-a')?.ocid).toBe('o-옛')
    expect(sightedOwnerOf([본것('o-새번호', '루디', '2026-01-01', '2026-03-01', 'account-새')], '루디', '2026-02-01', 'account-a')?.ocid).toBe(
      'o-새번호',
    )
  })

  // 어느 캐릭터의 기록인지 모르는 줄은 붙이지 않는다. 틀리게 붙이면 다른 캐릭터의 지출이 된다.
  it('같은 날 같은 이름으로 본 캐릭터가 둘이면 고르지 않는다', () => {
    const sightings = [본것('o-1', '루디', '2026-01-01', '2026-03-01', ''), 본것('o-2', '루디', '2026-01-01', '2026-03-01', '')]

    expect(sightedOwnerOf(sightings, '루디', '2026-02-01', 'account-a')).toBeNull()
  })
})
