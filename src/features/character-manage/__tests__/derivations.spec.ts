import type { CharacterBasicProfile, MapleAccount, MapleCharacter } from '../../../types'
import { pickRepresentativeCharacter } from '../../../lib/character-order'
import type { NexonCredential } from '../../../types/auth'
import {
  buildSelectedCharacterViews,
  groupAccountSummaries,
  resolveDisplayRepresentative,
  resolveRepresentative,
  sortAccountSummaries,
  summarizeAccount,
} from '../derivations'

function character(
  overrides: Partial<MapleCharacter> & { name: string; level: number },
): MapleCharacter {
  return {
    ocid: `ocid-${overrides.name}`,
    world: '스카니아',
    worldKey: 'scania',
    jobClass: '아크메이지(썬,콜)',
    ...overrides,
  }
}

function account(characters: MapleCharacter[], accountId = 'account-1'): MapleAccount {
  return { accountId, characters }
}

function cached(overrides: Partial<CharacterBasicProfile> = {}): CharacterBasicProfile {
  return {
    name: '낟낟',
    level: 294,
    imageUrl: 'https://example.com/face.png',
    accessFlag: true,
    world: '스카니아',
    worldKey: 'scania',
    ...overrides,
  }
}

describe('summarizeAccount: 대표', () => {
  it('레벨이 가장 높은 캐릭터가 대표다', () => {
    const characters = [
      character({ name: '낮음', level: 100 }),
      character({ name: '높음', level: 294 }),
      character({ name: '중간', level: 200 }),
    ]

    expect(summarizeAccount(account(characters))?.representative.name).toBe('높음')
  })

  it('동레벨이면 이름순이고, pickRepresentativeCharacter 와 결과가 같다', () => {
    const characters = [
      character({ name: '다람쥐', level: 200 }),
      character({ name: '가람이', level: 200 }),
      character({ name: 'Alpha', level: 200 }),
    ]

    expect(summarizeAccount(account(characters))?.representative).toEqual(
      pickRepresentativeCharacter(characters),
    )
  })

  it('캐릭터가 0명이면 던지지 않고 null 을 돌려준다 (호출부가 거른다)', () => {
    expect(summarizeAccount(account([]))).toBeNull()
  })
})

describe('buildSelectedCharacterViews', () => {
  it('저장 순서를 그대로 지킨다. 레벨로 다시 정렬하지 않는다', () => {
    const views = buildSelectedCharacterViews(
      ['ocid-low', 'ocid-high', 'ocid-mid'],
      new Map([
        ['ocid-low', cached({ name: '낮음', level: 100 })],
        ['ocid-high', cached({ name: '높음', level: 294 })],
        ['ocid-mid', cached({ name: '중간', level: 200 })],
      ]),
      new Set(),
    )

    expect(views.map((view) => view.ocid)).toEqual(['ocid-low', 'ocid-high', 'ocid-mid'])
  })

  it('캐시가 없으면 모르는 값을 지어내지 않는다 (level null · jobClass 없음 · 얼굴 null)', () => {
    const views = buildSelectedCharacterViews(['ocid-unknown'], new Map(), new Set())

    expect(views[0].level).toBeNull()
    expect(views[0].imageUrl).toBeNull()
    expect(views[0].jobClass).toBeUndefined()
    expect(views[0].worldKey).toBeUndefined()
    expect(views[0].ocid).toBe('ocid-unknown')
    // 이름은 타입이 `string` 이라 **없음** 을 담을 자리가 빈 문자열뿐이다. 화면이 채울
    // 자리표시자(**알 수 없음** 등)를 여기서 만들지 않는다.
    expect(views[0].name).toBe('')
  })

  it('캐시 엔트리가 null 로 들어와도 **없음** 과 똑같이 다룬다', () => {
    const views = buildSelectedCharacterViews(
      ['ocid-1'],
      new Map([['ocid-1', null]]),
      new Set(),
    )

    expect(views[0].level).toBeNull()
    expect(views[0].imageUrl).toBeNull()
  })

  it('옛 캐시라 직업이 없으면 그 자리만 비운다', () => {
    const views = buildSelectedCharacterViews(
      ['ocid-1'],
      new Map([['ocid-1', cached({ jobClass: undefined })]]),
      new Set(),
    )

    expect(views[0].level).toBe(294)
    expect(views[0].jobClass).toBeUndefined()
  })

  it('조회 불가 캐릭터도 목록에 남는다. 해제할 자리가 여기뿐이다', () => {
    const views = buildSelectedCharacterViews(
      ['ocid-1', 'ocid-2'],
      new Map([['ocid-1', cached({ name: '멀쩡이' })]]),
      new Set(['ocid-2']),
    )

    expect(views.map((view) => view.ocid)).toEqual(['ocid-1', 'ocid-2'])
    expect(views[0].unavailable).toBe(false)
    expect(views[1].unavailable).toBe(true)
  })

  it('조회 불가여도 캐시에 있던 값은 그대로 쓴다', () => {
    const views = buildSelectedCharacterViews(
      ['ocid-1'],
      new Map([['ocid-1', cached({ name: '옛이름', level: 250 })]]),
      new Set(['ocid-1']),
    )

    expect(views[0]).toMatchObject({ name: '옛이름', level: 250, unavailable: true })
  })
})

describe('resolveRepresentative', () => {
  it('저장된 대표가 목록에 있으면 그것이다', () => {
    expect(resolveRepresentative(['a', 'b', 'c'], 'b')).toBe('b')
  })

  it('저장된 대표가 목록에 없으면 null 이다', () => {
    expect(resolveRepresentative(['a', 'b'], 'zzz')).toBeNull()
  })

  it('저장값이 없으면 null 이다. 첫 번째를 임시 대표로 만들지 않는다', () => {
    expect(resolveRepresentative(['a', 'b'], null)).toBeNull()
  })
})

// today 의 `대표 캐릭터` 위젯이의 **미지정이면 첫 번째** 를 읽는
// 첫 화면이다. resolveRepresentative 와 **다른 질문**이라 옆에 하나 더 두었고, 아래 회귀 가드가
// 그 둘이 합쳐지는 것을 막는다(합치면의 **채워진 별이 하나도 없다** 가 깨진다).
describe('resolveDisplayRepresentative', () => {
  it('저장된 대표가 목록에 있으면 그것이다', () => {
    expect(resolveDisplayRepresentative(['a', 'b', 'c'], 'b')).toBe('b')
  })

  it('저장된 대표가 목록에 없으면 첫 번째다', () => {
    expect(resolveDisplayRepresentative(['a', 'b'], 'zzz')).toBe('a')
  })

  it('저장값이 없으면 첫 번째가 임시 대표다', () => {
    expect(resolveDisplayRepresentative(['a', 'b'], null)).toBe('a')
  })

  it('회귀 가드. 같은 입력에 resolveRepresentative 는 여전히 null 이다', () => {
    expect(resolveRepresentative(['a', 'b'], null)).toBeNull()
    expect(resolveRepresentative(['a', 'b'], 'zzz')).toBeNull()
  })
})

// **더 높은 레벨이 존재하는 ID 가 먼저**. 계정 자체에는 **주력** 을 말하는 값이
// 없고(accountId 는 불투명 문자열·응답 순서는 넥슨이 정한다), 사람이 실제로 쓰는 기준이 최고 레벨이다.
describe('sortAccountSummaries', () => {
  function summary(accountId: string, level: number, name = `대표-${accountId}`) {
    const view = summarizeAccount(account([character({ name, level })], accountId))
    if (view === null) throw new Error('테스트 전제가 깨졌다')
    return view
  }

  it('대표 레벨이 높은 계정이 먼저다', () => {
    const sorted = sortAccountSummaries([summary('a', 180), summary('b', 294), summary('c', 221)])

    expect(sorted.map((view) => view.accountId)).toEqual(['b', 'c', 'a'])
  })

  it('동레벨이면 대표 이름순이다. 응답 순서를 따르면 열 때마다 달라 보인다', () => {
    const sorted = sortAccountSummaries([summary('a', 200, '나중'), summary('b', 200, '가장')])

    expect(sorted.map((view) => view.accountId)).toEqual(['b', 'a'])
  })

  it('입력 배열을 바꾸지 않는다', () => {
    const input = [summary('a', 100), summary('b', 200)]

    sortAccountSummaries(input)

    expect(input.map((view) => view.accountId)).toEqual(['a', 'b'])
  })
})

describe('groupAccountSummaries: 캐릭터 관리 드롭다운의 넥슨 계정 묶음', () => {
  const login: NexonCredential = { type: 'login', value: 'S', accountId: 'nexon-login' }
  const key1: NexonCredential = { type: 'key', value: 'k1', accountId: 'nexon-key-1' }
  const key2: NexonCredential = { type: 'key', value: 'k2', accountId: 'nexon-key-2' }
  const of = (accountId: string, level: number): MapleAccount =>
    account([character({ name: `${accountId}-대표`, level })], accountId)

  // 부계정 키의 대표가 더 높아도 넥슨 ID 계정의 묶음이 먼저다. 계정 관리 목록과 같은 차례다.
  it('넥슨 계정 차례로 묶고, 묶음 안에서는 대표 레벨이 높은 메이플 ID 가 먼저다', () => {
    const grouped = groupAccountSummaries([
      { credential: login, accounts: [of('maple-low', 250), of('maple-high', 270)] },
      { credential: key1, accounts: [of('maple-sub', 290)] },
    ])

    expect(grouped.accounts.map((one) => one.accountId)).toEqual(['maple-high', 'maple-low', 'maple-sub'])
  })

  // 번호는 계정 관리 목록의 `API 키 N 계정` 과 같아야 한다. 못 받은 키를 건너뛰면 번호가 화면마다 갈린다.
  it('넥슨 계정이 둘 이상 보이면 라벨을 붙이고, API 키 번호는 목록을 못 받은 키가 있어도 등록한 차례다', () => {
    const grouped = groupAccountSummaries([
      { credential: login, accounts: [of('maple-login', 270)] },
      { credential: key1, accounts: null },
      { credential: key2, accounts: [of('maple-sub', 260)] },
    ])

    expect(grouped.groupOf).toEqual({ 'maple-login': '넥슨 ID 계정', 'maple-sub': 'API 키 2 계정' })
  })

  it('보이는 넥슨 계정이 하나면 라벨을 붙이지 않는다', () => {
    const grouped = groupAccountSummaries([
      { credential: login, accounts: [of('maple-login', 270)] },
      { credential: key1, accounts: null },
    ])

    expect(grouped.groupOf).toEqual({})
  })
})
