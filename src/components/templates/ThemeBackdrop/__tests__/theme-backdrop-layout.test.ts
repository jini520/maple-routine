// 테마 벽지 기하. CSS `background-size: cover` + `background-position` 을 그대로 옮겼는지 본다.
//
// **이 계산이 한 곳인 것이 의 조건**이다. 백드롭(전면)과 헤더 조각이 같은
// 값을 써야 이음매가 없고, 값이 두 벌이면 한쪽만 바뀌어도 아무 데서도 안 드러난다. 그래서 여기서
// 지키는 것은 **그림이 예쁜가** 가 아니라 **두 자리가 같은 식을 쓰는가** 다.
import { parseBackgroundPosition, resolveThemeBackdropLayout } from '../theme-backdrop-layout'

describe('background-position 읽기', () => {
  it('키워드를 0~1 로 옮긴다', () => {
    expect(parseBackgroundPosition('left top')).toEqual({ x: 0, y: 0 })
    expect(parseBackgroundPosition('right bottom')).toEqual({ x: 1, y: 1 })
    expect(parseBackgroundPosition('center center')).toEqual({ x: 0.5, y: 0.5 })
  })

  // 실제 데이터가 이 형태다. 혼테일 `45% bottom`, 검은마법사 `25% bottom`.
  it('퍼센트와 키워드를 섞어 쓴다', () => {
    expect(parseBackgroundPosition('45% bottom')).toEqual({ x: 0.45, y: 1 })
    expect(parseBackgroundPosition('25% bottom')).toEqual({ x: 0.25, y: 1 })
  })

  // CSS 와 같다. 한 값만 오면 가로에 쓰고 세로는 center.
  it('한 값만 오면 세로는 center 다', () => {
    expect(parseBackgroundPosition('left')).toEqual({ x: 0, y: 0.5 })
  })

  it('못 읽는 값은 center 로 떨어진다. 안 보이는 것보다 낫다', () => {
    expect(parseBackgroundPosition('나쁜값')).toEqual({ x: 0.5, y: 0.5 })
  })
})

describe('cover 배치', () => {
  const VIEWPORT = { width: 400, height: 800 }

  // `cover` = 덮는 **최소** 배율. 세로가 긴 뷰포트 + 가로가 긴 그림이면 높이가 기준이 된다.
  it('덮는 최소 배율을 쓴다. 한 축은 딱 맞고 다른 축이 넘친다', () => {
    const layout = resolveThemeBackdropLayout(VIEWPORT, { width: 1000, height: 500 }, 'center')

    // 배율 = max(400/1000, 800/500) = 1.6 → 1600×800
    expect(layout).toMatchObject({ width: 1600, height: 800 })
    expect(layout?.top).toBe(0) // 높이가 딱 맞으므로 세로 여백 없음
  })

  it('넘치는 만큼을 position 비율로 민다', () => {
    const layout = resolveThemeBackdropLayout(VIEWPORT, { width: 1000, height: 500 }, 'left center')
    const centered = resolveThemeBackdropLayout(VIEWPORT, { width: 1000, height: 500 }, 'center')

    expect(layout?.left).toBeCloseTo(0) // left = 넘치는 쪽을 오른쪽으로 다 민다 (`-0` 도 0 이다)
    expect(centered?.left).toBeCloseTo((400 - 1600) / 2) // center = 절반씩
  })

  it('bottom 은 아래를 맞춘다. 실제 두 테마가 쓰는 값이다', () => {
    const layout = resolveThemeBackdropLayout(VIEWPORT, { width: 500, height: 1000 }, '45% bottom')

    // 배율 = max(400/500, 800/1000) = 0.8 → 400×800. 세로도 딱 맞아 여백이 0 이다.
    expect(layout).toMatchObject({ width: 400, height: 800, top: 0 })
  })

  // 크기를 모르면 그리지 않는다. 늘어붙은 그림은 벽지가 아니다.
  it('비트맵 크기를 모르면 배치하지 않는다', () => {
    expect(resolveThemeBackdropLayout(VIEWPORT, null, 'center')).toBeNull()
    expect(resolveThemeBackdropLayout(VIEWPORT, { width: 0, height: 100 }, 'center')).toBeNull()
    expect(
      resolveThemeBackdropLayout(VIEWPORT, { width: Number.NaN, height: 100 }, 'center'),
    ).toBeNull()
  })
})
