// today 위젯 격자의 **치수**. 격자를 렌더하지 않고 볼 수 있어서 따로 있다 —
// `bottom-bar-metrics.test.ts` 와 같은 판단이다.

import {
  GRID_COLUMNS,
  GRID_GAP,
  GRID_ROW_HEIGHT,
  GRID_SIDE_PADDING,
  resolveWidgetGridMetrics,
  tileHeightPx,
  tileWidthPx,
} from '../today/widget-grid-metrics'

/** 안드로이드 최소 폭 — 이 열 폭 73 을 적어 둔 그 기기다. */
const 안드로이드_최소 = 360

describe('열 폭은 창 폭에서 나온다', () => {
  it('360dp 에서 열 폭 73', () => {
    expect(resolveWidgetGridMetrics(안드로이드_최소).colWidthPx).toBe(73)
  })

  // 열 폭을 반올림하지 않는 이유가 이것이다 — 4칸 타일의 좌우가 화면 여백과 **정확히** 맞아야
  // 한다. 반올림하면 폭에 따라 오른쪽이 최대 3px 어긋난 채로 조용히 산다.
  it('4칸 타일은 좌우 여백을 뺀 폭을 정확히 채운다', () => {
    for (const 창폭 of [320, 360, 390, 402, 430, 674, 834]) {
      const metrics = resolveWidgetGridMetrics(창폭)

      expect(tileWidthPx(GRID_COLUMNS, metrics)).toBeCloseTo(창폭 - GRID_SIDE_PADDING * 2, 10)
    }
  })

  it('타일 폭·높이는 칸과 그 사이 간격의 합이다', () => {
    const metrics = resolveWidgetGridMetrics(안드로이드_최소)

    expect(tileWidthPx(1, metrics)).toBe(73)
    expect(tileWidthPx(2, metrics)).toBe(73 * 2 + GRID_GAP)
    expect(tileWidthPx(4, metrics)).toBe(328)

    // 세로는 **행 높이의 함수**다 — 숫자를 손으로 적으면 행 높이를 조정할 때마다 여기가 깨진다
    // (로 76 → 82 가 됐다). 폭 쪽이 73·328 을 적는 것과 성질이 다르다: 그쪽은 창 폭에서
    // 나눠 떨어진 값이라 «계산이 맞는가» 를 묻는 자리다.
    expect(tileHeightPx(1, metrics)).toBe(GRID_ROW_HEIGHT)
    expect(tileHeightPx(2, metrics)).toBe(GRID_ROW_HEIGHT * 2 + GRID_GAP)
    expect(tileHeightPx(3, metrics)).toBe(GRID_ROW_HEIGHT * 3 + GRID_GAP * 2)
  })

  it('창이 넓어지면 열 폭도 넓어진다', () => {
    const 좁은 = resolveWidgetGridMetrics(안드로이드_최소).colWidthPx
    const 넓은 = resolveWidgetGridMetrics(안드로이드_최소 * 2).colWidthPx

    expect(넓은).toBeGreaterThan(좁은)
  })
})

// **이 파일의 핵심 회귀 가드다.** 행 높이를 열 폭에서 파생하면(정사각 셀) 격자가 화면 폭에
// 비례해 길어져, 폴더블 펼침(~700dp)에서 4x2 타일 하나가 화면 절반을 넘는다. 위젯은 폭이 늘면
// **넓어지는** 물건이지 같이 길어지는 물건이 아니다.
describe('행 높이는 창 폭을 따라가지 않는다', () => {
  it('폭이 두 배가 되어도 행 높이는 그대로 76 이다', () => {
    expect(resolveWidgetGridMetrics(안드로이드_최소).rowHeightPx).toBe(GRID_ROW_HEIGHT)
    expect(resolveWidgetGridMetrics(안드로이드_최소 * 2).rowHeightPx).toBe(GRID_ROW_HEIGHT)
  })

  it.each([320, 360, 402, 430, 674, 834, 1024])('창 %ipx — 행 높이 76 · 간격 12 · 좌우 16', (창폭) => {
    const metrics = resolveWidgetGridMetrics(창폭)

    expect(metrics.rowHeightPx).toBe(GRID_ROW_HEIGHT)
    expect(metrics.gapPx).toBe(GRID_GAP)
    expect(metrics.padPx).toBe(GRID_SIDE_PADDING)
  })

  it('큰 화면에서 타일은 옆으로만 넓어진다', () => {
    const 좁은 = resolveWidgetGridMetrics(안드로이드_최소)
    const 펼친 = resolveWidgetGridMetrics(674)

    expect(tileWidthPx(4, 펼친)).toBeGreaterThan(tileWidthPx(4, 좁은))
    expect(tileHeightPx(2, 펼친)).toBe(tileHeightPx(2, 좁은))
  })
})
