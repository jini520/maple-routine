/// <reference types="node" />
import { appImage } from '../assets/asset-lookup'
import {
  SOL_ERDA_DENOMINATIONS,
  SOL_ERDA_ENERGY_KEY,
  decomposeSolErda,
  getFixedDropIcons,
  parseFixedAmount } from '../drop/fixed-drops'


describe('parseFixedAmount', () => {
  it('"N개" 형식에서 개수를 뽑는다', () => {
    expect(parseFixedAmount('6개')).toBe(6)
    expect(parseFixedAmount('24개')).toBe(24)
    expect(parseFixedAmount('800개')).toBe(800)
  })
  it('개수가 없으면(undefined) 1개로 본다', () => {
    expect(parseFixedAmount(undefined)).toBe(1)
  })
})

describe('decomposeSolErda', () => {
  it('사용자 예시 850을 500×1, 200×1, 10×15로 분해한다', () => {
    expect(decomposeSolErda(850)).toEqual([
      { imageKey: 'sol_erda_energy_500', count: 1 },
      { imageKey: 'sol_erda_energy_200', count: 1 },
      { imageKey: 'sol_erda_energy_10', count: 15 },
    ])
  })
  it('550 → 500×1, 10×5 (200 단위는 건너뜀)', () => {
    expect(decomposeSolErda(550)).toEqual([
      { imageKey: 'sol_erda_energy_500', count: 1 },
      { imageKey: 'sol_erda_energy_10', count: 5 },
    ])
  })
  // 코드가 적은 앱 그림 key 다. 앱 그림 표에 없으면 그림만 빠진다.
  it('모든 단위 아이콘이 앱 그림 표에 있다', () => {
    for (const d of SOL_ERDA_DENOMINATIONS) {
      expect([d.imageKey, appImage(d.imageKey)]).not.toContain(null)
    }
  })
})

describe('getFixedDropIcons', () => {
  it('솔 에르다의 기운은 단위별 아이콘으로 분해한다', () => {
    const icons = getFixedDropIcons({ key: SOL_ERDA_ENERGY_KEY, name: '솔 에르다의 기운', amount: '850' })
    expect(icons).toEqual([
      { imageKey: 'sol_erda_energy_500', itemKey: SOL_ERDA_ENERGY_KEY, count: 1 },
      { imageKey: 'sol_erda_energy_200', itemKey: SOL_ERDA_ENERGY_KEY, count: 1 },
      { imageKey: 'sol_erda_energy_10', itemKey: SOL_ERDA_ENERGY_KEY, count: 15 },
    ])
  })

  it('일반 항목은 key 로 조회(imageKey=null)하고 개수는 amount에서 파싱한다', () => {
    expect(getFixedDropIcons({ key: 'memento_gold_cube', name: '메멘토 골드 큐브', amount: '8개' })).toEqual([
      { imageKey: null, itemKey: 'memento_gold_cube', count: 8 },
    ])
  })

  it('개수 1(또는 amount 없음)인 일반 항목도 count 1로 표시한다', () => {
    expect(getFixedDropIcons({ key: 'spell_trace', name: '주문의 흔적', amount: undefined })).toEqual([
      { imageKey: null, itemKey: 'spell_trace', count: 1 },
    ])
  })
})
