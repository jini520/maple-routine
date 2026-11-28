/**
 * 하단바가 다시 보일 때(위 화면 · 백그라운드에서 돌아올 때) 렌즈 항목 줄을 다시 뜨게 하려고 `LayerStack` 과 바가 나눠 쓰는 자리.
 *
 * 바는 `LayerStack` 의 `layout` 안에 그려져 루트 내비게이션의 focus 이벤트를 직접 받지 못한다.
 */
export const pageCapture: {
  /** 바가 채운다. 바가 있는 화면이 다시 보일 때 부른다. */
  onFocus: (() => void) | null
} = { onFocus: null }
