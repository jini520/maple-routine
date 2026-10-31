/**
 * 아이템 가격 버튼의 태그가 흔들리는 값. 판정과 그리기를 가른다.
 *
 * 함수가 `'worklet'` 인 것은 `useAnimatedStyle` 안에서 불리기 때문이다. 지시어가 없으면
 * 리애니메이티드가 매 프레임 JS 스레드를 깨운다.
 */

/** 흔들림 한 바퀴. 진행률은 0 에서 1 까지 이 시간 동안 선형으로 간다. */
export const TAG_SWING_LOOP_MS = 6000

/** 태그의 축. 아이콘의 구멍(24 격자의 7.5, 7.5) 자리다. */
export const TAG_SWING_PIVOT = '31% 31%'

/** 진행률의 꺾이는 자리. 첫 자리 앞은 멈춰 있는 시간이다. */
const STOP_AT = [0.7, 0.76, 0.83, 0.9, 0.96, 1]

/** 그 자리의 각도(도). 처음과 끝이 0 이어야 반복할 때 안 튄다. */
const STOP_DEGREES = [0, -16, 11, -6, 2, 0]

/**
 * 진행률에서 태그의 각도를 내는 값.
 *
 * @param progress 0 에서 1 까지 도는 진행률
 * @returns 회전 각도(도)
 */
export function tagSwingDegrees(progress: number): number {
  'worklet'
  if (progress <= STOP_AT[0]) return 0

  for (let index = 1; index < STOP_AT.length; index += 1) {
    if (progress > STOP_AT[index]) continue

    const from = STOP_AT[index - 1]
    const moved = (progress - from) / (STOP_AT[index] - from)
    // 양 끝에서 천천히 움직이게 한다. 선형이면 꺾이는 자리에서 태그가 벽에 부딪힌 것처럼 보인다.
    const eased = moved * moved * (3 - 2 * moved)
    return STOP_DEGREES[index - 1] + (STOP_DEGREES[index] - STOP_DEGREES[index - 1]) * eased
  }

  return 0
}
