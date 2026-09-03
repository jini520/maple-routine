import type { BackGesturePort } from '../ports'

import AppBackground from '../../../modules/app-background'

/**
 * `BackGesturePort` 의 RN 구현. 셋 중 하나만 구현이고 둘은 계속 던진다.
 *
 * `setEnabled` 와 `addListeners` 는 네이티브 스택이 소유한다. 가로챌지 말지도 진행률을 그리는
 * 것도 우리 일이 아니다. `moveToBackground` 만 여기 남는다.
 *
 * 그 하나가 남는 것은 내비게이션 라이브러리가 더 이상 pop 할 것이 없을 때 무엇을 할지를 정해
 * 주지 않기 때문이다. 그 자리의 기본값은 액티비티 종료다
 * (`ReactActivity.invokeDefaultOnBackPressed`).
 *
 * 둘을 no-op 으로 두지 않는다. 이 플랫폼에 그 개념이 없다 와 해야 하는데 아직 안 했다 는
 * 다르고, 여기 둘은 셋째다. 이제 다른 것이 소유한다. 조용히 통과시키면 누군가
 * `setBackGestureEnabled(true)` 를 불러 놓고 뒤로가기가 자기 통제 아래 있다고 믿는다. 던지면
 * 첫 호출에서 드러난다.
 */

const OWNED_BY_NATIVE_STACK =
  'react-navigation 네이티브 스택이 시스템 뒤로가기를 소유합니다. 스택에 쌓인 화면이 가로챌지 말지를 정하고, 진행률도 OS 가 그립니다. 이 자리에서 할 일이 없습니다.'

async function throwOwnedByNativeStack(method: string): Promise<never> {
  throw new Error(`BackGesturePort.${method}() 는 RN 에서 쓰지 않습니다. ${OWNED_BY_NATIVE_STACK}`)
}

export const rnBackGesturePort: BackGesturePort = {
  setEnabled: () => throwOwnedByNativeStack('setEnabled'),

  addListeners: () => throwOwnedByNativeStack('addListeners'),

  /**
   * iOS 에서는 네이티브 모듈이 없어 `AppBackground` 가 `null` 이고, 그때는 아무것도 하지 않는다.
   * 그 플랫폼에는 시스템 뒤로가기도 없고 프로그램으로 앱을 백그라운드로 보내는 것도 금지다.
   */
  async moveToBackground(): Promise<void> {
    await AppBackground?.moveToBackground()
  },
}
