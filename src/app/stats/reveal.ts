/**
 * 통계 그래프가 화면에 들어오는 순간의 판정과 그때 오르는 진행값.
 */
import { useEffect } from 'react'
import { Easing, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'

/** 섹션 윗변이 화면 아래 끝보다 이만큼 올라와야 보인 것으로 친다 */
const REVEAL_MARGIN = 80
const REVEAL_DURATION = 700

/**
 * 이번 스크롤로 새로 보인 섹션. 이미 보인 것은 다시 내지 않는다.
 *
 * @param positions 섹션 id → 스크롤 내용 안의 윗변 y
 */
export function sectionsToReveal(
  positions: ReadonlyMap<string, number>,
  scrollY: number,
  viewportHeight: number,
  revealed: ReadonlySet<string>,
): string[] {
  const bottom = scrollY + viewportHeight - REVEAL_MARGIN
  return [...positions].filter(([id, top]) => !revealed.has(id) && top < bottom).map(([id]) => id)
}

/**
 * 보이면 0 에서 1 로 오르는 진행값. 모션 줄이기면 곧바로 1 이다.
 *
 * @param replayKey 바뀌면 0 으로 돌아가 다시 오른다. 기간이나 조각이 바뀌어 값이 달라질 때 그래프를 다시 그린다
 */
export function useRevealProgress(revealed: boolean, replayKey = ''): SharedValue<number> {
  const reduceMotion = useReducedMotion()
  const progress = useSharedValue(revealed && reduceMotion ? 1 : 0)
  useEffect(() => {
    if (!revealed) return
    if (reduceMotion) {
      progress.value = 1
      return
    }
    progress.value = 0
    progress.value = withTiming(1, { duration: REVEAL_DURATION, easing: Easing.out(Easing.cubic) })
  }, [progress, revealed, reduceMotion, replayKey])
  return progress
}
