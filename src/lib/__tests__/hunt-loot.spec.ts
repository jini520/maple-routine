import { findHuntLoot, huntLootOn, parseHuntLoot } from '../cashbook/hunt-loot'

const 우유 = {
  key: 'reindeer_milk',
  kind: 'consumable',
  name: '순록의 우유',
  iconFile: 'reindeer_milk.webp',
  npcPriceMeso: 2750,
  from: null,
  until: null,
}
const 돋보기 = {
  key: 'suspicious_magnifier',
  kind: 'event',
  name: '수상한 돋보기',
  iconFile: 'suspicious_magnifier.webp',
  npcPriceMeso: null,
  from: '2026-10-22',
  until: '2026-11-19',
}

describe('parseHuntLoot', () => {
  /** 앱이 소비 아이템의 단가를 이 값으로 채운다. 없는 줄을 받으면 금액이 0 으로 적힌다. */
  it('NPC 가격이 소비에만 있고 소비에는 반드시 있어야 표를 받는다', () => {
    expect(parseHuntLoot({ updatedAt: null, items: [우유, 돋보기] })).not.toBeNull()
    expect(parseHuntLoot({ updatedAt: null, items: [{ ...우유, npcPriceMeso: null }] })).toBeNull()
    expect(parseHuntLoot({ updatedAt: null, items: [{ ...돋보기, npcPriceMeso: 100 }] })).toBeNull()
  })
})

describe('huntLootOn', () => {
  const 키들 = (dateKey: string): string[] => huntLootOn(dateKey).map((each) => each.key)

  /** 서버 관리 화면의 끝 날짜는 그날부터 아님이다. 11-18 까지 판 돋보기가 11-19 에는 안 선다. */
  it('이벤트 아이템은 시작 날부터 끝 날 전날까지만 서고 상시 아이템은 늘 선다', () => {
    expect(키들('2026-10-21')).not.toContain('suspicious_magnifier')
    expect(키들('2026-10-22')).toContain('suspicious_magnifier')
    expect(키들('2026-11-18')).toContain('suspicious_magnifier')
    expect(키들('2026-11-19')).not.toContain('suspicious_magnifier')
    expect(키들('2026-11-19')).toEqual(['sol_erda_fragment', 'reindeer_milk', 'sunset_dew'])
  })

  it('기간이 끝난 이벤트 아이템도 key 로는 찾는다. 옛 기록의 이름과 그림이 그 줄에서 온다', () => {
    expect(findHuntLoot('suspicious_magnifier')?.name).toBe('수상한 돋보기')
    expect(findHuntLoot('nobody')).toBeNull()
  })
})
