import {
  CARD_GAP_PX,
  DEFAULT_KEYBOARD_PX,
  MIN_BOTTOM_INSET_PX,
  MIN_TOP_INSET_PX,
  NUMBER_PAD_HEIGHT_PX,
  SAFE_MARGIN_PX,
  insetFloorPx,
  resolveNumberPadUse,
} from '../number-pad-metrics'

/** 실측값. 갤럭시 Z Flip3 와 iOS 시뮬레이터에서 인셋을 덤프해 쟀다. */
const 삼성_키보드 = 372
const iOS_글자판 = 335

describe('판을 쓸지 재서 정한다', () => {
  it('OS 키보드 위에 카드가 들어가면 OS 키보드를 쓴다', () => {
    // Z Flip3 메인 360×880dp. 키보드 위 477dp 가 남고 드롭 카드는 396dp 다.
    expect(
      resolveNumberPadUse({
        windowHeightPx: 880,
        topInsetPx: 31,
        keyboardHeightPx: 삼성_키보드,
        cardHeightPx: 396,
      }),
    ).toBe(false)
  })

  it('안 들어가면 자체 판을 쓴다', () => {
    // 이슈 #530 의 계측 조건. 360×640dp 에서 키보드 위에 268dp 만 남는다.
    expect(
      resolveNumberPadUse({
        windowHeightPx: 640,
        topInsetPx: 31,
        keyboardHeightPx: 삼성_키보드,
        cardHeightPx: 396,
      }),
    ).toBe(true)
  })

  it('같은 화면이라도 카드가 짧으면 OS 키보드가 선다', () => {
    // 판정이 그 카드의 잰 높이를 본다. 글자 카드(212dp)는 안 잘린다.
    const 화면 = { windowHeightPx: 700, topInsetPx: 31, keyboardHeightPx: 삼성_키보드 }
    expect(resolveNumberPadUse({ ...화면, cardHeightPx: 396 })).toBe(true)
    expect(resolveNumberPadUse({ ...화면, cardHeightPx: 212 })).toBe(false)
  })

  it('경계에서는 여유분만큼 자체 판 쪽으로 기운다', () => {
    // 남는 높이를 카드 + 간격에 딱 맞춰도 여유분이 모자라면 판을 쓴다.
    const 딱_맞는_창 = 396 + CARD_GAP_PX + MIN_TOP_INSET_PX + 삼성_키보드
    expect(
      resolveNumberPadUse({
        windowHeightPx: 딱_맞는_창,
        topInsetPx: MIN_TOP_INSET_PX,
        keyboardHeightPx: 삼성_키보드,
        cardHeightPx: 396,
      }),
    ).toBe(true)
    expect(
      resolveNumberPadUse({
        windowHeightPx: 딱_맞는_창 + SAFE_MARGIN_PX,
        topInsetPx: MIN_TOP_INSET_PX,
        keyboardHeightPx: 삼성_키보드,
        cardHeightPx: 396,
      }),
    ).toBe(false)
  })

  it('iOS 는 키보드가 짧아 같은 카드가 더 낮은 화면까지 OS 키보드를 쓴다', () => {
    // iPhone 17 Pro 402×874pt. 글자판 335pt 를 기본값으로 쓴다(둘 중 높은 쪽).
    expect(
      resolveNumberPadUse({
        windowHeightPx: 874,
        topInsetPx: 59,
        keyboardHeightPx: iOS_글자판,
        cardHeightPx: 396,
      }),
    ).toBe(false)
    // SE 3 세대 375×667pt.
    expect(
      resolveNumberPadUse({
        windowHeightPx: 667,
        topInsetPx: 20,
        keyboardHeightPx: iOS_글자판,
        cardHeightPx: 396,
      }),
    ).toBe(true)
  })

  it('가로는 판을 써도 안 들어간다. 판정은 그래도 판 쪽이다', () => {
    // 880×360dp. #532(세로 고정)가 덮는 갈래이고 여기서 막을 수 있는 것은 없다.
    expect(
      resolveNumberPadUse({
        windowHeightPx: 360,
        topInsetPx: 31,
        keyboardHeightPx: 삼성_키보드,
        cardHeightPx: 396,
      }),
    ).toBe(true)
  })

  it('카드 높이를 아직 못 쟀으면 판 쪽으로 기운다', () => {
    // 첫 프레임에는 `onLayout` 이 안 왔다. 모르면 안전한 쪽이다.
    expect(
      resolveNumberPadUse({
        windowHeightPx: 880,
        topInsetPx: 31,
        keyboardHeightPx: 삼성_키보드,
        cardHeightPx: null,
      }),
    ).toBe(true)
  })
})

describe('인셋은 바닥을 두고 읽는다', () => {
  it('기기가 낸 값이 바닥보다 크면 그대로 쓴다', () => {
    expect(insetFloorPx(59, MIN_TOP_INSET_PX)).toBe(59)
    expect(insetFloorPx(48, MIN_BOTTOM_INSET_PX)).toBe(48)
  })

  it('바닥보다 작으면 바닥을 쓴다', () => {
    expect(insetFloorPx(0, MIN_TOP_INSET_PX)).toBe(MIN_TOP_INSET_PX)
    expect(insetFloorPx(15, MIN_BOTTOM_INSET_PX)).toBe(MIN_BOTTOM_INSET_PX)
  })
})

describe('판의 치수', () => {
  it('두 줄 높이가 여백과 간격을 더한 값이다', () => {
    // 키 44 두 줄 + 줄 사이 4 + 위아래 여백 6.
    expect(NUMBER_PAD_HEIGHT_PX).toBe(104)
  })

  it('플랫폼마다 첫 실행 키보드 기본값이 있다', () => {
    expect(DEFAULT_KEYBOARD_PX.android).toBe(372)
    expect(DEFAULT_KEYBOARD_PX.ios).toBe(335)
  })
})
