import { describe, expect, it } from 'vitest'
import {
  computeProfitDelta,
  formatProfitDeltaBody,
  formatProfitDeltaLabel,
  getComparisonPeriodKeys,
} from '../boss-profit-delta'

describe('computeProfitDelta', () => {
  it('늘었으면 up 이고 퍼센트는 절댓값이다', () => {
    const delta = computeProfitDelta(1_284_500_000, 1_142_800_000)
    expect(delta.direction).toBe('up')
    expect(delta.percent).toBeCloseTo(12.4, 1)
    expect(delta.diffMeso).toBe(141_700_000)
  })

  it('줄었으면 down 이고 퍼센트는 음수로 남는다(표시에서 절댓값을 쓴다)', () => {
    const delta = computeProfitDelta(786_300_000, 1_142_800_000)
    expect(delta.direction).toBe('down')
    expect(delta.percent).toBeCloseTo(-31.2, 1)
    expect(delta.diffMeso).toBe(-356_500_000)
  })

  it('같으면 same 이고 퍼센트는 0이다', () => {
    const delta = computeProfitDelta(1_142_800_000, 1_142_800_000)
    expect(delta.direction).toBe('same')
    expect(delta.percent).toBe(0)
    expect(delta.diffMeso).toBe(0)
  })

  // ADR-087 결정 3 — 0으로 나눌 수 없으므로 퍼센트가 없다. 표시는 절대 증감이 대신 맡는다.
  it('직전 기간이 0이면 퍼센트가 null 이고 절대 증감만 남는다', () => {
    const delta = computeProfitDelta(1_284_500_000, 0)
    expect(delta.direction).toBe('up')
    expect(delta.percent).toBeNull()
    expect(delta.diffMeso).toBe(1_284_500_000)
  })

  it('둘 다 0이면 same 이다 — 0에서 0으로는 아무 일도 없었다', () => {
    const delta = computeProfitDelta(0, 0)
    expect(delta.direction).toBe('same')
    expect(delta.percent).toBe(0)
    expect(delta.diffMeso).toBe(0)
  })

  // 직전 기간을 조회한 적 없는 경우도 0으로 들어온다(ADR-087 결정 3 — store 가 기록 합만 넘긴다).
  // 그래서 이 함수에는 "모른다"라는 입력 자체가 없다.
  it('현재가 0이고 직전이 있으면 down 이고 −100% 다', () => {
    const delta = computeProfitDelta(0, 1_142_800_000)
    expect(delta.direction).toBe('down')
    expect(delta.percent).toBeCloseTo(-100, 5)
    expect(delta.diffMeso).toBe(-1_142_800_000)
  })
})

describe('formatProfitDeltaBody — 칩 안에 들어가는 글자', () => {
  it('퍼센트는 소수 1자리 절댓값이고 부호를 붙이지 않는다(화살표가 방향을 말한다)', () => {
    expect(formatProfitDeltaBody(computeProfitDelta(1_284_500_000, 1_142_800_000))).toBe('12.4%')
    expect(formatProfitDeltaBody(computeProfitDelta(786_300_000, 1_142_800_000))).toBe('31.2%')
  })

  it('같으면 사용자 지정 표기 "-" 다', () => {
    expect(formatProfitDeltaBody(computeProfitDelta(1_142_800_000, 1_142_800_000))).toBe('-')
  })

  it('직전이 0이면 절대 증감을 억 단위로 접는다', () => {
    expect(formatProfitDeltaBody(computeProfitDelta(1_284_500_000, 0))).toBe('12.8억')
  })

  it('억에 못 미치면 만 단위, 만에도 못 미치면 그대로 쓴다', () => {
    expect(formatProfitDeltaBody(computeProfitDelta(85_600_000, 0))).toBe('8,560만')
    expect(formatProfitDeltaBody(computeProfitDelta(8_080, 0))).toBe('8,080')
  })
})

describe('formatProfitDeltaLabel — 화살표·색이 못 전하는 것을 문장으로', () => {
  it('증가·감소를 말로 풀고 기간 이름을 앞에 둔다', () => {
    expect(formatProfitDeltaLabel(computeProfitDelta(1_284_500_000, 1_142_800_000), '지난 주')).toBe(
      '지난 주 대비 12.4퍼센트 증가',
    )
    expect(formatProfitDeltaLabel(computeProfitDelta(786_300_000, 1_142_800_000), '지난 달')).toBe(
      '지난 달 대비 31.2퍼센트 감소',
    )
  })

  // 기간 이름은 "지난 달"(받침 있음)일 수도 "7월 3주차"(없음)일 수도 있다 — 와/과가 갈리는 어법을
  // 아예 쓰지 않는다.
  it('같으면 조사가 필요 없는 "대비" 어법으로 말한다', () => {
    expect(formatProfitDeltaLabel(computeProfitDelta(100, 100), '지난 주')).toBe('지난 주 대비 변화 없음')
    expect(formatProfitDeltaLabel(computeProfitDelta(100, 100), '지난 달')).toBe('지난 달 대비 변화 없음')
    expect(formatProfitDeltaLabel(computeProfitDelta(100, 100), '7월 3주차')).toBe('7월 3주차 대비 변화 없음')
  })

  it('직전이 0이면 퍼센트 대신 그 사실과 절대 증감을 말한다', () => {
    expect(formatProfitDeltaLabel(computeProfitDelta(1_284_500_000, 0), '지난 주')).toBe(
      '지난 주에는 수익이 없었습니다. 12.8억 메소 증가',
    )
  })
})

// ADR-087 결정 2 — 직전 합계의 산식은 그 화면 총액 산식과 같아야 한다.
describe('getComparisonPeriodKeys', () => {
  it('주간 탭은 직전 주 하나다', () => {
    expect(getComparisonPeriodKeys('weekly', '2026-07-30')).toEqual(['2026-07-23'])
  })

  it('월간 탭은 직전 달 + 그 달에 속한 주차 전부다', () => {
    // 2026-06 의 목요일: 6/4 · 6/11 · 6/18 · 6/25
    expect(getComparisonPeriodKeys('monthly', '2026-07')).toEqual([
      '2026-06',
      '2026-06-04',
      '2026-06-11',
      '2026-06-18',
      '2026-06-25',
    ])
  })

  it('월간 탭 1월은 직전 해 12월로 넘어간다', () => {
    const keys = getComparisonPeriodKeys('monthly', '2026-01')
    expect(keys[0]).toBe('2025-12')
    expect(keys.slice(1).every((key) => key.startsWith('2025-12-'))).toBe(true)
  })
})
