// 인증 수단이 여럿이면 `character/list` 응답도 여럿이다. 그것들을 하나의 메이플 ID 목록으로
// 합친다. 여기서 막는 사고는 같은 메이플 ID 가 두 번 서거나, 토큰이 만료된 뒤 그 ID 를
// 통째로 잃는 것이다.
import { mergeMapleIds } from '../maple-ids'
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

describe('합치기', () => {
  it('수단 하나면 그대로다', () => {
    const merged = mergeMapleIds([{ credential: 키가, accounts: [계정('id-1', 'o1')] }])

    expect(merged.map((one) => one.accountId)).toEqual(['id-1'])
    expect(merged[0]?.credential).toEqual(키가)
  })

  it('키가 여럿이면 각자의 메이플 ID 가 모두 선다', () => {
    // 복수 키의 목적이 다른 넥슨 계정의 캐릭터를 보는 것이다.
    const merged = mergeMapleIds([
      { credential: 키가, accounts: [계정('id-1', 'o1')] },
      { credential: 키나, accounts: [계정('id-2', 'o2')] },
    ])

    expect(merged.map((one) => one.accountId).sort()).toEqual(['id-1', 'id-2'])
  })

  it('한 수단이 메이플 ID 를 여럿 주면 다 선다', () => {
    // 키 하나로도 여러 메이플 ID 가 한꺼번에 조회된다(실측).
    const merged = mergeMapleIds([
      { credential: 키가, accounts: [계정('id-1', 'o1'), 계정('id-2', 'o2')] },
    ])

    expect(merged).toHaveLength(2)
  })

  it('캐릭터도 함께 든다', () => {
    const merged = mergeMapleIds([{ credential: 키가, accounts: [계정('id-1', 'o1', 'o2')] }])

    expect(merged[0]?.characters.map((c) => c.ocid)).toEqual(['o1', 'o2'])
  })

  it('수단이 없으면 빈 목록이다', () => {
    expect(mergeMapleIds([])).toEqual([])
  })
})

describe('겹치면 로그인이 주인이다', () => {
  it('같은 메이플 ID 가 양쪽에서 와도 한 번만 선다', () => {
    const merged = mergeMapleIds([
      { credential: 키가, accounts: [계정('id-1', 'o1')] },
      { credential: 로그인, accounts: [계정('id-1', 'o1')] },
    ])

    expect(merged).toHaveLength(1)
  })

  it('주인이 로그인이다. 키가 먼저 와도 마찬가지다', () => {
    // 순서에 기대면 안 된다. 어느 쪽이 먼저 오든 로그인이 이긴다.
    const 키먼저 = mergeMapleIds([
      { credential: 키가, accounts: [계정('id-1', 'o1')] },
      { credential: 로그인, accounts: [계정('id-1', 'o1')] },
    ])
    const 로그인먼저 = mergeMapleIds([
      { credential: 로그인, accounts: [계정('id-1', 'o1')] },
      { credential: 키가, accounts: [계정('id-1', 'o1')] },
    ])

    expect(키먼저[0]?.credential).toEqual(로그인)
    expect(로그인먼저[0]?.credential).toEqual(로그인)
  })

  it('겹치지 않는 ID 는 각자의 수단을 지킨다', () => {
    const merged = mergeMapleIds([
      { credential: 로그인, accounts: [계정('id-1', 'o1')] },
      { credential: 키가, accounts: [계정('id-2', 'o2')] },
    ])

    const byId = new Map(merged.map((one) => [one.accountId, one.credential]))
    expect(byId.get('id-1')).toEqual(로그인)
    expect(byId.get('id-2')).toEqual(키가)
  })

  it('키끼리 겹치면 먼저 온 것이 남는다', () => {
    // 같은 계정의 키를 여럿 둘 이유가 없어 정상적으로는 안 생긴다. 생겼을 때 목록이 두 번
    // 서지만 않으면 된다.
    const merged = mergeMapleIds([
      { credential: 키가, accounts: [계정('id-1', 'o1')] },
      { credential: 키나, accounts: [계정('id-1', 'o1')] },
    ])

    expect(merged).toHaveLength(1)
    expect(merged[0]?.credential).toEqual(키가)
  })

  it('로그인이 이겨도 캐릭터는 로그인 쪽 응답을 쓴다', () => {
    // 주인이 바뀌면 그 응답으로 그린다. 두 응답을 섞으면 어느 쪽이 최신인지 모른다.
    const merged = mergeMapleIds([
      { credential: 키가, accounts: [계정('id-1', '옛o1')] },
      { credential: 로그인, accounts: [계정('id-1', '새o1', '새o2')] },
    ])

    expect(merged[0]?.characters.map((c) => c.ocid)).toEqual(['새o1', '새o2'])
  })
})

describe('어느 수단으로 부를지', () => {
  it('메이플 ID 로 수단을 찾는다', () => {
    const merged = mergeMapleIds([
      { credential: 로그인, accounts: [계정('id-1', 'o1')] },
      { credential: 키가, accounts: [계정('id-2', 'o2')] },
    ])

    // 캐릭터마다 다시 판정하지 않는다. 이 표가 정한다.
    expect(merged.find((one) => one.accountId === 'id-2')?.credential).toEqual(키가)
  })

  it('모르는 메이플 ID 는 없다', () => {
    const merged = mergeMapleIds([{ credential: 키가, accounts: [계정('id-1', 'o1')] }])

    expect(merged.find((one) => one.accountId === 'id-없음')).toBeUndefined()
  })
})
