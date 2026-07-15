import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

// 키보드 표시 여부를 구독한다. 키보드가 뜨면 두 플랫폼 모두 WebView가 그만큼 줄어드는데(안드로이드는
// Capacitor가 컨테이너에 패딩, iOS는 이 플러그인의 resize:native가 WebView 프레임 축소), 그러면 화면
// 하단에 고정된 탭바가 키보드 바로 위에 얹혀 어색하다 → 그동안 숨기려고 쓴다.
// 반환값은 구독 해제 함수. 웹엔 키보드 개념이 없어 건너뛴다.
export async function addKeyboardVisibilityListener(
  onChange: (visible: boolean) => void,
): Promise<() => void> {
  if (Capacitor.getPlatform() === 'web') return () => {}

  const show = await Keyboard.addListener('keyboardWillShow', () => {
    onChange(true)
  })
  const hide = await Keyboard.addListener('keyboardWillHide', () => {
    onChange(false)
  })

  return () => {
    void show.remove()
    void hide.remove()
  }
}
