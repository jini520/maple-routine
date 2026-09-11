import { getHapticsPort } from './ports'

/**
 * 눌러서 어딘가로 갔다. 하단바의 탭 이동과 `←`, 페이지 뒤로(`BackButton`), 기간 이동이 부른다.
 *
 * @see selectionFeedback 고른 값이 바뀐 자리(세그먼트)는 그쪽이다.
 */
export function tapFeedback(): void {
  fireAndForget((port) => port.tap())
}

/**
 * 고른 값이 바뀌었다. 부르는 것은 전부 부품이다. 세그먼트 셋(`Segment` · `TabSegment` ·
 * `DifficultySegment`)과 `Switch` · `CalendarGrid` · `CharacterRail` · `CharacterLayerGrid`.
 *
 * 이동과 다른 촉각이다. 두 플랫폼 모두 선택이 바뀌는 자리에 쓰라고 둔 것을 따로 갖고 있다.
 */
export function selectionFeedback(): void {
  fireAndForget((port) => port.select())
}

/**
 * 기다리지 않고 삼킨다. 진동 장치가 없거나 사용자가 시스템 촉각 피드백을 꺼 두면 플러그인이
 * 거절하는데, 그 거절이 흘러나가면 누름 하나가 처리되지 않은 거부로 남는다. 누름이 하려던 일은
 * 그것과 무관하게 계속돼야 한다.
 *
 * 포트가 안 꽂힌 것은 그대로 던진다. 그것은 배선 사고이지 이 기기에 그 기능이 없다가 아니다.
 */
function fireAndForget(call: (port: ReturnType<typeof getHapticsPort>) => Promise<void>): void {
  void call(getHapticsPort()).catch(() => undefined)
}
