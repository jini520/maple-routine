import type { TextSize } from '../types/text-size'

/** 설정에 늘어서는 차례. 작은 것부터다. */
export const TEXT_SIZES: readonly TextSize[] = ['small', 'default', 'large', 'xlarge']

/** 단계마다 모든 글자의 크기와 줄 높이에 곱하는 배수. */
export const TEXT_SIZE_SCALE: Record<TextSize, number> = {
  small: 0.9,
  default: 1,
  large: 1.1,
  xlarge: 1.2,
}

export const TEXT_SIZE_LABELS: Record<TextSize, string> = {
  small: '작게',
  default: '기본',
  large: '크게',
  xlarge: '아주 크게',
}

export function isTextSize(value: string): value is TextSize {
  return (TEXT_SIZES as readonly string[]).includes(value)
}

/** 폭 64(`w-16`)로 고정된 수입 · 지출 금액의 배수 상한. 이 배수까지 `−12,345억` 이 한 줄에 든다 */
export const AMOUNT_COLUMN_MAX_SCALE = 1.05

/** 글자 배수의 상한을 정하는 폭. 화면 폭을 배수로 나눈 값이 이보다 작아지면 한 줄 라벨이 넘친다 */
export const TEXT_REFERENCE_WIDTH = 360

/**
 * 화면 폭으로 상한을 건 글자 배수. 좁은 화면에서 큰 단계를 골라도 배치가 깨지지 않게 하는 값.
 *
 * @param scale 설정에서 고른 단계의 배수
 * @param windowWidth 앱이 쓰는 화면 폭(dp · pt). 0 이면 아직 모르는 것이라 자르지 않는다
 */
export function capTextScale(scale: number, windowWidth: number): number {
  if (windowWidth <= 0) return scale
  return Math.min(scale, windowWidth / TEXT_REFERENCE_WIDTH)
}
