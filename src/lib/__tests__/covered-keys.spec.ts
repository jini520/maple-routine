// 키를 쓰던 사용자가 로그인을 붙였을 때 어느 키를 서버에서 잇고 지울지 가린다. 여기서 막는 사고는
// 다른 넥슨 계정의 키를 지워 그 계정의 캐릭터를 통째로 잃는 것이다.
import { apiKeysCoveredByLogin } from '../covered-keys'
import type { MapleAccount } from '../../types'

const 로그인 = { type: 'login', value: '세션', accountId: null } as const
const 키가 = { type: 'key', value: '키-가', accountId: null } as const
const 키나 = { type: 'key', value: '키-나', accountId: null } as const

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

describe('메이플 ID 가 같으면 고른다', () => {
  it('메이플 ID 집합이 같으면 그 키를 고른다', () => {
    const covered = apiKeysCoveredByLogin([
      { credential: 로그인, accounts: [계정('id-1', 'o1'), 계정('id-2', 'o2')] },
      { credential: 키가, accounts: [계정('id-2', 'o2'), 계정('id-1', 'o1')] },
    ])

    expect(covered).toEqual(['키-가'])
  })

  // 기준은 메이플 ID 다. 캐릭터는 메이플 ID 아래에서 생기고 지워진다.
  it('캐릭터가 달라도 메이플 ID 가 같으면 고른다', () => {
    const covered = apiKeysCoveredByLogin([
      { credential: 로그인, accounts: [계정('id-1', 'o1', 'o2')] },
      { credential: 키가, accounts: [계정('id-1', 'o1')] },
    ])

    expect(covered).toEqual(['키-가'])
  })

  it('캐릭터가 하나도 없는 메이플 ID 도 견준다', () => {
    const covered = apiKeysCoveredByLogin([
      { credential: 로그인, accounts: [계정('id-1')] },
      { credential: 키가, accounts: [계정('id-1')] },
    ])

    expect(covered).toEqual(['키-가'])
  })
})

describe('메이플 ID 가 다르면 둔다', () => {
  it('캐릭터가 같아도 메이플 ID 가 다르면 고르지 않는다', () => {
    const covered = apiKeysCoveredByLogin([
      { credential: 로그인, accounts: [계정('id-1', 'o1')] },
      { credential: 키가, accounts: [계정('id-2', 'o1')] },
    ])

    expect(covered).toEqual([])
  })

  it('키에만 있는 메이플 ID 가 있으면 고르지 않는다', () => {
    // 지우면 그 메이플 ID 의 캐릭터를 볼 수 없게 된다.
    const covered = apiKeysCoveredByLogin([
      { credential: 로그인, accounts: [계정('id-1', 'o1')] },
      { credential: 키가, accounts: [계정('id-1', 'o1'), 계정('id-2', 'o2')] },
    ])

    expect(covered).toEqual([])
  })

  it('로그인에만 있는 메이플 ID 가 있어도 고르지 않는다', () => {
    const covered = apiKeysCoveredByLogin([
      { credential: 로그인, accounts: [계정('id-1', 'o1'), 계정('id-2', 'o2')] },
      { credential: 키가, accounts: [계정('id-1', 'o1')] },
    ])

    expect(covered).toEqual([])
  })

  it('키가 여럿이면 같은 것만 고른다', () => {
    const covered = apiKeysCoveredByLogin([
      { credential: 로그인, accounts: [계정('id-1', 'o1')] },
      { credential: 키가, accounts: [계정('id-1', 'o1')] },
      { credential: 키나, accounts: [계정('id-2', 'o2')] },
    ])

    expect(covered).toEqual(['키-가'])
  })
})

describe('판정을 못 하면 고르지 않는다', () => {
  it('로그인이 없으면 고를 근거가 없다', () => {
    const covered = apiKeysCoveredByLogin([{ credential: 키가, accounts: [계정('id-1', 'o1')] }])

    expect(covered).toEqual([])
  })

  it('로그인이 메이플 ID 를 하나도 안 줬으면 고르지 않는다', () => {
    // 조회가 실패했을 수 있다. 빈 집합을 같다고 읽으면 멀쩡한 키가 사라진다.
    const covered = apiKeysCoveredByLogin([
      { credential: 로그인, accounts: [] },
      { credential: 키가, accounts: [] },
    ])

    expect(covered).toEqual([])
  })

  it('키가 메이플 ID 를 하나도 안 줬으면 고르지 않는다', () => {
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
