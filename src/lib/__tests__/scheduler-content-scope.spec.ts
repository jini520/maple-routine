import {
  contentMaxCountOf,
  getShareScope,
  getSharedContentGroups,
  isScoreContent,
  trustsRegistrationFlag,
} from '../scheduler/scheduler-content-scope'

// 이 모듈은 컨텐츠 key 만 받는다. API 이름의 공백 차이는 key 를 얻는 자리(`contentKeyOfApiName`)가 흡수한다.
describe('getShareScope', () => {
  it('공유 범위가 캐릭터인 항목과 표에 없는 항목은 character 다', () => {
    expect(getShareScope('guild_weekly_mission_points')).toBe('character')
    expect(getShareScope('mu_lung_dojo')).toBe('character')
    expect(getShareScope('unknown_content')).toBe('character')
  })

  // 컨텐츠 표에 없는 항목(응답에만 있는 새 컨텐츠)은 key 가 없다. 공유라고 확인된 적 없어 캐릭터 범위다.
  it('컨텐츠 key 가 없는 항목(null)은 character 다', () => {
    expect(getShareScope(null)).toBe('character')
  })

  // 같은 계열이라도 공유 단위가 다르다(사용자 확인). 이름으로 유추하면 틀린다.
  it('PC방 주간 드래곤 퇴치는 account다. PC방이 아닌 쪽(world)과 공유 단위가 다르다', () => {
    expect(getShareScope('maple_union_weekly_dragon')).toBe('world')
    expect(getShareScope('maple_union_pc_cafe_weekly_dragon')).toBe('account')
  })
})

// 최근 활동 판정이 점수 컨텐츠를 빼는 근거다. 점수가 리셋 뒤에도 줄지 않는 컨텐츠가 있다.
describe('isScoreContent', () => {
  it('점수로 완료를 가르는 셋은 참이고, 횟수 · 퀘스트 상태로 가르는 항목과 key 가 없는 항목은 거짓이다', () => {
    expect(['guild_underground_waterway', 'guild_flag_race', 'mu_lung_dojo'].map(isScoreContent)).toEqual([true, true, true])
    expect(isScoreContent('guild_weekly_mission_points')).toBe(false)
    expect(isScoreContent('monster_park')).toBe(false)
    expect(isScoreContent(null)).toBe(false)
  })
})

// 넥슨은 길드 주간 미션 포인트의 최대 횟수를 가끔 0 으로 준다. 표의 값이 있으면 그것을 쓴다.
describe('contentMaxCountOf', () => {
  it('횟수로 완료를 세는 항목은 표의 최대 횟수이고, 그 밖의 항목과 key 가 없는 항목은 null 이다', () => {
    expect(contentMaxCountOf('guild_weekly_mission_points')).toBe(10)
    expect(contentMaxCountOf('epic_dungeon_aurum_regis')).toBe(5)
    // 익스트림 몬스터파커는 퀘스트 상태로 완료를 가리고, 진행 중의 최대 횟수는 넥슨이 준다.
    expect(contentMaxCountOf('monster_park_extreme')).toBeNull()
    expect(contentMaxCountOf(null)).toBeNull()
  })
})

describe('getSharedContentGroups', () => {
  it('분류는 분류 줄이 적어 둔 순서다. 배열을 읽은 첫 등장 순서가 아니다', () => {
    expect(getSharedContentGroups().map((group) => group.category)).toEqual(['monster_park', 'epic_dungeon'])
  })

  // 위젯은 횟수를 확인하는 공유 컨텐츠만 그린다. 퀘스트 상태만 확인하는 드래곤 퇴치 둘은 등록돼 있어도 그리지 않는다.
  it('퀘스트 상태만 확인하는 메이플 유니온 드래곤 퇴치 둘은 들지 않는다', () => {
    const keys = getSharedContentGroups().flatMap((group) => group.entries.map((entry) => entry.contentKey))
    expect(keys).not.toContain('maple_union_weekly_dragon')
    expect(keys).not.toContain('maple_union_pc_cafe_weekly_dragon')
  })

  it('분류 안의 항목 순서는 컨텐츠 표의 차례다', () => {
    const byCategory = new Map(getSharedContentGroups().map((group) => [group.category, group]))

    expect(byCategory.get('epic_dungeon')?.entries.map((entry) => entry.shortName)).toEqual([
      '하이마운틴',
      '앵글러컴퍼니',
      '악몽선경',
      '아우룸레기스',
    ])
    expect(byCategory.get('monster_park')?.entries.map((entry) => entry.shortName)).toEqual([
      '일일',
      '익스트림 몬스터파커',
    ])
  })

  it('컨텐츠 key · 분류 · 주기 · scope 를 함께 나른다. 호출부가 응답에서 항목을 key 로 다시 찾는다', () => {
    const epic = getSharedContentGroups().find((group) => group.category === 'epic_dungeon')

    expect(epic?.entries[0]).toEqual({
      contentKey: 'epic_dungeon_high_mountain',
      shortName: '하이마운틴',
      category: 'epic_dungeon',
      section: 'weekly',
      scope: 'account',
    })
  })

  // 기간은 컨텐츠 줄 한 곳에만 적는다.
  it('기간(from)은 컨텐츠 줄에서 읽는다. 아우룸 레기스만 2026-09-17 부터다', () => {
    const periods = getSharedContentGroups()
      .flatMap((group) => group.entries)
      .filter((entry) => entry.from !== undefined)
      .map((entry) => [entry.contentKey, entry.from])

    expect(periods).toEqual([['epic_dungeon_aurum_regis', '2026-09-17']])
  })

  it('여섯을 하나도 빠뜨리거나 더하지 않고, 모두 공유 컨텐츠다', () => {
    const keys = getSharedContentGroups().flatMap((group) => group.entries.map((entry) => entry.contentKey))

    expect(keys).toHaveLength(6)
    expect(new Set(keys).size).toBe(6)
    for (const key of keys) {
      expect(getShareScope(key)).not.toBe('character')
    }
  })
})

// 등록을 이번 응답의 값으로 정하는 항목은 칸 없이 공유 범위와 완료 방법으로 가른다.
describe('trustsRegistrationFlag', () => {
  it('공유 범위가 캐릭터가 아니고 퀘스트 상태만 확인하는 드래곤 퇴치 둘만 참이다', () => {
    expect(trustsRegistrationFlag('maple_union_weekly_dragon')).toBe(true)
    expect(trustsRegistrationFlag('maple_union_pc_cafe_weekly_dragon')).toBe(true)
  })

  it('나머지 공유 항목 · 캐릭터 항목 · key 가 없는 항목은 거짓이다', () => {
    expect(trustsRegistrationFlag('monster_park')).toBe(false)
    expect(trustsRegistrationFlag('monster_park_extreme')).toBe(false)
    expect(trustsRegistrationFlag('epic_dungeon_high_mountain')).toBe(false)
    expect(trustsRegistrationFlag('mu_lung_dojo')).toBe(false)
    expect(trustsRegistrationFlag(null)).toBe(false)
  })
})
