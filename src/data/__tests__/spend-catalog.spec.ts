/// <reference types="node" />
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import spendCatalog from '../spend-catalog.json'

// 지출 참조 목록. 이 기다리던 값이고 사용자가 준 것이다.
//
// 이 스위트가 지키는 것은 **형태**이지 값이 아니다. 값은 도메인 전문가의 것이라 테스트가 베끼면
// 두 벌이 되고, 그러면 게임이 바뀌었을 때 어느 쪽이 진실인지 알 수 없게 된다
// (`boss-crystal-prices` 와 같은 태도). 다만 **몇 개는 값을 못 박는다**. 아래 `닻` 절 참고.

const items = spendCatalog.items as {
  key: string
  category: string
  group: string
  tile: string
  name: string
  currency: string
  unitPrice: number
  unit: string
  tier?: string
  options?: Record<string, string>
  forms?: string[]
  limit?: string
  maxQuantity?: number
  note?: string
  seasonal?: boolean
}[]

const tiles = spendCatalog.tiles as Record<string, { name: string; icon?: { file?: string; map?: string } }>
const groups = spendCatalog.groups as Record<string, { name: string; active?: boolean }>

const KEY_SHAPE = /^[a-z0-9]+(_[a-z0-9]+)*$/
const ASSETS = join(__dirname, '..', '..', 'assets')

describe('spend-catalog.json: 규약', () => {
  it('기존 참조표와 같은 머리를 갖는다', () => {
    expect(spendCatalog.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(spendCatalog.source).toContain('사용자 제공')
    expect(spendCatalog.note.length).toBeGreaterThan(0)
  })

  it('항목이 비어 있지 않다', () => {
    expect(items.length).toBeGreaterThan(0)
  })

  // 사용자 확인값이고 **항상 고정** 이다. 화면이 이 값을 하드코딩
  // 하면 이 막는 자리가 코드에 생긴다.
  it('관세율은 10% 로 고정이다', () => {
    expect(spendCatalog.tariffPercent).toBe(10)
  })

  // 단위를 못 박는 이유: `1억당` 이라 환산이 **곱셈이 아니라 나눗셈**이다.
  // 이 값이 조용히 바뀌면 모든 메포 지출이 1억 배 어긋난다.
  it('메소마켓 시세의 단위는 **1억 메소당 메포** 다', () => {
    expect(spendCatalog.marketRateUnit).toBe('pointPer100mMeso')
    expect(spendCatalog.marketRateNote).toContain('1억 메소당 메포')
  })

  it('이름이 중복되지 않는다', () => {
    const names = items.map((item) => item.name)
    expect(new Set(names).size).toBe(names.length)
  })

  //  이 통화 축을 세웠다. 여기 없는 통화가 새로 생기면 그 결정을 다시 봐야 한다.
  it('통화는 머리에 선언된 것만 쓴다', () => {
    const declared = Object.keys(spendCatalog.currencies)

    for (const item of items) {
      expect(declared).toContain(item.currency)
    }
  })

  it('가격은 양의 정수다', () => {
    for (const item of items) {
      expect(Number.isInteger(item.unitPrice)).toBe(true)
      expect(item.unitPrice).toBeGreaterThan(0)
    }
  })

  it('모든 항목에 묶음·이름·단위가 있다', () => {
    for (const item of items) {
      expect(item.group.length).toBeGreaterThan(0)
      expect(item.name.length).toBeGreaterThan(0)
      expect(item.unit.length).toBeGreaterThan(0)
    }
  })

  // 큰 갈래 넷. 나머지 둘(아이템 구매·기타)은 직접 입력이라 항목이 없다.
  it('갈래는 머리에 선언된 넷뿐이다', () => {
    expect(spendCatalog.categories).toEqual(['content', 'event_bm', 'buff', 'scroll'])

    for (const item of items) {
      expect(spendCatalog.categories).toContain(item.category)
    }
  })

  // 한 묶음이 두 갈래에 걸치면 **이번 달 버프에 얼마** 가 묶음 이름에 따라 갈린다.
  it('한 묶음은 한 갈래에만 속한다', () => {
    const categoryOfGroup = new Map<string, string>()

    for (const item of items) {
      const known = categoryOfGroup.get(item.group)
      if (known === undefined) categoryOfGroup.set(item.group, item.category)
      else expect(item.category).toBe(known)
    }
  })

  it('갈래마다 항목이 있다. 빈 갈래는 고를 수 없는 자리가 된다', () => {
    for (const category of spendCatalog.categories) {
      expect(items.some((item) => item.category === category)).toBe(true)
    }
  })
})

/**
 * key 는 기록이 카탈로그를 가리키는 열쇠다. 이름이 바뀌어도 그대로여야 하고, 가리키는 key 가
 * 표에 없으면 옛 기록이 이름으로만 선다.
 */
describe('spend-catalog.json: key', () => {
  it('항목 · 타일 · 묶음 key 는 영문 snake_case 다', () => {
    for (const key of [...items.map((item) => item.key), ...Object.keys(tiles), ...Object.keys(groups)]) {
      expect(key).toMatch(KEY_SHAPE)
    }
  })

  it('항목 key 는 중복되지 않는다', () => {
    const keys = items.map((item) => item.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('항목이 가리키는 타일과 묶음이 표에 있다', () => {
    for (const item of items) {
      expect(tiles[item.tile]).toBeDefined()
      expect(groups[item.group]).toBeDefined()
    }
  })

  it('표의 타일과 묶음은 모두 항목을 갖는다. 빈 자리는 고를 수 없는 타일이 된다', () => {
    for (const key of Object.keys(tiles)) {
      expect(items.some((item) => item.tile === key)).toBe(true)
    }
    for (const key of Object.keys(groups)) {
      expect(items.some((item) => item.group === key)).toBe(true)
    }
  })

  it('타일 이름과 묶음 이름은 중복되지 않는다', () => {
    const tileNames = Object.values(tiles).map((tile) => tile.name)
    const groupNames = Object.values(groups).map((group) => group.name)
    expect(new Set(tileNames).size).toBe(tileNames.length)
    expect(new Set(groupNames).size).toBe(groupNames.length)
  })

  // 한 타일의 항목이 두 묶음 · 두 갈래에 흩어지면 목록에서 타일 하나가 두 자리에 선다.
  it('한 타일의 항목은 한 묶음에 모인다', () => {
    const groupOfTile = new Map<string, string>()
    for (const item of items) {
      const known = groupOfTile.get(item.tile)
      if (known === undefined) groupOfTile.set(item.tile, item.group)
      else expect(item.group).toBe(known)
    }
  })

  it('형태는 exp · sol_erda 만 쓴다', () => {
    for (const item of items) {
      for (const form of item.forms ?? []) {
        expect(['exp', 'sol_erda']).toContain(form)
      }
    }
  })

  it('타일 그림 파일이 실제로 있다', () => {
    for (const tile of Object.values(tiles)) {
      if (tile.icon?.file !== undefined) {
        expect(existsSync(join(ASSETS, 'items', tile.icon.file))).toBe(true)
      }
      if (tile.icon?.map !== undefined) {
        const found = ['webp', 'png'].some((ext) => existsSync(join(ASSETS, 'maps', 'icons', `${tile.icon!.map}.${ext}`)))
        expect(found).toBe(true)
      }
    }
  })
})

describe('spend-catalog.json: 닻 (사용자 확인값, 2026-08-23)', () => {
  const priceOf = (name: string): number | undefined =>
    items.find((item) => item.name === name)?.unitPrice

  // 형태만 검사하면 **값이 조용히 바뀌는** 사고를 못 잡는다. 묶음마다 하나씩만 못 박는다.
  // 전부 베끼면 두 벌이 되고, 하나도 안 박으면 오타가 통과한다.
  it('묶음마다 대표값 하나가 고정돼 있다', () => {
    expect(priceOf('하이마운틴 1단계')).toBe(7500)
    expect(priceOf('몬스터 파크')).toBe(600)
    expect(priceOf('미호로이드')).toBe(7500)
    expect(priceOf('에픽던전')).toBe(5000)
    expect(priceOf('닉네임 변경')).toBe(15000)
    expect(priceOf('콜렉터의 영약')).toBe(20000000)
    // 2026-09-11 사용자 제공(2026-09-17 패치 · 주문서 갈래).
    expect(priceOf('아우룸 레기스 2단계')).toBe(60000)
    expect(priceOf('놀라운 긍정의 혼돈 주문서 60%')).toBe(500000)
    expect(priceOf('펫장비 이노센트')).toBe(1000000000)
    expect(priceOf('펫장비 리턴')).toBe(500000000)
  })

  // 에픽던전 추가 리워드는 **경험치 / 솔 에르다** 두 형태가 **같은 값**이다(사용자 확인). 형태가
  // 가격을 가르지 않는다는 것이 이 데이터의 성질이라 구조로 못 박는다.
  it('에픽던전 추가 리워드는 여덟이고 전부 두 형태를 갖는다', () => {
    const rewards = items.filter((item) => item.group === 'epic_dungeon_bonus_reward')

    expect(rewards).toHaveLength(8)
    for (const reward of rewards) {
      expect(reward.forms).toEqual(['exp', 'sol_erda'])
    }
  })

  // 메포샵은 **기간 운영** 이다. 상시 목록과 섞이면 없어진 상품이 계속 뜬다.
  it('메이플 포인트 샵만 seasonal 이다', () => {
    for (const item of items) {
      expect(item.seasonal === true).toBe(item.group === 'maple_point_shop')
    }
  })

  // 버프 물약과 주문서만 메소다(주문서는 2026-09-11 사용자 제공). 나머지는 전부 메포라는 것이
  // 이 데이터의 축이다.
  it('메소로 사는 것은 버프 물약과 주문서뿐이다', () => {
    for (const item of items) {
      expect(item.currency).toBe(item.group === 'buff_potion' || item.category === 'scroll' ? 'meso' : 'point')
    }
  })
})

/**
 * **묶음 표는 이름과 지금 열렸나 를 든다**.
 *
 * 기간제 이벤트(메이플 포인트 샵)는 열릴 때와 안 열릴 때가 있고 품목도 갈린다. 그 사실을 **날짜로
 * 판정하지 않는 것**이 결정이라(미뤄지는 날 앱이 거짓말을 한다) 여기 적힌 값이 곧 사실이다.
 */
describe('spend-catalog.json: 묶음 표', () => {
  it('메이플 포인트 샵은 지금 안 열려 있다 (사용자 확인 2026-08-27)', () => {
    expect(groups.maple_point_shop).toMatchObject({ name: '메이플 포인트 샵', active: false })
  })

  it('`active` 를 적은 묶음은 메이플 포인트 샵뿐이다. 안 적은 묶음은 언제나 열린 것이다', () => {
    const withActive = Object.entries(groups).filter(([, group]) => group.active !== undefined)
    expect(withActive.map(([key]) => key)).toEqual(['maple_point_shop'])
  })
})

/**
 * **상한이 1이면 셀 것이 없다**.
 *
 * 에픽던전 추가 리워드는 메이플 ID 당 주 1회라(사용자 확인) 수량이 오르내릴 자리가 없다.
 * 화면은 이 값으로 수량 줄을 세울지 정하므로, 여기가 바뀌면 그 줄이 조용히 되살아난다.
 */
describe('spend-catalog.json: 수량 상한', () => {
  it('에픽던전 추가 리워드 여덟은 상한이 1이다', () => {
    const epic = items.filter((item) => item.group === 'epic_dungeon_bonus_reward')

    expect(epic).toHaveLength(8)
    for (const item of epic) {
      expect(item.maxQuantity).toBe(1)
    }
  })
})

/**
 * 주문서 19종(사용자 제공 2026-09-11). 가격이 같고 이름이 비슷한 것은 타일 하나로 묶였고, 줄이
 * 둘인 타일(매지컬 · 귀 장식)은 항목이 축 값(`options`)을 든다.
 */
describe('spend-catalog.json: 주문서', () => {
  const scrolls = items.filter((item) => item.category === 'scroll')

  it('열아홉이고 전부 메소로 개수를 센다. 수량 상한이 없다', () => {
    expect(scrolls).toHaveLength(19)
    for (const item of scrolls) {
      expect(item).toMatchObject({ currency: 'meso', unit: '개' })
      expect(item.maxQuantity).toBeUndefined()
    }
  })

  it('묶음은 셋이다', () => {
    expect([...new Set(scrolls.map((item) => item.group))]).toEqual(['scroll', 'pet_equipment_scroll', 'return_scroll'])
  })

  // 축 값과 단계는 둘 중 하나다. 둘 다 있으면 폼이 어느 줄을 세울지 모른다.
  it('축 값을 든 항목은 단계를 안 든다', () => {
    for (const item of items.filter((each) => each.options !== undefined)) {
      expect(item.tier).toBeUndefined()
    }
  })

  // 조합이 겹치면 두 줄을 다 골라도 항목이 하나로 안 정해져 저장이 영영 꺼진다.
  it('한 타일 안에서 축 값의 조합이 겹치지 않는다', () => {
    const seen = new Set<string>()
    for (const item of items.filter((each) => each.options !== undefined)) {
      const combo = `${item.tile}|${JSON.stringify(Object.entries(item.options!).sort())}`
      expect(seen.has(combo)).toBe(false)
      seen.add(combo)
    }
  })

  it('줄이 둘인 타일은 매지컬 주문서와 귀 장식 주문서다', () => {
    const withOptions = new Set(items.filter((each) => each.options !== undefined).map((each) => each.tile))

    expect([...withOptions]).toEqual(['magical_scroll', 'earring_scroll'])
  })
})
