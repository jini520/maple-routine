/**
 * `shadow*` → `boxShadow` 번역기. 그림자를 값으로 쓰는 자리가 다 여기를 거친다.
 *
 * `shadowOpacity`·`shadowRadius`·`shadowOffset` 은 iOS 전용 프롭이라 그것으로 맞춘 층은
 * 안드로이드에 하나도 도달하지 않는다. `boxShadow` 는 RN 0.76+ 가 양 플랫폼에 같은 그림자를
 * 그리는 자리다(안드로이드는 새 아키텍처 전용. 이 앱은 `newArchEnabled=true`).
 *
 * 옮기면서 두 값이 번역된다. 그대로 옮기면 다른 그림자가 된다.
 *
 * - 블러는 두 배다. `boxShadow` 의 반경은 CSS 정의이고 RN 의 iOS 구현이 그것을
 *   `shadowRadius = blurRadius / 2` 로 되돌린다.
 * - 알파는 미리 곱한다. iOS 는 `shadowColor` 의 알파와 `shadowOpacity` 를 곱하는데 `boxShadow`
 *   는 색의 알파를 그대로 쓴다.
 *
 * **베끼면 안 된다.** 둘 다 에러 없이 틀린다. 블러를 두 배 안 하면 절반 크기 그림자가, 알파를
 * 미리 안 곱하면 세 배 진한 그림자가 조용히 나온다. 사본이 둘이면 한쪽만 고쳐도 화면에서는
 * 원이 바보다 조금 진하다 로만 보인다.
 */

/** 그림자 한 겹. 불투명도 · 반경 · 아래로 민 거리. */
export interface ShadowLayer {
  readonly opacity: number
  readonly radius: number
  readonly y: number
}

/**
 * 테마 `shadowColor` 와 한 겹을 `boxShadow` 문자열로 낸다.
 *
 * `opacity` 라는 이름이 남은 것은 그 값이 테마 색의 알파(`59` = 0.35)와 **곱해지는** 자리이기
 * 때문이다. 0.65 는 과한 값이 아니라 실효 0.23 이다.
 *
 * @param shadowColor 테마의 8자리 hex(`#RRGGBBAA`). 알파가 없으면 불투명으로 본다
 * @param layer 옮길 한 겹
 * @example boxShadowOf(definition.shadowColor, FAB_SHADOW)
 */
export function boxShadowOf(shadowColor: string, { opacity, radius, y }: ShadowLayer): string {
  const base = shadowColor.slice(0, 7)
  const themeAlpha = Number.parseInt(shadowColor.slice(7, 9) || 'ff', 16) / 255
  const alpha = Math.round(themeAlpha * opacity * 255)
    .toString(16)
    .padStart(2, '0')

  return `0px ${y}px ${radius * 2}px ${base}${alpha}`
}
