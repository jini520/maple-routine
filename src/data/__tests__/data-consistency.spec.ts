import weeklyBosses from '../weekly-bosses.json'
import bossCrystalPrices from '../boss-crystal-prices.json'
import itemDropTable from '../item-drop-table.json'
import contentTemplate from '../scheduler-content-template.json'
import { DROP_CATEGORIES } from '../../types/drops'

function key(boss: string, difficulty: string): string {
  return `${boss}::${difficulty}`
}

function weeklyBossKeys(): Set<string> {
  const keys = new Set<string>()
  for (const section of ['weekly', 'eventWeekly', 'monthly'] as const) {
    for (const entry of weeklyBosses[section]) {
      for (const difficulty of entry.difficulties) {
        keys.add(key(entry.boss, difficulty))
      }
    }
  }
  return keys
}

function findDuplicates(keys: string[]): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const k of keys) {
    if (seen.has(k)) dupes.add(k)
    seen.add(k)
  }
  return [...dupes]
}

// item-drop-table.json 상단 note에 데이터 없음/의도적 제외로 이미 문서화된 조합.
// weekly-bosses.json에 새 보스/난이도가 추가되면서 드랍 데이터가 누락된 경우와
// 구분하기 위한 허용 목록. 여기 없는 조합이 빠지면 테스트가 실패해야 한다.
// 남은 여섯은 전부 "상세 보상 정보 자체가 제공되지 않은" 구보스다. 벨로나 세 조합은
// 출시분 반영으로 빠졌다. 이제 이 목록에 "미출시" 사유는 없다.
const KNOWN_MISSING_DROP_ENTRIES = new Set([
  key('자쿰', '카오스'),
  key('매그너스', '하드'),
  key('반반', '카오스'),
  key('피에르', '카오스'),
  key('블러디 퀸', '카오스'),
  key('벨룸', '카오스'),
])

describe('게임 레퍼런스 데이터 정합성', () => {
  // 가격 파일은 한 조합에 줄이 여럿일 수 있다(기간을 든 줄). 그쪽은 아래 `기간을 든 줄` 이 본다.
  it('주간 보스·드롭 테이블 안에 중복된 보스+난이도 조합이 없다', () => {
    const allWeeklyKeys: string[] = []
    for (const section of ['weekly', 'eventWeekly', 'monthly'] as const) {
      for (const entry of weeklyBosses[section]) {
        for (const difficulty of entry.difficulties) {
          allWeeklyKeys.push(key(entry.boss, difficulty))
        }
      }
    }
    expect(findDuplicates(allWeeklyKeys)).toEqual([])

    const dropKeys = itemDropTable.rewards.map((r) => key(r.boss, r.difficulty))
    expect(findDuplicates(dropKeys)).toEqual([])
  })

  it('weekly-bosses의 모든 보스+난이도 조합이 boss-crystal-prices에 존재한다', () => {
    const weeklyKeys = weeklyBossKeys()
    const priceKeys = new Set(bossCrystalPrices.prices.map((p) => key(p.boss, p.difficulty)))

    const missing = [...weeklyKeys].filter((k) => !priceKeys.has(k))
    expect(missing).toEqual([])
  })

  it('boss-crystal-prices에 weekly-bosses에 없는 보스+난이도 조합이 없다', () => {
    const weeklyKeys = weeklyBossKeys()
    const priceKeys = new Set(bossCrystalPrices.prices.map((p) => key(p.boss, p.difficulty)))

    const extra = [...priceKeys].filter((k) => !weeklyKeys.has(k))
    expect(extra).toEqual([])
  })

  it('priceMeso가 null인 항목은 모두 status가 unreleased다', () => {
    const invalid = bossCrystalPrices.prices.filter(
      (p) => p.priceMeso === null && (p as { status?: string }).status !== 'unreleased'
    )
    expect(invalid).toEqual([])
  })

  it('item-drop-table은 weekly-bosses에 없는 보스+난이도 조합을 포함하지 않는다', () => {
    const weeklyKeys = weeklyBossKeys()
    const dropKeys = new Set(itemDropTable.rewards.map((r) => key(r.boss, r.difficulty)))

    const extra = [...dropKeys].filter((k) => !weeklyKeys.has(k))
    expect(extra).toEqual([])
  })

  it('item-drop-table에서 빠진 조합은 KNOWN_MISSING_DROP_ENTRIES에 등록된 것만 허용한다', () => {
    const weeklyKeys = weeklyBossKeys()
    const dropKeys = new Set(itemDropTable.rewards.map((r) => key(r.boss, r.difficulty)))

    const missing = [...weeklyKeys].filter((k) => !dropKeys.has(k))
    const undocumented = missing.filter((k) => !KNOWN_MISSING_DROP_ENTRIES.has(k))
    expect(undocumented).toEqual([])
  })

  // 코드가 읽는 카테고리는 DROP_CATEGORIES(fixed·equipment·consumable) 뿐이라 그 밖의
  // 키는 화면에 나오지 않는 죽은 데이터다. scroll(주문서 교환권 3종)은 consumable로 흡수했고,
  // misc("태초의 정수")만 미처리로 남았다. 새 죽은 카테고리가 늘어나면 여기서 걸린다.
  it('item-drop-table의 카테고리 키는 코드가 읽는 3종 + 미처리 misc뿐이다', () => {
    const known = new Set([...DROP_CATEGORIES, 'misc'])
    const unknown = [
      ...new Set(itemDropTable.rewards.flatMap((r) => Object.keys(r.rewards))),
    ].filter((category) => !known.has(category as (typeof DROP_CATEGORIES)[number]))

    expect(unknown).toEqual([])
  })

  it('주문서 교환권 3종은 통일된 이름으로만 존재한다', () => {
    const names = new Set(
      itemDropTable.rewards.flatMap((r) =>
        Object.values(r.rewards).flatMap((category) =>
          (category as Array<{ name: string }>).map((item) => item.name)
        )
      )
    )

    expect(names.has('프리미엄 악세서리 스크롤 교환권')).toBe(true)
    expect(names.has('프리미엄 펫장비 스크롤 교환권')).toBe(true)
    expect(names.has('매지컬 무기 주문서 교환권')).toBe(true)
    expect(names.has('프리미엄 악세서리 주문서 교환권')).toBe(false)
    expect(names.has('프리미엄 펫장비 주문서 교환권')).toBe(false)
  })

  it('루인 포스실드는 드랍 항목이 아니므로 item-drop-table에 존재하지 않는다 (사용자 지시 2026-07-31)', () => {
    const hasRuinForceShield = itemDropTable.rewards.some((r) =>
      Object.values(r.rewards).some((category) =>
        (category as Array<{ name: string }>).some((item) => item.name === '루인 포스실드')
      )
    )
    expect(hasRuinForceShield).toBe(false)
  })

  it('황금 메소 주머니는 재화이므로 item-drop-table에 존재하지 않는다', () => {
    const hasGoldenPouch = itemDropTable.rewards.some((r) =>
      Object.values(r.rewards).some((category) =>
        (category as Array<{ name: string }>).some((item) => item.name === '황금 메소 주머니')
      )
    )
    expect(hasGoldenPouch).toBe(false)
  })

  it('모든 파티 인원 상한(기본값·개별 오버라이드)이 1 이상 6 이하다', () => {
    const { minPartySize, defaultMaxPartySize } = bossCrystalPrices.partySizeScaling
    expect(minPartySize).toBe(1)
    expect(defaultMaxPartySize).toBeGreaterThanOrEqual(minPartySize)
    expect(defaultMaxPartySize).toBeLessThanOrEqual(6)

    const invalid = bossCrystalPrices.prices.filter((p) => {
      const maxPartySize = (p as { maxPartySize?: number }).maxPartySize
      return maxPartySize !== undefined && (maxPartySize < minPartySize || maxPartySize > defaultMaxPartySize)
    })
    expect(invalid).toEqual([])
  })

  // weeklyBossSelectionLimit(캐릭터당 12)과 weeklyCrystalSaleLimit(월드당 90)은
  // 이름이 비슷해 서로 바꿔 적기 쉽다. 값의 대소로 뒤바뀜을 잡는다.
  it('weeklyCrystalSaleLimit이 양의 정수이며 weeklyBossSelectionLimit보다 크다', () => {
    const { weeklyCrystalSaleLimit, weeklyBossSelectionLimit } = weeklyBosses

    expect(Number.isInteger(weeklyCrystalSaleLimit)).toBe(true)
    expect(weeklyCrystalSaleLimit).toBeGreaterThan(0)
    expect(weeklyCrystalSaleLimit).toBeGreaterThan(weeklyBossSelectionLimit)
  })

  // requiredLevels는 난이도별 맵이다. 키가 difficulties와 어긋나면 그 난이도는
  // 조용히 "요구 레벨 없음"(=잠금 없음)으로 통과해버려 오타가 드러나지 않는다.
  it('requiredLevels의 키는 같은 엔트리 difficulties의 부분집합이다', () => {
    const invalid: string[] = []
    for (const section of ['weekly', 'eventWeekly', 'monthly'] as const) {
      for (const entry of weeklyBosses[section]) {
        const requiredLevels = (entry as { requiredLevels?: Record<string, number> }).requiredLevels
        if (requiredLevels === undefined) continue
        for (const difficulty of Object.keys(requiredLevels)) {
          if (!entry.difficulties.includes(difficulty)) invalid.push(key(entry.boss, difficulty))
        }
      }
    }
    expect(invalid).toEqual([])
  })

  it('requiredLevels의 값은 모두 양의 정수다', () => {
    const invalid: string[] = []
    for (const section of ['weekly', 'eventWeekly', 'monthly'] as const) {
      for (const entry of weeklyBosses[section]) {
        const requiredLevels = (entry as { requiredLevels?: Record<string, number> }).requiredLevels
        if (requiredLevels === undefined) continue
        for (const [difficulty, level] of Object.entries(requiredLevels)) {
          if (!Number.isInteger(level) || level <= 0) invalid.push(key(entry.boss, difficulty))
        }
      }
    }
    expect(invalid).toEqual([])
  })

  it('컨텐츠 템플릿의 requiredLevel은 값이 있으면 양의 정수다(없으면 레벨 제한 없음)', () => {
    const invalid = [...contentTemplate.daily, ...contentTemplate.weekly].filter((entry) => {
      const level = (entry as { requiredLevel?: number }).requiredLevel
      return level !== undefined && (!Number.isInteger(level) || level <= 0)
    })
    expect(invalid).toEqual([])
  })

  it('eventWeekly의 apiAlias는 문자열이고 공백을 제거해도 boss 필드와 달라야 한다(별칭일 이유가 있어야 함)', () => {
    for (const entry of weeklyBosses.eventWeekly) {
      const apiAlias = (entry as { apiAlias?: string }).apiAlias
      if (apiAlias === undefined) continue
      expect(typeof apiAlias).toBe('string')
      expect(apiAlias.replace(/\s/g, '')).not.toBe(entry.boss.replace(/\s/g, ''))
    }
  })
})

// 줄이 `from`(이 날부터)·`until`(이 날 전까지)을 든다. 기간은 첫날로 판정한다.
interface PeriodRow {
  from?: string
  until?: string
}
interface PriceRow extends PeriodRow {
  boss: string
  difficulty: string
  priceMeso: number | null
  maxPartySize?: number
}
type DropItem = PeriodRow & { name: string; note?: string }

const priceRows = bossCrystalPrices.prices as PriceRow[]
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

function priceRowsByKey(): Map<string, PriceRow[]> {
  const groups = new Map<string, PriceRow[]>()
  for (const row of priceRows) {
    const k = key(row.boss, row.difficulty)
    groups.set(k, [...(groups.get(k) ?? []), row])
  }
  return groups
}

function dropItems(): { category: string; item: DropItem }[] {
  return itemDropTable.rewards.flatMap((reward) =>
    Object.entries(reward.rewards).flatMap(([category, items]) =>
      (items as DropItem[]).map((item) => ({ category, item })),
    ),
  )
}

describe('기간을 든 줄', () => {
  // 어느 기간이든 가격이 정확히 하나여야 한다. 줄 사이가 비면 가격 미확정이 되고, 겹치면 먼저
  // 적힌 줄이 조용히 이긴다.
  it('한 보스·난이도의 가격 줄들이 겹침 없이 이어진다', () => {
    const broken: string[] = []
    for (const [k, rows] of priceRowsByKey()) {
      const sorted = [...rows].sort((a, b) => (a.from ?? '').localeCompare(b.from ?? ''))
      const chained =
        sorted[0].from === undefined &&
        sorted[sorted.length - 1].until === undefined &&
        sorted.slice(0, -1).every((row, i) => row.until !== undefined && row.until === sorted[i + 1].from)
      if (!chained) broken.push(k)
    }
    expect(broken).toEqual([])
  })

  // 경계가 기간 가운데에 서면 첫날로 판정하는 규칙이 그 기간의 처치 일부에 틀린 가격을 준다.
  it('가격의 경계는 그 보스의 기간 경계에 선다. 주간은 목요일, 월간은 1일이다', () => {
    const monthlyBosses = new Set(weeklyBosses.monthly.map((entry) => entry.boss))
    const misplaced: string[] = []
    for (const row of priceRows) {
      for (const date of [row.from, row.until]) {
        if (date === undefined) continue
        const [year, month, day] = date.split('-').map(Number)
        const onBoundary = monthlyBosses.has(row.boss)
          ? day === 1
          : new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 4
        if (!onBoundary) misplaced.push(`${key(row.boss, row.difficulty)} ${date}`)
      }
    }
    expect(misplaced).toEqual([])
  })

  // 파티 인원 상한은 기간을 안 탄다(`getMaxPartySize`). 줄마다 다르면 어느 줄을 읽느냐로 갈린다.
  it('한 보스·난이도의 가격 줄들은 같은 파티 인원 상한을 든다', () => {
    const mismatched = [...priceRowsByKey()]
      .filter(([, rows]) => new Set(rows.map((row) => row.maxPartySize)).size > 1)
      .map(([k]) => k)
    expect(mismatched).toEqual([])
  })

  it('기간 칸은 YYYY-MM-DD 이고, 둘 다 있으면 from 이 until 보다 앞이다', () => {
    const rows: PeriodRow[] = [...priceRows, ...dropItems().map((entry) => entry.item)]
    const invalid = rows.filter(
      (row) =>
        (row.from !== undefined && !DATE_KEY.test(row.from)) ||
        (row.until !== undefined && !DATE_KEY.test(row.until)) ||
        (row.from !== undefined && row.until !== undefined && row.from >= row.until),
    )
    expect(invalid).toEqual([])
  })
})

// 2026-09-17 패치(사용자 제공 2026-09-11). 값을 전부 베끼지 않고 칸 수와 모양만 붙든다.
describe('2026-09-17 패치', () => {
  it('교환권 셋은 26칸 모두 2026-09-17 전까지다', () => {
    for (const name of ['프리미엄 악세서리 스크롤 교환권', '프리미엄 펫장비 스크롤 교환권', '매지컬 무기 주문서 교환권']) {
      const found = dropItems().filter((entry) => entry.item.name === name)

      expect(found).toHaveLength(26)
      for (const entry of found) {
        expect(entry.item.until).toBe('2026-09-17')
        expect(entry.item.from).toBeUndefined()
      }
    }
  })

  it('소울 에테르 넷은 16칸에 2026-09-17 부터 교환 가능한 소비로 선다', () => {
    const found = dropItems().filter((entry) => entry.item.name.endsWith('소울 에테르'))

    expect(found).toHaveLength(16)
    for (const entry of found) {
      expect(entry.category).toBe('consumable')
      expect(entry.item).toMatchObject({ note: '교환 가능', from: '2026-09-17' })
    }
  })

  it('에픽 던전은 넷이고 max_count 는 총 스테이지 수 5 다', () => {
    const epic = contentTemplate.weekly.filter((entry) => entry.content_name.startsWith('에픽 던전 : '))

    expect(epic.map((entry) => entry.content_name)).toEqual([
      '에픽 던전 : 하이마운틴',
      '에픽 던전 : 앵글러 컴퍼니',
      '에픽 던전 : 악몽선경',
      '에픽 던전 : 아우룸 레기스',
    ])
    for (const entry of epic) {
      expect(entry.max_count).toBe(5)
    }
  })
})
