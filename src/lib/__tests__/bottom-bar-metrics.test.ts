// 떠 있는 바의 **치수**. 바를 렌더하지 않고 볼 수 있어서 따로 있다.
// 이 값을 보는 자리가 넷(`BottomBar` · `bottom-inset` · 안전영역 페이드 · 설정 미리보기)이라, 렌더로
// 검사하면 그중 하나만 어긋난 상태를 못 잡는다(`bottom-inset.test.ts` 와 같은 판단).

import {
  BACK_CIRCLE,
  BACK_GAP,
  BAR_HEIGHT,
  BAR_MAX_WIDTH,
  BAR_PADDING,
  BAR_SIDE_MARGIN,
  RAIL_BAR_ITEM_HEIGHT,
  SUB_ROW_SLOTS,
  resolveBarRowLayout,
  resolveBottomBarMetrics,
  resolveBottomBarSpace,
  resolveRailBarMetrics,
} from '../bottom-bar-metrics'
import { resolveScreenLayout } from '../screen-layout'

const 아이폰17 = 402
const 태블릿 = 834

describe('바의 높이는 창 폭과 관계없이 62 다', () => {
  // 시스템 탭 바가 기기 폭과 관계없이 62 다. 폭에 비례시키면 좁은 기기와 태블릿에서 시스템 바와 높이가 갈린다.
  it.each([320, 360, 402, 440, 834])('창 %ipx', (windowWidthPx) => {
    expect(resolveBottomBarMetrics(windowWidthPx, false).heightPx).toBe(62)
  })

  it('폭은 창 폭에서 좌우 21 씩 뺀 값이다', () => {
    expect(resolveBottomBarMetrics(아이폰17, false).widthPx).toBe(아이폰17 - 21 * 2)
  })
})

describe('칸과 알약은 바 폭에서 계산한다', () => {
  const widthPx = resolveBottomBarMetrics(아이폰17, false).widthPx
  const group = resolveBarRowLayout({ fullLengthPx: widthPx, groupSlots: 5, sub: false, paddingPx: BAR_PADDING })
  const sub = resolveBarRowLayout({ fullLengthPx: widthPx, groupSlots: 5, sub: true, paddingPx: BAR_PADDING })

  it('그룹 행: 칸 폭은 (폭 − 4 × 2 − 9) ÷ 5, 알약은 칸 폭 + 9', () => {
    const slot = (widthPx - 4 * 2 - 9) / 5
    expect(group.spacingPx).toBeCloseTo(slot)
    expect(group.pillLengthPx).toBeCloseTo(slot + 9)
  })

  // 끝 칸 알약이 바 끝에서 위아래와 같은 여백을 남긴다. 알약이 바 밖으로 나가거나 끝에 붙지 않는다.
  it.each([
    ['그룹 행', group, 5],
    ['하위 행', sub, SUB_ROW_SLOTS],
  ] as const)('%s: 양 끝 칸의 알약이 바 끝에서 안쪽 여백만큼 떨어진다', (_name, row, slots) => {
    expect(row.firstCenterPx - row.pillLengthPx / 2).toBeCloseTo(BAR_PADDING)
    const last = row.firstCenterPx + row.spacingPx * (slots - 1)
    expect(row.lengthPx - (last + row.pillLengthPx / 2)).toBeCloseTo(BAR_PADDING)
  })

  // 하위가 셋인 그룹과 넷인 그룹을 오갈 때 알약 크기가 튀지 않아야 한다.
  it('하위 행은 ← 원 자리를 뺀 남은 폭을 네 칸으로 나누고, 알약 폭은 그룹 행과 같다', () => {
    expect(sub.offsetPx).toBe(BACK_CIRCLE + BACK_GAP)
    expect(sub.lengthPx).toBe(widthPx - 54 - 8)
    expect(sub.pillLengthPx).toBe(group.pillLengthPx)
    expect(SUB_ROW_SLOTS).toBe(4)
  })
})

describe('큰 화면에서는 폭이 상한에서 멈춘다', () => {
  // 남는 폭은 좌우로 갈라진다. 한쪽에 몰면 큰 화면에서 바가 구석에 붙는다.
  it('남는 폭은 좌우로 갈라진다. 가운데 정렬', () => {
    const metrics = resolveBottomBarMetrics(태블릿, false)

    expect(metrics.widthPx).toBe(BAR_MAX_WIDTH)
    expect(metrics.sideMarginPx).toBe((태블릿 - BAR_MAX_WIDTH) / 2)
    expect(metrics.sideMarginPx * 2 + metrics.widthPx).toBe(태블릿)
  })
})

// 이 값이 바의 실제 높이와 어긋나면 콘텐츠가 바 뒤로 들어가거나(작으면) 바닥에 빈 띠가 남는다(크면).
describe('콘텐츠가 남기는 몫은 바 높이와 띄운 높이에서 나온다', () => {
  it.each([
    [320, false],
    [402, false],
    [834, false],
    [320, true],
    [402, true],
    [834, true],
  ])('창 %ipx · 3버튼 %s: 몫 = 높이 + 띄운 높이', (windowWidthPx, buttonNavigation) => {
    const metrics = resolveBottomBarMetrics(windowWidthPx, buttonNavigation)

    expect(metrics.spacePx).toBe(BAR_HEIGHT + metrics.liftPx)
  })
})

// 3버튼 내비게이션 바는 버튼 줄 전체가 인셋이라, 인셋 바로 위에 서면 바의 아래 끝이 버튼 줄에 붙는다.
// 제스처 핸들 · 홈 인디케이터는 인셋 안에 가는 막대만 있어 띄우지 않아도 떠 보인다.
describe('3버튼 내비게이션 바 위에서만 띄운다', () => {
  it('3버튼이면 좌우 최소 여백과 같은 21 만큼 띄운다. 세 방향의 간격이 같다', () => {
    expect(resolveBottomBarMetrics(아이폰17, true).liftPx).toBe(BAR_SIDE_MARGIN)
    expect(BAR_SIDE_MARGIN).toBe(21)
  })

  it('3버튼이 아니면 띄우지 않는다. 안전영역 바로 위다', () => {
    expect(resolveBottomBarMetrics(아이폰17, false).liftPx).toBe(0)
  })

  // 띄우는 것은 자리뿐이다. 폭까지 바뀌면 같은 기기에서 내비게이션 방식만 바꿔도 알약 비율이 달라진다.
  it('띄워도 폭과 높이는 그대로다', () => {
    const 띄움 = resolveBottomBarMetrics(아이폰17, true)
    const 안띄움 = resolveBottomBarMetrics(아이폰17, false)

    expect(띄움.widthPx).toBe(안띄움.widthPx)
    expect(띄움.heightPx).toBe(안띄움.heightPx)
    expect(띄움.sideMarginPx).toBe(안띄움.sideMarginPx)
  })
})

describe('오른쪽 레일 화면의 세로 막대', () => {
  const 듀오_외부 = resolveScreenLayout({ platform: 'ios', windowWidthPx: 466, windowHeightPx: 678, insetRightPx: 84 })
  const 아래_안전영역 = 34
  const 막대 = resolveRailBarMetrics({ layout: 듀오_외부, bottomSafeAreaPx: 아래_안전영역, itemCount: 5 })

  // 아래 끝이 안전영역에 닿는 것은 가로 바와 같은 높이다. 띄우면 시안에서 고른 자리와 갈린다.
  it('아래 끝이 아래쪽 안전영역 위에 닿는다', () => {
    expect(막대.topPx + 막대.heightPx).toBe(듀오_외부.windowHeightPx - 아래_안전영역)
  })

  // OS 막대의 자리는 앱에 주어지지 않는다. 앱이 아는 것은 오른쪽 안전영역뿐이다.
  it('가로 가운데가 오른쪽 안전영역의 가운데이고, 막대가 콘텐츠 폭 안으로 들어오지 않는다', () => {
    expect(막대.leftPx + 막대.widthPx / 2).toBe(듀오_외부.contentWidthPx + 듀오_외부.railWidthPx / 2)
    expect(막대.leftPx).toBeGreaterThanOrEqual(듀오_외부.contentWidthPx)
  })

  it('칸 56 다섯과 위아래 안쪽 여백이 막대 높이를 정한다', () => {
    expect(RAIL_BAR_ITEM_HEIGHT * 5 + BAR_PADDING * 2).toBe(막대.heightPx)
  })

  // 하위 행은 ← 원이 막대 위에 선다. 그 원까지 OS 가 그린 시계(y 152 까지) 아래여야 한다.
  it('← 원을 올려도 OS 막대보다 아래다', () => {
    expect(막대.topPx).toBeGreaterThan(152)
  })
})

// 콘텐츠 끝 여백 · 토스트 · ＋ 는 바가 아래에서 먹는 몫 위에 선다. 세로 막대는 옆에 서므로 그 몫이 없다.
describe('바가 화면 아래에서 먹는 몫', () => {
  it('side-rail 에서는 0 이다', () => {
    const layout = resolveScreenLayout({ platform: 'ios', windowWidthPx: 466, windowHeightPx: 678, insetRightPx: 84 })

    expect(resolveBottomBarSpace(layout, false)).toEqual({ heightPx: 0, liftPx: 0, spacePx: 0 })
  })

  it('phone 에서는 높이 62 에 띄운 높이를 더한다', () => {
    const layout = resolveScreenLayout({ platform: 'ios', windowWidthPx: 아이폰17, windowHeightPx: 874, insetRightPx: 0 })

    expect(resolveBottomBarSpace(layout, true)).toEqual({ heightPx: 62, liftPx: 21, spacePx: 83 })
  })
})
