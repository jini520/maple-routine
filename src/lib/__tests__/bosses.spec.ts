import * as bosses from '../boss/bosses'
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
import { WEEKLY_BOSS_CLEAR_LIMIT, WEEKLY_CRYSTAL_SALE_LIMIT } from '../boss/boss-matching'
import { BUNDLED_BOSS_CATALOG, setBossCatalog } from '../boss/catalog'
import type { BossCatalog } from '../../types/boss-catalog'

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

// 표는 켜는 동안 기기 사본과 서버 응답으로 덮인다. 조회 함수와 상수 전부가 덮인 표를 봐야 한다.
describe('bosses: 표가 덮이면', () => {
  const 덮은표: BossCatalog = {
    updatedAt: '2026-10-15T01:00:00.000Z',
    rules: { weeklyBossSelectionLimit: 10, weeklyCrystalSaleLimit: 80 },
    bosses: [
      {
        key: 'black_mage',
        name: '검은 마법사',
        alias: '검은 마법사',
        cycle: 'monthly',
        portraitSlug: 'blackMage',
        difficulties: [{ difficulty: 'hard', requiredLevel: 255 }],
      },
      {
        key: 'meirin',
        name: '시즌 보스 메이린',
        alias: '메이린',
        cycle: 'event_weekly',
        portraitSlug: 'maerin',
        difficulties: [
          { difficulty: 'normal', requiredLevel: 270 },
          { difficulty: 'hard', requiredLevel: 280 },
        ],
      },
      {
        key: 'new_boss',
        name: '새 보스',
        alias: '새 보스',
        cycle: 'weekly',
        portraitSlug: 'newBoss',
        difficulties: [{ difficulty: 'extreme', requiredLevel: 300 }],
      },
    ],
  }

  afterEach(() => {
    setBossCatalog(BUNDLED_BOSS_CATALOG)
  })

  it('조회 함수가 새 표를 읽는다. 묶음은 cycle 에서, 요구 레벨은 난이도 줄에서 만든다', () => {
    setBossCatalog(덮은표)

    expect(findBoss('zakum')).toBeNull()
    expect(findBoss('new_boss')).toMatchObject({
      name: '새 보스',
      section: 'weekly',
      cycle: 'weekly',
      isSeasonBoss: false,
      difficulties: ['extreme'],
      requiredLevels: { extreme: 300 },
      portraitSlug: 'newBoss',
    })
    expect(findBoss('meirin')).toMatchObject({ section: 'eventWeekly', cycle: 'weekly', isSeasonBoss: true })
    expect(findBoss('black_mage')).toMatchObject({ section: 'monthly', cycle: 'monthly', isSeasonBoss: false })
    expect(bossRequiredLevel('meirin', 'hard')).toBe(280)
    expect(bossKeyOfApiName('새보스')).toBe('new_boss')
    expect(bossKeyOfApiName('자쿰')).toBeNull()
    expect(bossesInSection('weekly').map((entry) => entry.key)).toEqual(['new_boss'])
  })

  it('표의 차례는 새 표의 배열 차례다', () => {
    setBossCatalog(덮은표)

    expect(bosses.BOSS_ENTRIES.map((entry) => entry.key)).toEqual(['black_mage', 'meirin', 'new_boss'])
    expect(bossReferenceOrder('black_mage')).toBe(0)
    expect(bossReferenceOrder('new_boss')).toBe(2)
  })

  // 상수로 import 한 자리가 아홉이다. 바인딩이 살아 있어야 그 자리들이 새 한도를 본다.
  it('한도 둘도 새 표를 본다. boss-matching 을 거친 재수출도 같다', () => {
    setBossCatalog(덮은표)

    expect(bosses.WEEKLY_BOSS_CLEAR_LIMIT).toBe(10)
    expect(bosses.WEEKLY_CRYSTAL_SALE_LIMIT).toBe(80)
    expect(WEEKLY_BOSS_CLEAR_LIMIT).toBe(10)
    expect(WEEKLY_CRYSTAL_SALE_LIMIT).toBe(80)
  })

  it('번들로 되돌리면 전부 원래대로다', () => {
    setBossCatalog(덮은표)
    setBossCatalog(BUNDLED_BOSS_CATALOG)

    expect(BOSS_ENTRIES).toHaveLength(26)
    expect(findBoss('zakum')).not.toBeNull()
    expect(bosses.WEEKLY_BOSS_CLEAR_LIMIT).toBe(12)
  })
})
