/**
 * 당김 인디케이터를 안전영역 페이드 밖으로 내보내는 양. 플랫폼마다 다른 값을 내는 계산.
 *
 * 깎이는 것은 둘 다 같다. 마스크가 뷰 트리로 걸리고 `refreshControl` 이 어느 쪽이든 그 덩어리째
 * `MaskedView` 안에 든다. **다른 것은 원이 어디서 시작하는가다.**
 *
 * | | 오프셋 0일 때 원이 서는 자리 | 구간을 벗어나려면 |
 * |---|---|---|
 * | iOS | 당긴 틈의 가운데. 화면 맨 위 | 구간 높이 전부 |
 * | 안드로이드 | 24dp 내려온 자리 | 구간 높이 − 24 |
 *
 * 안드로이드의 24 는 우리가 고른 값이 아니라 플랫폼 상수의 차다. `setProgressViewOffset` 이 정지
 * 위치를 `offset + 64 − 40` 으로 잡아 원의 윗변이 `offset + 24` 에 선다. iOS 값을 그대로 주면
 * 원이 필요보다 24dp 낮은 자리에서 돈다.
 *
 * 플랫폼을 인자로 받는 것은 값의 갈림을 렌더 없이 보기 위해서다.
 */

/**
 * 안드로이드 원이 오프셋 0에서 **이미 내려와 있는** 세로. `DEFAULT_CIRCLE_TARGET(64) − 지름(40)`.
 *
 * **플랫폼에서 읽어 온 값이지 튜닝 값이 아니다.** 둘 중 하나가 바뀌면(원 크기를 `large` 로 주면
 * 지름이 56이 된다) 이 값도 함께 바뀐다. 지금은 `size` 를 안 주므로 기본 40이다.
 */
export const ANDROID_CIRCLE_REST_TOP_PX = 24

export function resolvePullIndicatorOffset(options: {
  /** `resolveSafeAreaFade().topPx`. 0이면 상단을 안 깎는 화면이다. */
  fadeTopPx: number
  /** `Platform.OS`. */
  platform: string
}): number {
  if (options.fadeTopPx === 0) return 0

  // 음수로 내려가면 RN 이 원을 **위로** 올려 도로 가려지므로 0에서 멈춘다.
  return options.platform === 'android'
    ? Math.max(0, options.fadeTopPx - ANDROID_CIRCLE_REST_TOP_PX)
    : options.fadeTopPx
}
