import type { CharacterBasicProfile, MapleAccount, MapleCharacter } from '../../../types'
import { pickRepresentativeCharacter } from '../../../lib/character-order'
import {
  buildSelectedCharacterViews,
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
    ...overrides,
  }
}

describe('summarizeAccount: 월드 집계', () => {
  it('월드가 셋이면 많은 순으로 둘만 남긴다', () => {
    const summary = summarizeAccount(
      account([
        character({ name: '가', level: 200, world: '엘리시움' }),
        character({ name: '나', level: 200, world: '스카니아' }),
        character({ name: '다', level: 200, world: '스카니아' }),
        character({ name: '라', level: 200, world: '스카니아' }),
        character({ name: '마', level: 200, world: '엘리시움' }),
        character({ name: '바', level: 200, world: '루나' }),
      ]),
    )

    expect(summary?.worldCounts).toEqual([
      { world: '스카니아', count: 3 },
      { world: '엘리시움', count: 2 },
    ])
  })

  it('개수가 같으면 이름순으로 결정된다 (입력 순서와 무관)', () => {
    const forward = summarizeAccount(
      account([
        character({ name: '가', level: 200, world: '엘리시움' }),
        character({ name: '나', level: 200, world: '스카니아' }),
      ]),
    )
    const reversed = summarizeAccount(
      account([
        character({ name: '나', level: 200, world: '스카니아' }),
        character({ name: '가', level: 200, world: '엘리시움' }),
      ]),
    )

    expect(forward?.worldCounts).toEqual([
      { world: '스카니아', count: 1 },
      { world: '엘리시움', count: 1 },
    ])
    expect(reversed?.worldCounts).toEqual(forward?.worldCounts)
  })

  it('월드가 하나면 하나만 돌려준다', () => {
    const summary = summarizeAccount(
      account([
        character({ name: '가', level: 200, world: '베라' }),
        character({ name: '나', level: 200, world: '베라' }),
      ]),
    )

    expect(summary?.worldCounts).toEqual([{ world: '베라', count: 2 }])
  })

  it('셋째 월드를 **외 n** 같은 꼬리로 적지 않는다. 목록이 정확히 둘이다', () => {
    const summary = summarizeAccount(
      account([
        character({ name: '가', level: 200, world: '스카니아' }),
        character({ name: '나', level: 200, world: '엘리시움' }),
        character({ name: '다', level: 200, world: '루나' }),
        character({ name: '라', level: 200, world: '오로라' }),
      ]),
    )

    expect(summary?.worldCounts).toHaveLength(2)
    expect(summary?.characterCount).toBe(4)
  })
})

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

  it('accountId 를 그대로 싣는다', () => {
    const summary = summarizeAccount(account([character({ name: '가', level: 1 })], 'account-42'))

    expect(summary?.accountId).toBe('account-42')
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

  it('캐시가 있으면 이름·레벨·직업·월드·얼굴을 싣는다', () => {
    const views = buildSelectedCharacterViews(
      ['ocid-1'],
      new Map([['ocid-1', cached({ jobClass: '나이트로드' })]]),
      new Set(),
    )

    expect(views[0]).toEqual({
      ocid: 'ocid-1',
      name: '낟낟',
      level: 294,
      jobClass: '나이트로드',
      world: '스카니아',
      imageUrl: 'https://example.com/face.png',
      unavailable: false,
    })
  })

  it('캐시가 없으면 모르는 값을 지어내지 않는다 (level null · jobClass 없음 · 얼굴 null)', () => {
    const views = buildSelectedCharacterViews(['ocid-unknown'], new Map(), new Set())

    expect(views[0].level).toBeNull()
    expect(views[0].imageUrl).toBeNull()
    expect(views[0].jobClass).toBeUndefined()
    expect(views[0].world).toBeUndefined()
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

  it('빈 목록이면 빈 배열이다', () => {
    expect(buildSelectedCharacterViews([], new Map(), new Set())).toEqual([])
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

  it('목록이 비어 있으면 null 이다', () => {
    expect(resolveRepresentative([], 'a')).toBeNull()
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

  it('목록이 비어 있으면 null 이다', () => {
    expect(resolveDisplayRepresentative([], 'a')).toBeNull()
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
