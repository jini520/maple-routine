// 떠 있는 바의 **치수**. 바를 렌더하지 않고 볼 수 있어서 따로 있다.
// 이 값을 보는 자리가 셋(`BottomBar`· `bottom-inset`· 그 파생인 안전영역 페이드)이라, 렌더로
// 검사하면 셋 중 하나만 어긋난 상태를 못 잡는다(`bottom-inset.test.ts` 와 같은 판단).

import {
  BAR_MAX_WIDTH,
  BAR_MIN_HEIGHT,
  BAR_SIDE_MARGIN,
  resolveBottomBarMetrics,
} from '../bottom-bar-metrics'

/** 비례 상수를 역산한 기기. 이 폭에서 비율 도입 이전의 값이 그대로 나와야 한다. */
const 기준기기 = 402
const 태블릿 = 834

describe('바의 세로는 창 폭에서 나온다', () => {
  // **이 앱이 이미 쓰고 있던 값이다.** 비례 상수는 고른 것이 아니라 이 한 쌍(402pt → 72)에서
  // 역산한 것이라, 그 기기에서 한 픽셀이라도 움직이면 상수를 잘못 옮긴 것이다.
  it('기준 기기(402pt)에서는 지금까지의 값 그대로다. 폭 374 · 높이 72', () => {
    const metrics = resolveBottomBarMetrics(기준기기, false)

    expect(metrics.widthPx).toBe(기준기기 - BAR_SIDE_MARGIN * 2)
    expect(metrics.heightPx).toBe(72)
  })

  // `비슷한 경험`이 뜻하는 것. 칸이 이미 바 폭의 함수라, 높이를 상수로 두면 알약의 종횡비가
  // 기기마다 달라진다. 넓은 기기가 더 높은 바를 갖는다는 것이 그 비율을 지키는 방법이다.
  it('창이 넓을수록 높이가 커진다. 좁아지지 않는다', () => {
    const heights = [320, 360, 375, 390, 402, 430, 440, 600, 834].map(
      (width) => resolveBottomBarMetrics(width, false).heightPx,
    )

    for (const [i, height] of heights.slice(1).entries()) {
      expect(height).toBeGreaterThanOrEqual(heights[i])
    }
  })

  // 하한은 비례가 무너지는 자리가 아니라 **내용이 먼저 바닥나는** 자리다. 320pt 의 비례값 56 은
  // 글리프 블록(아이콘 25 + 간격 4 + 라벨)이 43 이라 위아래 여백이 3.5 밖에 안 남는다.
  it('좁은 기기에서는 하한에서 멈춘다', () => {
    expect(resolveBottomBarMetrics(320, false).heightPx).toBe(BAR_MIN_HEIGHT)
    // 360dp 안드로이드가 정확히 하한에 앉는다. 이 아래로는 전부 같은 높이다.
    expect(resolveBottomBarMetrics(360, false).heightPx).toBe(BAR_MIN_HEIGHT)
    expect(resolveBottomBarMetrics(390, false).heightPx).toBeGreaterThan(BAR_MIN_HEIGHT)
  })
})

describe('큰 화면에서는 폭이 상한에서 멈춘다', () => {
  // 폭의 상한이 높이의 상한을 겸한다. 값을 따로 적으면 폭은 멈췄는데 높이만 계속 자라는
  // 조합이 만들어지고, 그것은 비율 자체를 깨는 상태다.
  it('폭이 멈추면 높이도 함께 멈춘다', () => {
    const 태블릿_metrics = resolveBottomBarMetrics(태블릿, false)

    expect(resolveBottomBarMetrics(1024, false).heightPx).toBe(태블릿_metrics.heightPx)
    expect(태블릿_metrics.heightPx).toBe(resolveBottomBarMetrics(BAR_MAX_WIDTH + BAR_SIDE_MARGIN * 2, false).heightPx)
  })

  // 남는 폭은 좌우로 갈라진다. 한쪽에 몰면 큰 화면에서 바가 구석에 붙는다.
  it('남는 폭은 좌우로 갈라진다. 가운데 정렬', () => {
    const metrics = resolveBottomBarMetrics(태블릿, false)

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

    expect(metrics.spacePx).toBe(metrics.heightPx + metrics.liftPx)
  })
})

// 3버튼 내비게이션 바는 버튼 줄 전체가 인셋이라, 인셋 바로 위에 서면 바의 아래 끝이 버튼 줄에 붙는다.
// 제스처 핸들 · 홈 인디케이터는 인셋 안에 가는 막대만 있어 띄우지 않아도 떠 보인다.
describe('3버튼 내비게이션 바 위에서만 띄운다', () => {
  it('3버튼이면 좌우 최소 여백과 같은 높이만큼 띄운다. 세 방향의 간격이 같다', () => {
    expect(resolveBottomBarMetrics(기준기기, true).liftPx).toBe(BAR_SIDE_MARGIN)
  })

  it('3버튼이 아니면 띄우지 않는다. 안전영역 바로 위다', () => {
    expect(resolveBottomBarMetrics(기준기기, false).liftPx).toBe(0)
  })

  // 띄우는 것은 자리뿐이다. 폭과 높이까지 바뀌면 같은 기기에서 내비게이션 방식만 바꿔도 알약 비율이 달라진다.
  it('띄워도 폭과 높이는 그대로다', () => {
    const 띄움 = resolveBottomBarMetrics(기준기기, true)
    const 안띄움 = resolveBottomBarMetrics(기준기기, false)

    expect(띄움.widthPx).toBe(안띄움.widthPx)
    expect(띄움.heightPx).toBe(안띄움.heightPx)
    expect(띄움.sideMarginPx).toBe(안띄움.sideMarginPx)
  })
})
