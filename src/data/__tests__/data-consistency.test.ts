import { describe, expect, it } from 'vitest'
import weeklyBosses from '../weekly-bosses.json'
import bossCrystalPrices from '../boss-crystal-prices.json'
import itemDropTable from '../item-drop-table.json'

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
// 구분하기 위한 허용 목록 — 여기 없는 조합이 빠지면 테스트가 실패해야 한다.
const KNOWN_MISSING_DROP_ENTRIES = new Set([
  key('자쿰', '카오스'),
  key('매그너스', '하드'),
  key('반반', '카오스'),
  key('피에르', '카오스'),
  key('블러디 퀸', '카오스'),
  key('벨룸', '카오스'),
  key('선택받은 세렌', '익스트림'),
  key('벨로나', '이지'),
  key('벨로나', '노멀'),
  key('벨로나', '하드'),
])

describe('게임 레퍼런스 데이터 정합성', () => {
  it('각 파일 내부에 중복된 보스+난이도 조합이 없다', () => {
    const allWeeklyKeys: string[] = []
    for (const section of ['weekly', 'eventWeekly', 'monthly'] as const) {
      for (const entry of weeklyBosses[section]) {
        for (const difficulty of entry.difficulties) {
          allWeeklyKeys.push(key(entry.boss, difficulty))
        }
      }
    }
    expect(findDuplicates(allWeeklyKeys)).toEqual([])

    const priceKeys = bossCrystalPrices.prices.map((p) => key(p.boss, p.difficulty))
    expect(findDuplicates(priceKeys)).toEqual([])

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

  it('eventWeekly의 apiAlias는 문자열이고 공백을 제거해도 boss 필드와 달라야 한다(별칭일 이유가 있어야 함)', () => {
    for (const entry of weeklyBosses.eventWeekly) {
      const apiAlias = (entry as { apiAlias?: string }).apiAlias
      if (apiAlias === undefined) continue
      expect(typeof apiAlias).toBe('string')
      expect(apiAlias.replace(/\s/g, '')).not.toBe(entry.boss.replace(/\s/g, ''))
    }
  })
})
