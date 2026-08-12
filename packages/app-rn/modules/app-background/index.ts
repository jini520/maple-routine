import { requireOptionalNativeModule } from 'expo'

/**
 * 앱을 **종료하지 않고 백그라운드로** 보낸다 — [[ADR-120]] 결정 18 의 `moveTaskToBack(true)`.
 *
 * ## 왜 아직도 네이티브 코드가 필요한가
 *
 * 이 전환의 계획서는 `BackGesturePort` 를 *"삭제 — 네이티브 스택 기본"* 으로 적어 두었고
 * (`docs/migration/parity-inventory.md` §5), 세 메서드 중 둘은 실제로 그렇다(진행률·활성화는
 * react-navigation 이 OS 수준에서 한다). **`moveToBackground()` 하나만 남는다** — 탭 최상위에서
 * 뒤로가기를 받았을 때 무엇을 할지는 내비게이션 라이브러리가 정해 주지 않는다.
 *
 * 그리고 그 자리의 기본값은 결정 18 이 거부한 것이다. RN 자신의 주석이 그렇게 적어 두었다
 * (`ReactActivity.invokeDefaultOnBackPressed` — *"Disabling callback so the fallback logic
 * (**finish activity**) can run"*). 액티비티를 끝내면 다음 실행이 콜드 스타트라 스플래시부터 다시
 * 본다 — *"사용자가 뒤로 한 번 눌렀다"* 로 치르기엔 비싼 대가다.
 *
 * ## iOS 에는 이 개념이 없다
 *
 * 그래서 `platforms` 가 `android` 하나이고, 여기서 `requireNativeModule` 이 아니라
 * **`requireOptionalNativeModule`** 을 쓴다 — iOS 에서는 `null` 이 오고 어댑터가 조용히 아무것도
 * 하지 않는다(`rn-back-gesture.ts`). 애초에 iOS 에는 시스템 뒤로가기 자체가 없어 부를 일도 없고,
 * 프로그램으로 앱을 백그라운드로 보내는 것은 Apple 이 금지한다. `not-implemented.ts` 의 기준으로
 * 말하면 *"이 플랫폼에 그 개념이 없다"* 쪽이라 **정당한 no-op** 이다.
 */
export interface AppBackgroundNativeModule {
  moveToBackground(): Promise<void>
}

export default requireOptionalNativeModule<AppBackgroundNativeModule>('AppBackground')
