// 시스템 글자 크기(OS 배수)를 `[1.0, 1.235]` 로 자르는 **산수 한 조각**([[ADR-152]]).
//
// 값을 여기 두는 이유는 프롭을 붙이는 자리(`Text.tsx`)와 그 값을 검사하는 자리(테스트)가 **같은
// 상수**를 봐야 하기 때문이고, 컴포넌트 파일에서 함수를 더 내보내면 `react-refresh` 규칙에 걸리기
// 때문이다.

/**
 * 하한. 설계 기준(1.0) 아래로는 안 내려간다.
 *
 * **이 값이 1 이라는 사실이 아래 구현을 가능하게 한다.** RN 에는 하한 프롭이 없고
 * `allowFontScaling={false}` 가 배수를 정확히 1.0 으로 만들 뿐이라, 1 이 아닌 하한(예 0.95)을
 * 고르는 순간 이 길이 막히고 기준 크기에 보정을 곱해 두는 훨씬 비싼 구조가 필요해진다
 * ([[ADR-152]] 결정 3). 이 값을 옮기려면 그 결정을 먼저 열 것.
 */
export const FONT_SCALE_MIN = 1

/**
 * 상한. iOS 배수표의 **XXL 칸**이다(임의의 숫자가 아니다, [[ADR-152]] 결정 1).
 *
 * 다음 칸 1.353(XXXL)은 행 높이가 76 으로 고정된 today 격자에서 위험하다([[ADR-147]] 결정 1).
 */
export const FONT_SCALE_MAX = 1.235

/**
 * 클램프를 앱이 쥐므로 배수 프롭 둘은 호출부에서 사라지고, 대신 `fixed` 가 생긴다.
 * `Text` 와 `TextInput` 의 공개 타입이 같은 모양이어야 해서 여기 둔다.
 */
export type Clamped<P> = Omit<P, 'allowFontScaling' | 'maxFontSizeMultiplier'> & {
  /** 상자가 글자를 못 따라가는 자리. 시스템 글자 크기를 아예 안 따른다([[ADR-152]] 결정 5). */
  fixed?: boolean
}

export interface FontScalingProps {
  allowFontScaling: boolean
  maxFontSizeMultiplier: number
}

/**
 * OS 가 준 배수에 맞춰 `Text`/`TextInput` 에 달 프롭 둘을 낸다.
 *
 * 상한은 프롭이 그대로 받아 주지만(`maxFontSizeMultiplier`), **하한은 프롭이 없어서 끄는 것으로
 * 만든다.** 끄면 배수가 1.0 이 되고 그것이 곧 하한이다.
 *
 * @param fontScale OS 배수(`useWindowDimensions().fontScale`)
 * @param fixed 칸에 묶여 글자를 못 키우는 자리인가([[ADR-152]] 결정 5)
 */
export function fontScalingProps(fontScale: number, fixed: boolean): FontScalingProps {
  return {
    allowFontScaling: !fixed && fontScale >= FONT_SCALE_MIN,
    maxFontSizeMultiplier: FONT_SCALE_MAX,
  }
}
