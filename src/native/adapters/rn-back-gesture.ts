import type { BackGesturePort } from '../ports'

import AppBackground from '../../../modules/app-background'

/**
 * `BackGesturePort` 의 RN 구현 — **셋 중 하나만 구현이고 둘은 계속 던진다.**
 *
 * 계획서는 이 포트를 통째로 *"삭제 — 네이티브 스택 기본"* 으로 적어 두었다
 * (`docs/migration/parity-inventory.md` §5). 절반은 맞았다:
 *
 * | 메서드 | 웹뷰에서 하던 일 | RN |
 * |---|---|---|
 * | `setEnabled` | 스택이 열려 있는 동안에만 시스템 뒤로가기를 가로챈다 | **네이티브 스택이 소유**. 가로챌지 말지는 스택에 쌓인 화면이 정한다 |
 * | `addListeners` | `onBackProgressed`(API 34+) 진행률을 받아 우리가 그린다 | **네이티브 스택이 소유**. 그리는 주체가 우리가 아니다 |
 * | `moveToBackground` | `moveTaskToBack(true)` | **여기 남는다**. 아래 |
 *
 * ## 왜 `moveToBackground` 만 남는가
 *
 *  은 *"탭 최상위의 뒤로가기는 묻지 않고 백그라운드 전환"* 이다. 내비게이션
 * 라이브러리는 **더 이상 pop 할 것이 없을 때 무엇을 할지**를 정해 주지 않고, 그 자리의 기본값은
 * 결정 18 이 명시적으로 거부한 종료다. RN 자신의 주석이 그렇게 적어 두었다
 * (`ReactActivity.invokeDefaultOnBackPressed`: *"the fallback logic (**finish activity**)"*).
 * 그래서 이 한 메서드는 프레임워크가 대신해 주지 않는다.
 *
 * ## 둘을 no-op 으로 두지 않는 이유
 *
 * `not-implemented.ts` 가 세운 기준 그대로다. *"이 플랫폼에 그 개념이 없다"* 와 *"해야 하는데 아직
 * 안 했다"* 는 다르고, 여기 둘은 **셋째**다: *"이제 다른 것이 소유한다."* 조용히 통과시키면 나중에
 * 누군가 `setBackGestureEnabled(true)` 를 불러 놓고 뒤로가기가 자기 통제 아래 있다고 믿는다.
 * 실제로는 네이티브 스택이 이미 처리하고 있어 **그 호출은 아무 일도 하지 않는다**. 조용한 no-op 은
 * 그 오해를 끝까지 숨긴다. 던지면 첫 호출에서 드러난다.
 *
 * (부르는 쪽이 지금은 없다. `use-system-back.ts` 는 `app-capacitor` 에 남고 RN 으로 옮기지 않는다.)
 */

const OWNED_BY_NATIVE_STACK =
  'react-navigation 네이티브 스택이 시스템 뒤로가기를 소유합니다 — 스택에 쌓인 화면이 가로챌지 말지를 정하고, 진행률도 OS 가 그립니다. 이 자리에서 할 일이 없습니다.'

async function throwOwnedByNativeStack(method: string): Promise<never> {
  throw new Error(`BackGesturePort.${method}() 는 RN 에서 쓰지 않습니다 — ${OWNED_BY_NATIVE_STACK}`)
}

export const rnBackGesturePort: BackGesturePort = {
  setEnabled: () => throwOwnedByNativeStack('setEnabled'),

  addListeners: () => throwOwnedByNativeStack('addListeners'),

  /**
   * iOS 에서는 네이티브 모듈이 없어 `AppBackground` 가 `null` 이고, 그때는 아무것도 하지 않는다 —
   * 그 플랫폼에는 시스템 뒤로가기도 없고 프로그램으로 앱을 백그라운드로 보내는 것도 금지다.
   */
  async moveToBackground(): Promise<void> {
    await AppBackground?.moveToBackground()
  },
}
