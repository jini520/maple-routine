// 키를 쓰던 사용자가 로그인을 붙였을 때 어느 키를 지워도 되는지 가린다. 여기서 막는 사고는
// 다른 넥슨 계정의 키를 지워 그 계정의 캐릭터를 통째로 잃는 것이다.
import { apiKeysCoveredByLogin } from '../covered-keys'
import type { MapleAccount } from '../../types'

const 로그인 = { kind: 'login', value: '세션' } as const
const 키가 = { kind: 'apiKey', value: '키-가' } as const
const 키나 = { kind: 'apiKey', value: '키-나' } as const

function 계정(accountId: string, ...ocids: string[]): MapleAccount {
  return {
    accountId,
    characters: ocids.map((ocid) => ({
      ocid,
      name: ocid,
      world: '엘리시움',
      worldKey: 'elysium',
      jobClass: '렌',
      level: 200,
    })),
  }
}

describe('같은 계정이면 지운다', () => {
  it('ocid 집합이 같으면 그 키를 지운다', () => {
    // 같은 계정을 두 수단으로 들고 있을 이유가 없고, 키는 평문으로 저장돼 있어 지우는 쪽이
    // 안전하다.
    const covered = apiKeysCoveredByLogin([
      { credential: 로그인, accounts: [계정('id-1', 'o1', 'o2')] },
      { credential: 키가, accounts: [계정('id-1', 'o1', 'o2')] },
    ])

    expect(covered).toEqual(['키-가'])
  })

  it('순서가 달라도 집합으로 본다', () => {
    const covered = apiKeysCoveredByLogin([
      { credential: 로그인, accounts: [계정('id-1', 'o2', 'o1')] },
      { credential: 키가, accounts: [계정('id-1', 'o1', 'o2')] },
    ])

    expect(covered).toEqual(['키-가'])
  })

  it('메이플 ID 가 여럿이어도 ocid 를 통째로 본다', () => {
    // 계정을 넘어 고르는 것이 본론이라 메이플 ID 별로 나눠 볼 이유가 없다.
    const covered = apiKeysCoveredByLogin([
      { credential: 로그인, accounts: [계정('id-1', 'o1'), 계정('id-2', 'o2')] },
      { credential: 키가, accounts: [계정('id-1', 'o1'), 계정('id-2', 'o2')] },
    ])

    expect(covered).toEqual(['키-가'])
  })
})

describe('다른 계정이면 둔다', () => {
  it('겹치는 ocid 가 하나도 없으면 안 지운다', () => {
    // 그 키가 다른 넥슨 계정이라는 뜻이다. 지우면 그 계정의 캐릭터를 잃는다.
    const covered = apiKeysCoveredByLogin([
      { credential: 로그인, accounts: [계정('id-1', 'o1')] },
      { credential: 키가, accounts: [계정('id-2', 'o2')] },
    ])

    expect(covered).toEqual([])
  })

  it('키에만 있는 ocid 가 하나라도 있으면 안 지운다', () => {
    const covered = apiKeysCoveredByLogin([
      { credential: 로그인, accounts: [계정('id-1', 'o1')] },
      { credential: 키가, accounts: [계정('id-1', 'o1', 'o2')] },
    ])

    expect(covered).toEqual([])
  })

  it('키가 여럿이면 덮인 것만 지운다', () => {
    const covered = apiKeysCoveredByLogin([
      { credential: 로그인, accounts: [계정('id-1', 'o1')] },
      { credential: 키가, accounts: [계정('id-1', 'o1')] },
      { credential: 키나, accounts: [계정('id-2', 'o2')] },
    ])

    expect(covered).toEqual(['키-가'])
  })
})

describe('판정을 못 하면 안 지운다', () => {
  it('로그인이 없으면 지울 근거가 없다', () => {
    const covered = apiKeysCoveredByLogin([{ credential: 키가, accounts: [계정('id-1', 'o1')] }])

    expect(covered).toEqual([])
  })

  it('로그인이 캐릭터를 하나도 안 줬으면 안 지운다', () => {
    // 조회가 실패했거나 아직 캐릭터가 없는 계정이다. 빈 집합이 모든 것을 덮는다고 읽으면
    // 멀쩡한 키가 통째로 사라진다.
    const covered = apiKeysCoveredByLogin([
      { credential: 로그인, accounts: [] },
      { credential: 키가, accounts: [계정('id-1', 'o1')] },
    ])

    expect(covered).toEqual([])
  })

  it('키가 캐릭터를 하나도 안 줬으면 안 지운다', () => {
    // 빈 키는 **전부 덮인다** 로 읽히지만, 그 키가 조회에 실패한 것일 수 있다. 지울 근거가 못 된다.
    const covered = apiKeysCoveredByLogin([
      { credential: 로그인, accounts: [계정('id-1', 'o1')] },
      { credential: 키가, accounts: [] },
    ])

    expect(covered).toEqual([])
  })

  it('수단이 없으면 빈 목록이다', () => {
    expect(apiKeysCoveredByLogin([])).toEqual([])
  })
})
