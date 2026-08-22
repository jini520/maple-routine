import spendCatalog from '../spend-catalog.json'

// 지출 참조 목록 — [[ADR-166]] 결정 7 이 기다리던 값이고 사용자가 준 것이다([[ADR-006]]).
//
// 이 스위트가 지키는 것은 **형태**이지 값이 아니다. 값은 도메인 전문가의 것이라 테스트가 베끼면
// 두 벌이 되고, 그러면 게임이 바뀌었을 때 어느 쪽이 진실인지 알 수 없게 된다
// (`boss-crystal-prices` 와 같은 태도). 다만 **몇 개는 값을 못 박는다** — 아래 「닻」 절 참고.

const items = spendCatalog.items as {
  category: string
  group: string
  name: string
  currency: string
  unitPrice: number
  unit: string
  forms?: string[]
  limit?: string
  note?: string
  seasonal?: boolean
}[]

describe('spend-catalog.json — 규약', () => {
  it('기존 참조표와 같은 머리를 갖는다', () => {
    expect(spendCatalog.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(spendCatalog.source).toContain('사용자 제공')
    expect(spendCatalog.note.length).toBeGreaterThan(0)
  })

  it('항목이 비어 있지 않다', () => {
    expect(items.length).toBeGreaterThan(0)
  })

  it('이름이 중복되지 않는다 — 선택 목록의 키가 된다', () => {
    const names = items.map((item) => item.name)
    expect(new Set(names).size).toBe(names.length)
  })

  // [[ADR-166]] 결정 1 이 통화 축을 세웠다. 여기 없는 통화가 새로 생기면 그 결정을 다시 봐야 한다.
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

  // [[ADR-166]] 정정 1 ② — 큰 갈래 셋. 나머지 둘(아이템 구매·기타)은 직접 입력이라 항목이 없다.
  it('갈래는 머리에 선언된 셋뿐이다', () => {
    expect(spendCatalog.categories).toEqual(['컨텐츠', '상점·편의', '버프'])

    for (const item of items) {
      expect(spendCatalog.categories).toContain(item.category)
    }
  })

  // 한 묶음이 두 갈래에 걸치면 «이번 달 버프에 얼마» 가 묶음 이름에 따라 갈린다.
  it('한 묶음은 한 갈래에만 속한다', () => {
    const categoryOfGroup = new Map<string, string>()

    for (const item of items) {
      const known = categoryOfGroup.get(item.group)
      if (known === undefined) categoryOfGroup.set(item.group, item.category)
      else expect(item.category).toBe(known)
    }
  })

  it('갈래 셋이 모두 항목을 갖는다 — 빈 갈래는 고를 수 없는 자리가 된다', () => {
    for (const category of spendCatalog.categories) {
      expect(items.some((item) => item.category === category)).toBe(true)
    }
  })
})

describe('spend-catalog.json — 닻 (사용자 확인값, 2026-08-23)', () => {
  const priceOf = (name: string): number | undefined =>
    items.find((item) => item.name === name)?.unitPrice

  // 형태만 검사하면 «값이 조용히 바뀌는» 사고를 못 잡는다. 묶음마다 하나씩만 못 박는다 —
  // 전부 베끼면 두 벌이 되고, 하나도 안 박으면 오타가 통과한다.
  it('묶음마다 대표값 하나가 고정돼 있다', () => {
    expect(priceOf('하이마운틴 1단계')).toBe(7500)
    expect(priceOf('몬스터 파크')).toBe(600)
    expect(priceOf('미호로이드 교환권')).toBe(7500)
    expect(priceOf('에픽던전 퀵패스')).toBe(5000)
    expect(priceOf('닉네임 변경')).toBe(15000)
    expect(priceOf('콜렉터의 영약')).toBe(20000000)
  })

  // 에픽던전 추가 리워드는 «경험치 / 솔 에르다» 두 형태가 **같은 값**이다(사용자 확인) — 형태가
  // 가격을 가르지 않는다는 것이 이 데이터의 성질이라 구조로 못 박는다.
  it('에픽던전 추가 리워드는 여섯이고 전부 두 형태를 갖는다', () => {
    const rewards = items.filter((item) => item.group === '에픽던전 추가 리워드')

    expect(rewards).toHaveLength(6)
    for (const reward of rewards) {
      expect(reward.forms).toEqual(['경험치', '솔 에르다'])
    }
  })

  // 메포샵은 «기간 운영» 이다 — 상시 목록과 섞이면 없어진 상품이 계속 뜬다.
  it('메이플 포인트 샵만 seasonal 이다', () => {
    for (const item of items) {
      expect(item.seasonal === true).toBe(item.group === '메이플 포인트 샵')
    }
  })

  // 버프 물약만 메소다 — 나머지는 전부 메포라는 것이 이 데이터의 축이다.
  it('메소로 사는 것은 버프 물약뿐이다', () => {
    for (const item of items) {
      expect(item.currency).toBe(item.group === '버프 물약' ? 'meso' : 'point')
    }
  })
})
