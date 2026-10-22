/**
 * 앱 글자 배수를 글자 스타일에 곱하는 **산수 한 조각**.
 *
 * `Text` 와 `TextInput` 이 같은 계산을 써야 해서 여기 둔다. 컴포넌트 파일에서 함수를 더 내보내면
 * `react-refresh` 규칙에 걸린다.
 */
import type { TextStyle } from 'react-native'

/**
 * 크기와 줄 높이에 배수를 곱한 스타일. 이 element 에 직접 적힌 값만 곱한다.
 *
 * 적히지 않은 값은 바깥 `Text` 에서 이미 곱한 값을 물려받으므로, 여기서 채우면 두 번 곱해진다.
 *
 * @param style `StyleSheet.flatten` 을 거친 스타일
 * @param scale 설정 단계의 배수(`useTextScale()`)
 */
export function scaleTextStyle(style: TextStyle | undefined, scale: number): TextStyle {
  const scaled: TextStyle = { ...style }
  if (typeof scaled.fontSize === 'number') scaled.fontSize *= scale
  if (typeof scaled.lineHeight === 'number') scaled.lineHeight *= scale
  return scaled
}
