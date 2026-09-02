/**
 * 스피너 둘이 공유하는 프롭([[ADR-199]] 정정 2). 반복 모션 훅은 `hooks/useLoopedValue` 로 나갔다
 * ([[ADR-199]] 정정 4).
 */

/** 색은 `className` 이 정하고 크기는 폭만 준다. 높이는 잎 격자가 낸다. */
export interface SpinnerProps {
  size?: number
  className?: string
}
