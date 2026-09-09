/**
 * 스크림이 **얼마나 짙은가**. 시트 뒤를 덮는 그 한 겹이 쓴다.
 *
 * 규칙은 한 줄이다. **시트가 내려갈 때만 옅어진다.**
 *
 * 라이브러리의 `animatedIndex` 는 시트의 자리를 스냅 포인트에 견줘 낸 값이라, 내용이 커져 스냅
 * 포인트가 먼저 갱신되는 프레임에는 옛 자리가 새 스냅 포인트보다 아래로 읽혀 **한 프레임만
 * 음수로 떨어진다**. 그 한 장에 배경이 통째로 밝아졌다 돌아온다(사용자 보고 `1프레임
 * 깜빡거림`). 시트가 실제로 내려간 프레임이 아니면 그 값을 안 받는 것으로 거른다.
 *
 * 시트가 작아질 때는 안 걸린다. 그때는 옛 자리가 새 스냅 포인트보다 **위**라 인덱스가 0 으로
 * 잘린다.
 *
 * @param index 라이브러리가 준 값. 열림이 0, 닫힘이 -1
 * @param position 시트 윗변의 자리. 클수록 아래다
 * @param shown 지금 그리고 있는 불투명도
 * @param lastPosition 직전 프레임의 `position`
 */
export function nextScrimOpacity(
  index: number,
  position: number,
  shown: number,
  lastPosition: number,
): number {
  'worklet'
  const target = Math.min(Math.max(index + 1, 0), 1)
  if (target >= shown) return target
  return position > lastPosition ? target : shown
}
