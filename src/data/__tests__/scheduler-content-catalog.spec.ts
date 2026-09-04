import catalog from '../scheduler-content-catalog.json'

function stripSpaces(value: string): string {
  return value.replace(/\s+/g, '')
}

describe('scheduler-content-catalog.json 정합성', () => {
  it('worldShared/accountShared 사이에 이름이 겹치지 않는다 (공백 무시 비교)', () => {
    const worldNames = catalog.worldShared.map((entry) => stripSpaces(entry.name))
    const accountNames = catalog.accountShared.map((entry) => stripSpaces(entry.name))
    const overlap = worldNames.filter((name) => accountNames.includes(name))
    expect(overlap).toEqual([])
  })

  it('worldShared/accountShared 각각 내부에도 중복 이름이 없다', () => {
    for (const section of [catalog.worldShared, catalog.accountShared] as const) {
      const names = section.map((entry) => stripSpaces(entry.name))
      expect(new Set(names).size).toBe(names.length)
    }
  })

  it('worldShared/accountShared 항목의 section은 daily 또는 weekly만 허용한다', () => {
    for (const section of [catalog.worldShared, catalog.accountShared] as const) {
      for (const entry of section) {
        expect(['daily', 'weekly']).toContain(entry.section)
      }
    }
  })

  // 이 항목의 분모는 한 번 뒤집혔다. 2026-08-18 에 5 를 2 로 덮었다가 2026-09-05 에 되돌렸다.
  // 완료 조건은 일간 몬스터파크 5회이고, 주 2회는 수행 제한이라 다른 축이다.
  it('익스트림 몬스터파커에는 오버라이드를 걸지 않는다. API 의 5 가 맞는 값이다', () => {
    const names = Object.keys(catalog.maxCountOverrides).map(stripSpaces)
    expect(names).not.toContain(stripSpaces('[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?'))
  })

  it('maxCountOverrides 값은 전부 양의 정수다', () => {
    for (const value of Object.values(catalog.maxCountOverrides)) {
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThan(0)
    }
  })
})
