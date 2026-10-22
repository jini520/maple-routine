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
