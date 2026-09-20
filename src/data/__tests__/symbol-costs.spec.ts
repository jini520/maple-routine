/// <reference types="node" />
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import huntingGrounds from '../hunting-grounds.json'
import symbolCosts from '../symbol-costs.json'

// 심볼 강화 비용 표. 값은 사용자가 준 표 그대로이고, 이 스위트는 모양을 지킨다.
// 옮겨 적은 값은 두 방향의 오름차순이 지킨다. 몇 개는 값을 못 박는다(`닻`).

const groups = symbolCosts.groups

describe('symbol-costs.json: 규약', () => {
  it('기존 참조표와 같은 머리를 갖는다', () => {
    expect(symbolCosts.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(symbolCosts.source).toContain('사용자 제공')
    expect(symbolCosts.note.length).toBeGreaterThan(0)
  })

  it('표는 2026-09-17 부터다(사용자 지정)', () => {
    expect(symbolCosts.from).toBe('2026-09-17')
  })

  it('묶음 셋의 차례와 최고 레벨', () => {
    expect(groups.map((group) => [group.key, group.name, group.maxLevel, group.symbols.length])).toEqual([
      ['arcane', '아케인 심볼', 20, 6],
      ['authentic', '어센틱 심볼', 11, 6],
      ['grand_authentic', '그랜드 어센틱 심볼', 11, 2],
    ])
  })

  it('비용은 한 단계에 하나라 `maxLevel - 1` 개다', () => {
    for (const group of groups) {
      for (const symbol of group.symbols) {
        expect([symbol.key, symbol.costs.length]).toEqual([symbol.key, group.maxLevel - 1])
      }
    }
  })

  it('심볼 key 는 사냥터 표의 지역 key 다. 같은 지역을 두 이름으로 부르지 않는다', () => {
    const regionKeys = new Set(huntingGrounds.regions.map((region) => region.key))
    const keys = groups.flatMap((group) => group.symbols.map((symbol) => symbol.key))

    expect(keys.filter((key) => !regionKeys.has(key))).toEqual([])
    expect(new Set(keys).size).toBe(keys.length)
  })

  // 사용자 확인값(2026-09-19). 캐릭터 레벨이 이 값 이상이어야 그 심볼이 드롭다운에 선다.
  it('닻: 심볼마다 착용 레벨', () => {
    expect(groups.flatMap((group) => group.symbols.map((symbol) => [symbol.name, symbol.requiredLevel]))).toEqual([
      ['소멸의 여로', 200],
      ['츄츄 아일랜드', 210],
      ['레헬른', 220],
      ['아르카나', 225],
      ['모라스', 230],
      ['에스페라', 235],
      ['세르니움', 260],
      ['아르크스', 265],
      ['오디움', 270],
      ['도원경', 275],
      ['아르테리아', 280],
      ['카르시온', 285],
      ['탈라하트', 290],
      ['기어드락', 295],
    ])
  })

  // 사용자 지정(2026-09-19). 심볼을 고르는 순간 서는 강화 전 · 강화 후 레벨이다.
  it('닻: 묶음마다 기본 레벨 범위. 그 묶음의 레벨 안에 있다', () => {
    expect(groups.map((group) => [group.key, group.defaultRange])).toEqual([
      ['arcane', [7, 12]],
      ['authentic', [5, 8]],
      ['grand_authentic', [5, 8]],
    ])
    for (const group of groups) {
      const [from, to] = group.defaultRange
      expect(1 <= from && from < to && to <= group.maxLevel).toBe(true)
    }
  })

  it('그림 파일이 assets/items/ 에 있다', () => {
    const itemsDir = join(__dirname, '../../assets/items')
    const icons = groups.flatMap((group) => group.symbols.map((symbol) => symbol.icon))

    expect(icons.filter((icon) => !existsSync(join(itemsDir, icon)))).toEqual([])
  })
})

describe('symbol-costs.json: 옮겨 적은 값', () => {
  it('한 심볼 안에서 레벨이 오를수록 비싸다', () => {
    for (const group of groups) {
      for (const symbol of group.symbols) {
        const falling = symbol.costs.flatMap((cost, i) => (i > 0 && cost <= symbol.costs[i - 1]! ? [i] : []))
        expect([symbol.key, falling]).toEqual([symbol.key, []])
      }
    }
  })

  it('같은 단계에서는 뒤의 지역일수록 비싸다', () => {
    for (const group of groups) {
      for (let step = 0; step < group.maxLevel - 1; step += 1) {
        const row = group.symbols.map((symbol) => symbol.costs[step]!)
        expect([group.key, step, row.every((cost, i) => i === 0 || cost > row[i - 1]!)]).toEqual([
          group.key,
          step,
          true,
        ])
      }
    }
  })

  // 표의 첫 칸과 끝 칸. 사용자가 준 이미지의 값이다.
  it('닻: 묶음마다 첫 심볼의 1→2 와 끝 심볼의 마지막 단계', () => {
    const anchors = groups.map((group) => {
      const first = group.symbols[0]!
      const last = group.symbols[group.symbols.length - 1]!
      return [first.name, first.costs[0], last.name, last.costs[last.costs.length - 1]]
    })

    expect(anchors).toEqual([
      ['소멸의 여로', 670_000, '에스페라', 51_810_000],
      ['세르니움', 36_500_000, '카르시온', 1_782_000_000],
      ['탈라하트', 113_600_000, '기어드락', 4_708_000_000],
    ])
  })
})
