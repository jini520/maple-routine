import {
  getMaxCountOverride,
  getShareScope,
  getSharedContentGroups,
  isCumulativeScore,
  trustsRegistrationFlag,
} from '../scheduler/scheduler-content-scope'

// 이 모듈은 컨텐츠 key 만 받는다. API 이름의 공백 차이는 key 를 얻는 자리(`contentKeyOfApiName`)가 흡수한다.
describe('getShareScope', () => {
  it('카탈로그에 없는 항목은 character(기본값)를 반환한다', () => {
    expect(getShareScope('guild_weekly_mission_points')).toBe('character')
    expect(getShareScope('mu_lung_dojo')).toBe('character')
    expect(getShareScope('unknown_content')).toBe('character')
  })

  // 컨텐츠 표에 없는 항목(응답에만 있는 새 컨텐츠)은 key 가 없다. 공유라고 확인된 적 없어 캐릭터 범위다.
  it('컨텐츠 key 가 없는 항목(null)은 character 다', () => {
    expect(getShareScope(null)).toBe('character')
  })

  // 같은 갈래라도 공유 단위가 다르다. 줄마다 key 가 달라 따로 적는다.
  describe('같은 갈래의 다른 컨텐츠', () => {
    // 같은 계열이라도 공유 단위가 다르다(사용자 확인). 이름으로 유추하면 틀린다.
    it('PC방 주간 드래곤 퇴치는 account다. PC방이 아닌 쪽(world)과 공유 단위가 다르다', () => {
      expect(getShareScope('maple_union_weekly_dragon')).toBe('world')
      expect(getShareScope('maple_union_pc_cafe_weekly_dragon')).toBe('account')
    })
  })
})

// 공유 여부와는 다른 축. 개인 기록이지만 리셋 없이 누적되는 항목.
describe('isCumulativeScore', () => {
  it('카탈로그에 등록된 누적 점수 항목은 true다', () => {
    expect(isCumulativeScore('guild_underground_waterway')).toBe(true)
  })

  it('주기마다 리셋되는 항목과 key 가 없는 항목은 false다. 같은 길드 컨텐츠여도 축이 다르다', () => {
    expect(isCumulativeScore('guild_weekly_mission_points')).toBe(false)
    expect(isCumulativeScore('guild_flag_race')).toBe(false)
    expect(isCumulativeScore('monster_park')).toBe(false)
    expect(isCumulativeScore(null)).toBe(false)
  })

  it('누적 점수 항목도 공유가 아니라 캐릭터 범위다. 두 축은 독립이다', () => {
    expect(getShareScope('guild_underground_waterway')).toBe('character')
  })
})

describe('getMaxCountOverride', () => {
  it('오버라이드가 등록된 항목은 그 값을 반환한다', () => {
    expect(getMaxCountOverride('guild_weekly_mission_points')).toBe(10)
  })

  it('오버라이드가 없는 항목과 key 가 없는 항목은 null을 반환한다', () => {
    expect(getMaxCountOverride('monster_park')).toBeNull()
    expect(getMaxCountOverride(null)).toBeNull()
  })
})

describe('getSharedContentGroups', () => {
  it('갈래는 카탈로그가 적어 둔 순서다. 배열을 읽은 첫 등장 순서가 아니다', () => {
    // 지금은 두 순서가 같다. 그래도 배열에 맡기지 않는 것은, 배열이 순서가 아니라 공유 단위로
    // 갈려 있어 계정 공유 컨텐츠 하나가 붙는 날 화면 순서가 조용히 바뀌기 때문이다.
    expect(getSharedContentGroups().map((group) => group.category)).toEqual([
      'monster_park',
      'maple_union',
      'epic_dungeon',
    ])
  })

  it('갈래 안의 항목 순서는 worldShared → accountShared 를 이어 읽은 순서다', () => {
    const byCategory = new Map(getSharedContentGroups().map((group) => [group.category, group]))

    expect(byCategory.get('epic_dungeon')?.entries.map((entry) => entry.shortName)).toEqual([
      '하이마운틴',
      '앵글러컴퍼니',
      '악몽선경',
      '아우룸레기스',
    ])
    // 월드 것(몬스터파크)이 계정 것보다 앞이고, 사이에 낀 유니온 항목은 이 갈래에 안 든다.
    expect(byCategory.get('monster_park')?.entries.map((entry) => entry.shortName)).toEqual([
      '일간',
      '익스트림 몬스터파커',
    ])
    // 월드 하나 + 계정 하나가 한 갈래로 묶이는 유일한 경우다.
    expect(byCategory.get('maple_union')?.entries.map((entry) => entry.shortName)).toEqual([
      '주간 드래곤 퇴치',
      'PC방 주간 드래곤 퇴치',
    ])
  })

  it('컨텐츠 key · 갈래 · section · scope 를 함께 나른다. 호출부가 응답에서 항목을 key 로 다시 찾는다', () => {
    const epic = getSharedContentGroups().find((group) => group.category === 'epic_dungeon')

    expect(epic?.entries[0]).toEqual({
      contentKey: 'epic_dungeon_high_mountain',
      shortName: '하이마운틴',
      category: 'epic_dungeon',
      section: 'weekly',
      scope: 'account',
      onlyWhenScheduled: false,
      from: undefined,
      until: undefined,
    })
  })

  // 기간은 템플릿 줄 한 곳에만 적는다. 카탈로그에 같은 값을 두면 두 곳이 어긋날 수 있다.
  it('기간(from)은 템플릿 줄에서 읽는다. 아우룸 레기스만 2026-09-17 부터다', () => {
    const periods = getSharedContentGroups()
      .flatMap((group) => group.entries)
      .filter((entry) => entry.from !== undefined)
      .map((entry) => [entry.contentKey, entry.from])

    expect(periods).toEqual([['epic_dungeon_aurum_regis', '2026-09-17']])
  })

  it('여덟을 하나도 빠뜨리거나 더하지 않는다', () => {
    const keys = getSharedContentGroups().flatMap((group) => group.entries.map((entry) => entry.contentKey))

    expect(keys).toHaveLength(8)
    expect(new Set(keys).size).toBe(8)
    // 카탈로그가 **공유** 라고 적은 것과 정확히 같은 집합이어야 한다. 여기서 갈리면 `남은 스케줄`이
    // 빼는 것과 이 위젯이 그리는 것이 어긋나 항목이 통째로 사라지거나 두 곳에 겹쳐 나온다.
    for (const key of keys) {
      expect(getShareScope(key)).not.toBe('character')
    }
  })
})

describe('getMaxCountOverride: 익스트림 몬스터파커', () => {
  // 이 분모는 한 번 뒤집혔다. 2026-08-18 에 템플릿의 5 를 2 로 덮었다가 2026-09-05 에 되돌렸다.
  // 완료 조건이 일간 몬스터파크 5회라 API 의 5 가 맞고, 주 2회는 수행 제한이라 다른 축이다.
  // 그 축은 `contentCountTag` 의 참고 태그(`월드 당 2회`)가 말한다.
  it('오버라이드가 없다. API 와 템플릿의 5 가 그대로 흐른다', () => {
    expect(getMaxCountOverride('monster_park_extreme')).toBeNull()
  })
})

// 어느 항목이 응답의 등록 값을 믿는지는 카탈로그의 칸이 말한다. 이름으로 추론하지 않는다.
describe('trustsRegistrationFlag', () => {
  it('나머지 공유 항목 · 캐릭터 항목 · key 가 없는 항목은 거짓이다', () => {
    expect(trustsRegistrationFlag('monster_park')).toBe(false)
    expect(trustsRegistrationFlag('monster_park_extreme')).toBe(false)
    expect(trustsRegistrationFlag('epic_dungeon_high_mountain')).toBe(false)
    expect(trustsRegistrationFlag('mu_lung_dojo')).toBe(false)
    expect(trustsRegistrationFlag(null)).toBe(false)
  })
})
