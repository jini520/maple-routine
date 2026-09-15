import {
  BOSS_ENTRIES,
  bossCycleOf,
  bossKeyOfApiName,
  bossNameOf,
  bossPortraitSlugOf,
  bossReferenceOrder,
  bossRequiredLevel,
  bossesInSection,
  findBoss,
  isSeasonBoss,
  supportedDifficultiesOf,
} from '../boss/bosses'

// 보스 마스터 표 조회. 기록은 보스 key 를 들고 이름 · 주기 · 요구 레벨 · 초상은 여기서 찾는다.
describe('bosses', () => {
  it('표 차례가 weekly → eventWeekly → monthly 이고 보스는 26 이다', () => {
    expect(BOSS_ENTRIES).toHaveLength(26)
    expect(BOSS_ENTRIES[0].key).toBe('zakum')
    expect(BOSS_ENTRIES.at(-2)?.key).toBe('meirin')
    expect(BOSS_ENTRIES.at(-1)?.key).toBe('black_mage')
    expect(bossesInSection('monthly').map((entry) => entry.key)).toEqual(['black_mage'])
    expect(bossesInSection('eventWeekly').map((entry) => entry.key)).toEqual(['meirin'])
  })

  // 공백 방향이 보스마다 달라 양쪽 공백을 모두 지우고 비교한다. 파일시스템에서 온 NFD 글자도 같은 이름이다.
  it('API 이름에서 key 를 찾는다. NFC 뒤 공백을 지우고 완전 일치다', () => {
    expect(bossKeyOfApiName('검은 마법사')).toBe('black_mage')
    expect(bossKeyOfApiName('검은마법사')).toBe('black_mage')
    expect(bossKeyOfApiName('블러디퀸')).toBe('crimson_queen')
    expect(bossKeyOfApiName('블러디 퀸')).toBe('crimson_queen')
    expect(bossKeyOfApiName('시즌 보스 메이린')).toBe('meirin')
    expect(bossKeyOfApiName('루시드'.normalize('NFD'))).toBe('lucid')
    expect(bossKeyOfApiName('카이')).toBeNull()
    // 앞부분만 같은 이름은 다른 보스다.
    expect(bossKeyOfApiName('메이린')).toBeNull()
  })

  it('보이는 이름은 API 표기이고, 모르는 key 면 넘긴 이름이다', () => {
    expect(bossNameOf('black_mage', '옛 이름')).toBe('검은 마법사')
    expect(bossNameOf('nope', '카이')).toBe('카이')
    expect(bossNameOf(null, '카이')).toBe('카이')
  })

  it('주기 · 시즌 보스 여부 · 지원 난이도 · 요구 레벨 · 초상을 key 로 찾는다', () => {
    expect(bossCycleOf('lucid')).toBe('weekly')
    expect(bossCycleOf('meirin')).toBe('weekly')
    expect(bossCycleOf('black_mage')).toBe('monthly')
    expect(bossCycleOf('nope')).toBeNull()
    expect(isSeasonBoss('meirin')).toBe(true)
    expect(isSeasonBoss('lucid')).toBe(false)
    expect(supportedDifficultiesOf('lotus')).toEqual(['normal', 'hard', 'extreme'])
    expect(supportedDifficultiesOf('nope')).toEqual([])
    expect(bossRequiredLevel('zakum', 'chaos')).toBe(90)
    expect(bossRequiredLevel('zakum', 'hard')).toBeNull()
    expect(bossPortraitSlugOf('black_mage')).toBe('blackMage')
    expect(findBoss(undefined)).toBeNull()
  })

  // 표에 없는 보스는 맨 뒤다. 그들끼리의 순서는 compareBossOrder 가 난이도 · 글자로 가른다.
  it('표 차례를 돌려주고 모르는 key 는 맨 뒤다', () => {
    expect(bossReferenceOrder('zakum')).toBe(0)
    expect(bossReferenceOrder('black_mage')).toBe(25)
    expect(bossReferenceOrder('nope')).toBe(Number.MAX_SAFE_INTEGER)
    expect(bossReferenceOrder(null)).toBe(Number.MAX_SAFE_INTEGER)
  })
})
