/**
 * 숫자 칸을 OS 키보드로 받을지 앱이 그린 판으로 받을지 정하는 산수, 그리고 그 판의 치수.
 *
 * 기기 목록도 화면 이름도 안 쓴다. **재서 정한다.** 삼성 키보드가 화면의 42% 를 먹어(372dp ÷
 * 880dp, 실측) 짧은 화면에서는 카드가 키보드 위로 안 들어가고, 그때만 판으로 간다. 기준값을
 * 손으로 고르면 다음 기기에서 틀린다.
 *
 * 값이 파일로 나와 있는 것은 판정하는 쪽(`InputCard`)과 그리는 쪽(`NumberPad`)이 같은 수를
 * 봐야 하기 때문이다. 한쪽에 옮겨 적으면 갈리고, 갈려도 화면에서는 조금 안 맞는다 로만 보인다.
 */
import { Platform } from 'react-native'

import type { ShadowLayer } from './shadow'

/** 키 하나의 높이. 권장 터치 타깃과 같다. */
export const NUMBER_PAD_KEY_PX = 44

/** 키 사이. */
export const NUMBER_PAD_GAP_PX = 4

/** 판 가장자리와 키 사이. */
export const NUMBER_PAD_PADDING_PX = 6

/**
 * 판 전체 높이. 6열 **두 줄**이다.
 *
 * 4행 3열(전화기 관습)을 안 쓴다. 키 44 를 지키면 200 이 넘어, 짧은 화면에서 판을 띄우는 뜻이
 * 없어진다. 옆으로 넓고 위아래로 짧은 쪽이 같은 키 크기에 절반 높이다.
 */
export const NUMBER_PAD_HEIGHT_PX =
  NUMBER_PAD_PADDING_PX * 2 + NUMBER_PAD_KEY_PX * 2 + NUMBER_PAD_GAP_PX

/**
 * 판이 카드 위에 떠 있다는 것을 내는 그림자 한 겹.
 *
 * 판은 카드와 **같은 계열의 바탕**이라(둘 다 카드 안쪽 재질) 테두리만으로는 경계가 안 선다.
 * 덮고 있다는 것이 안 읽히면 가려진 줄이 사라진 것처럼 보인다.
 *
 * FAB 보다 반경이 크고 민 거리가 작다. 원은 화면 위에 뜬 물건이라 방향이 있고, 판은 바로 아래
 * 내용을 덮는 판이라 **사방으로 퍼지는 쪽**이 덮개로 읽힌다.
 */
export const NUMBER_PAD_SHADOW: ShadowLayer = { opacity: 0.8, radius: 16, y: 3 }

/**
 * 다크에서 판의 경계를 내는 헤어라인. 어두운 바탕에서는 그림자가 거의 안 보인다.
 *
 * FAB 와 달리 흰색이 아니다. 판은 색을 진 물건이 아니라 중립 표면이라, 흰 테두리를 두르면
 * 떠 있는 것이 아니라 빛나는 것으로 읽힌다.
 */
export const NUMBER_PAD_DARK_EDGE = 'rgba(255,255,255,0.14)'

/** 카드와 키보드 사이. `InputCard` 판의 `mb-3` 과 같아야 한다. */
export const CARD_GAP_PX = 12

/**
 * 판정이 요구하는 추가 여유. **모르면 판 쪽으로 기울이는 값이다.**
 *
 * 잘못 판정하는 두 방향의 값이 다르다. 판을 띄울 필요가 없는데 띄우면 익은 키보드를 한 번 못
 * 쓰고 끝이지만, 반대로 틀리면 **값 칸이 화면 밖으로 나가 친 숫자가 안 보인다**(#530). 뒤쪽이
 * 훨씬 비싸므로 경계에서 앞쪽으로 기운다.
 */
export const SAFE_MARGIN_PX = 16

/**
 * 상단 인셋의 바닥.
 *
 * 기기가 인셋을 0 으로 내는 순간(전체화면 · 일부 에뮬레이터)에도 상태바 몫을 떼어 두려는 값이다.
 * **실제 값보다 크게 잡지 않는다** - 안드로이드 노치 기기가 31dp 를 내는데 여기에 64 를 박으면
 * 멀쩡한 폰이 판으로 넘어간다.
 */
export const MIN_TOP_INSET_PX = 24

/**
 * 하단 인셋의 바닥. 3버튼 내비의 높이다.
 *
 * **판정에는 안 들어간다.** OS 키보드가 하단 인셋을 덮으므로 거기서 빼면 두 번 빼는 셈이다.
 * 자체 판이 떠 있을 때 카드가 설 자리를 잡는 데 쓴다. 제스처 내비는 15dp 이고 3버튼은 48dp 라
 * (Z Flip3 실측 · 안드로이드 기본값) 두꺼운 쪽을 바닥으로 둔다.
 */
export const MIN_BOTTOM_INSET_PX = 48

/**
 * 저장값이 없는 첫 실행에 쓰는 키보드 높이. 둘 다 실측이다.
 *
 * 안드로이드는 숫자판과 글자판이 **같은 372dp** 다(Z Flip3 에서 IME 인셋을 읽어 확인). iOS 는
 * 숫자 308pt · 한글 글자판 335pt 로 갈리는데, **높은 쪽**을 둔다. 모르면 판 쪽으로 기우는
 * 규칙이 여기에도 걸린다.
 */
export const DEFAULT_KEYBOARD_PX = { android: 372, ios: 335 } as const

/** 이 플랫폼의 첫 실행 기본값. */
export function defaultKeyboardPx(): number {
  return Platform.OS === 'ios' ? DEFAULT_KEYBOARD_PX.ios : DEFAULT_KEYBOARD_PX.android
}

/** 기기가 낸 인셋과 바닥 중 큰 쪽. */
export function insetFloorPx(rawPx: number, floorPx: number): number {
  return Math.max(rawPx, floorPx)
}

export interface NumberPadUseInput {
  windowHeightPx: number
  topInsetPx: number
  /** 이 기기에서 마지막으로 잰 OS 키보드 높이. 없으면 `defaultKeyboardPx()`. */
  keyboardHeightPx: number
  /**
   * 잰 카드 높이. **`null` 은 아직 `onLayout` 이 안 온 것**이고 판 쪽으로 판정한다.
   *
   * 상수가 아니라 잰 값인 이유는 둘이다. 카드 높이가 글자 배수([[ADR-152]] 의 1.235 까지)와
   * 줄바꿈으로 갈려 미리 못 적고, 테스트 환경에는 레이아웃이 없어 상수를 지킬 수단이 없다.
   */
  cardHeightPx: number | null
}

/**
 * 자체 판을 쓸 것인가.
 *
 * ```
 * 창 높이 − 상단 인셋 − 키보드 높이  <  카드 높이 + 간격 + 여유
 * ```
 *
 * 하단 인셋이 없는 것은 키보드가 그 자리를 덮기 때문이다(`MIN_BOTTOM_INSET_PX` 주석).
 */
export function resolveNumberPadUse(input: NumberPadUseInput): boolean {
  if (input.cardHeightPx === null) return true

  const 남는_높이 =
    input.windowHeightPx - insetFloorPx(input.topInsetPx, MIN_TOP_INSET_PX) - input.keyboardHeightPx

  return 남는_높이 < input.cardHeightPx + CARD_GAP_PX + SAFE_MARGIN_PX
}
