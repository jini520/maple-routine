/**
 * atoms 층이 밖으로 내보이는 얼굴. 쓰는 쪽은 한 줄로 가져간다.
 *
 * **atom 끼리는 이 배럴을 거치지 않는다.** 곁 파일을 직접 가져온다([[ADR-199]] 정정 2). 배럴을
 * 거치면 순환이 생긴다(`index` → `Button` → `index`).
 *
 * **컴포넌트만 올린다.** 곁 파일의 값(`Text/font-scaling` 의 `FONT_SCALE_MAX` 같은 것)은 원래
 * 경로로 가져간다. `Icon` 배럴이 `icon-base` 를 빼는 것과 같은 규칙이다([[ADR-199]] 결정 1).
 */
export { AnimatedNumber } from './AnimatedNumber/AnimatedNumber'
export { Badge, type BadgeVariant } from './Badge/Badge'
export { Button } from './Button/Button'
export { Card } from './Card/Card'
export * from './Icon'
export { ProgressBar } from './ProgressBar/ProgressBar'
export { MapleSpinner, MapleSweepSpinner } from './Spinner'
export { Text } from './Text/Text'
export { TextInput, type TextInputProps } from './TextInput/TextInput'
