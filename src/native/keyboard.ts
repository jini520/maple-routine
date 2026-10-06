import { getKeyboardPort } from './ports'

// 키보드 표시 여부를 구독한다. 키보드가 뜨면 WebView가 그만큼 줄어드는데, 그러면 화면 하단에 고정된
// 탭바가 키보드 바로 위에 얹혀 어색하다 → 그동안 숨기려고 쓴다.
// 반환값은 구독 해제 함수.
export async function addKeyboardVisibilityListener(
  onChange: (visible: boolean) => void,
): Promise<() => void> {
  return getKeyboardPort().addVisibilityListener(onChange)
}

/** 키보드가 뜰 때마다 그 높이를 받는다. 입력 카드가 숫자 판을 쓸지 정하는 재료다. 해제 함수를 돌려준다. */
export async function addKeyboardHeightListener(onHeight: (heightPx: number) => void): Promise<() => void> {
  return getKeyboardPort().addHeightListener(onHeight)
}
