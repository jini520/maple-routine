/// <reference types="node" />
import { existsSync } from 'node:fs'
import {  join } from 'node:path'
import {
  SOL_ERDA_DENOMINATIONS,
  SOL_ERDA_ENERGY_NAME,
  decomposeSolErda,
  getFixedDropIcons,
  parseFixedAmount } from '../drop/fixed-drops'

const itemsDir = join(__dirname, '../../assets/items')

describe('parseFixedAmount', () => {
  it('"N개" 형식에서 개수를 뽑는다', () => {
    expect(parseFixedAmount('6개')).toBe(6)
    expect(parseFixedAmount('24개')).toBe(24)
    expect(parseFixedAmount('800개')).toBe(800)
  })
  it('단위 없는 숫자(솔 에르다 기운량)도 그대로 파싱한다', () => {
    expect(parseFixedAmount('550')).toBe(550)
  })
  it('개수가 없으면(undefined) 1개로 본다', () => {
    expect(parseFixedAmount(undefined)).toBe(1)
  })
})

describe('decomposeSolErda', () => {
  it('사용자 예시 850을 500×1, 200×1, 10×15로 분해한다', () => {
    expect(decomposeSolErda(850)).toEqual([
      { iconFile: 'sole_500.webp', count: 1 },
      { iconFile: 'sole_200.png', count: 1 },
      { iconFile: 'sole_10.png', count: 15 },
    ])
  })
  it('550 → 500×1, 10×5 (200 단위는 건너뜀)', () => {
    expect(decomposeSolErda(550)).toEqual([
      { iconFile: 'sole_500.webp', count: 1 },
      { iconFile: 'sole_10.png', count: 5 },
    ])
  })
  it('400 → 200×2 (500/1000 없이)', () => {
    expect(decomposeSolErda(400)).toEqual([{ iconFile: 'sole_200.png', count: 2 }])
  })
  it('50 → 10×5', () => {
    expect(decomposeSolErda(50)).toEqual([{ iconFile: 'sole_10.png', count: 5 }])
  })
  it('1000 → 1000×1', () => {
    expect(decomposeSolErda(1000)).toEqual([{ iconFile: 'sole_1000.webp', count: 1 }])
  })
  it('모든 단위 아이콘 파일이 assets/items/에 실제로 존재한다', () => {
    for (const d of SOL_ERDA_DENOMINATIONS) {
      expect(existsSync(join(itemsDir, d.iconFile)), `${d.iconFile} 누락`).toBe(true)
    }
  })
})

describe('getFixedDropIcons', () => {
  it('솔 에르다의 기운은 단위별 아이콘으로 분해한다', () => {
    const icons = getFixedDropIcons({ name: SOL_ERDA_ENERGY_NAME, amount: '850' })
    expect(icons).toEqual([
      { iconFile: 'sole_500.webp', itemName: SOL_ERDA_ENERGY_NAME, count: 1 },
      { iconFile: 'sole_200.png', itemName: SOL_ERDA_ENERGY_NAME, count: 1 },
      { iconFile: 'sole_10.png', itemName: SOL_ERDA_ENERGY_NAME, count: 15 },
    ])
  })

  it('일반 항목은 이름으로 조회(iconFile=null)하고 개수는 amount에서 파싱한다', () => {
    expect(getFixedDropIcons({ name: '메멘토 골드 큐브', amount: '8개' })).toEqual([
      { iconFile: null, itemName: '메멘토 골드 큐브', count: 8 },
    ])
  })

  it('개수 1(또는 amount 없음)인 일반 항목도 count 1로 표시한다', () => {
    expect(getFixedDropIcons({ name: '주문의 흔적', amount: undefined })).toEqual([
      { iconFile: null, itemName: '주문의 흔적', count: 1 },
    ])
  })

  it('개수 2 이상인 일반 항목은 파싱된 개수를 담는다', () => {
    expect(getFixedDropIcons({ name: '변화하는 운명의 파편', amount: '2개' })).toEqual([
      { iconFile: null, itemName: '변화하는 운명의 파편', count: 2 },
    ])
  })
})
