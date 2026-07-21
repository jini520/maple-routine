import { describe, expect, it } from 'vitest'
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

  it('maxCountOverrides 값은 전부 양의 정수다', () => {
    for (const value of Object.values(catalog.maxCountOverrides)) {
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThan(0)
    }
  })
})
