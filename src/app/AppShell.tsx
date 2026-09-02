import { useEffect } from 'react'

import { useDropEffectStore } from '../features/drop-effect/store'
import { useOnboardingStore } from '../features/onboarding/store'
import { useLiveUpdateStore } from '../features/live-update/store'
import { useThemeStore } from '../features/theme/store'
import { useTrackingModeStore } from '../features/tracking-mode/store'
import { hideSplashScreen } from '../native/splash-screen'

import { ToastStack } from '../components/organisms/Toast/ToastStack'
import { AppNavigation } from '../navigation/AppNavigation'
import { ThemeBackdrop } from '../components/templates/ThemeBackdrop/ThemeBackdrop'
import { ApiKeyNoticeModal } from './ApiKeyNoticeModal'
import { prehydrateTabStores } from './prehydrate'
import { useKeyboardVisible } from './use-keyboard-visible'

// 네이티브 스플래시가 순식간에 지나가 깜빡이지 않도록, 번들 평가 시점부터 최소 이 시간만큼은 유지한다.
const APP_START_MS = Date.now()
const MIN_SPLASH_MS = 1000

/**
 * 앱 셸. 웹 `AppShell`(573줄)의 짝. 화면이 아니라 **부팅 순서**가 이 파일의 실질이다.
 *
 * 웹이 하던 일을 넷으로 가른 전수 대조표(그대로 / 바뀜 / 사라짐 / 안 이어짐)는
 * `docs/migration/README.md` 4-0단계 결과 에 있다. 여기에는 **이 파일에 남은 것과 그 순서**만
 * 적는다.
 *
 * ## 순서
 *
 * 1. **포트 주입**. 이 파일 밖이다(`index.ts` → `boot.ts`, 1단계). 아래 어느 것보다 먼저다.
 * 2. **스플래시 붙들기**. 이것도 이 파일 밖이다(`index.ts` → `boot-splash.ts`). 전역 스코프여야
 *    한다(`expo-splash-screen` 이 명시).
 * 3. **저장소 복원 넷**(온보딩·테마·트래킹 모드·드롭 연출). 서로 독립이라 순서가 없다. 각자
 *    자기 이펙트를 갖는 것도 웹과 같다(하나가 던져도 나머지가 돈다).
 * 4. **광고 SDK 초기화**. 실패해도 던지지 않아 부팅을 막지 않는다.
 * 5. **탭 스토어 선하이드레이션**. 온보딩이 완료된 뒤에만.
 * 6. **스플래시 내리기**. 최소 표시 시간을 채운 뒤.
 *
 * ## 7. **OTA 부팅 확인**. 이 되살린 자리
 *
 * 예전에 이 자리는 *"이 파일이 부르지 않는 것"* 이었다: 포트가 던지고, 그 이전에 core 의
 * live-update 스토어를 **import 하는 것만으로** 죽었다(`import.meta.env`). 벽 둘이 다 사라져
 *  웹 `main.tsx` 가 하던 `checkOnBoot()` 를 그대로 부른다.
 *
 * **가장 마지막이고, 던져도 부팅을 막지 않는다**(`void`). 확인은 곁가지라 실패해도 앱은 떠야
 * 하고, 스플래시를 내리는
 * 6번보다 뒤라 네트워크가 느린 사용자를 흰 화면에 붙들지 않는다.
 *
 * `notifyLiveUpdateReady()` 는 **부르지 않는다.** 가 이 자리를 고른 이유
 * (*"렌더가 던지는 번들이 SUCCESS 로 찍혀 영구히 박히면 안 된다"*)는 여전히 유효하지만,
 * `expo-updates` 에는 그 신호를 받는 JS API 가 없고 네이티브가 직접 관찰해 되돌린다
 * (`rn-live-update.ts` 의 `notifyAppReady` 주석. 전수 확인). 즉 **자동 롤백은 있고, 그것을
 * 선언하는 주체가 우리 코드에서 런타임으로 옮겨 갔다.**
 *
 * ## `ErrorBoundary` 는 이 파일이 아니라 `App.tsx` 가 두른다
 *
 * 웹과 같은 이유다. 셸이 렌더 중에 던지면 그 자신은 커밋되지 않아야 하고, 그러려면 경계가
 * **바깥**이어야 한다. 다만 RN 에서는 그 바깥이 프로바이더보다 **안**이다(그쪽 근거는 `App.tsx`).
 */
export function AppShell(): React.JSX.Element {
  const status = useOnboardingStore((state) => state.status)
  const restoreOnboarding = useOnboardingStore((state) => state.restoreFromStorage)
  const restoreTheme = useThemeStore((state) => state.restoreFromStorage)
  const restoreTrackingMode = useTrackingModeStore((state) => state.restoreFromStorage)
  const restoreDropEffect = useDropEffectStore((state) => state.restoreFromStorage)
  const isKeyboardVisible = useKeyboardVisible()

  const isCompleted = status === 'completed'

  // 넷을 한 이펙트에 모으지 않는 것은 웹과 같다. 스토어마다 독립이고, 합치면 앞의 하나가
  // 던졌을 때 뒤가 통째로 안 돈다. deps 를 비운 것은 "마운트당 한 번"이 계약이라서다
  // (세터는 zustand 가 참조를 고정하지만, 그 사실에 기대지 않는다).
  useEffect(() => {
    void restoreOnboarding()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void restoreTheme()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void restoreTrackingMode()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void restoreDropEffect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 여기서 의 `startAds()`(SDK 초기화 + 첫 광고 사전 로드)를 불렀다. 이
  // 전면광고를 걷으며 지웠다. 표시만 막고 사전 로드를 남기면 매 실행 **뜨지 않을 광고** 를 요청해
  // 임프레션 없는 요청으로 쌓인다. **인라인 광고를 붙일 때 SDK 초기화를 부를 자리가 여기다**
  // (`rnAdsPort.initialize()` 는 어댑터에 그대로 있다).

  // : 탭 스토어를 스플래시가 떠 있는 동안 미리 하이드레이션해, 첫 탭 진입이
  // 저장소 읽기를 사용자가 보는 앞에서 치르지 않게 한다. **온보딩 완료 상태에서만 돈다**.
  // `syncSchedules` 는 API 키·계정이 없으면 던지므로, 온보딩 중에 돌리면 스토어가 error 로
  // 시작하고 토스트까지 울린다.
  //
  // **동적 import 를 그대로 뒀고**, 그 한 줄은 `./prehydrate` 안에 있다. 왜 그대로 두는지와 왜
  // 셸 밖으로 뺐는지는 그 파일에 적혀 있다(요약: 시점을 안 바꾸려고 유지, 셸 안에 두면 jest 에서
  // 마운트가 죽어 아래 게이트를 붙들 수 없다).
  useEffect(() => {
    if (!isCompleted) return
    void prehydrateTabStores()
  }, [isCompleted])

  // 앱 셸이 처음 렌더된 뒤 네이티브 스플래시를 내린다. 실행부터 이 시점까지 스플래시가 계속 떠
  // 있어 빈 화면 없이 스플래시만 보인다(`index.ts` 의 `preventAutoHideAsync`). 콘텐츠가 즉시
  // 준비되면 순식간에 사라지므로, 최소 표시 시간을 보장해 스플래시가 충분히 보이게 한다.
  //
  // 클린업이 타이머를 지우는 것도 웹과 같다. 웹에서는 커버를 걷는 호출이 그것 하나뿐이라 **클린업이
  // 그 하나를 취소한다**는 것이 의 고리 중 하나였는데, RN 에는 그 자리를 메우는 것이 둘 있다.
  // `ErrorBoundary` 가 폴백과 같은 커밋에서 내리고(결정 6), 그래도 안 되면 `index.ts` 의 실패
  // 안전 타이머가 트리 **밖**에서 내린다(결정 3).
  useEffect(() => {
    const remaining = MIN_SPLASH_MS - (Date.now() - APP_START_MS)
    const timer = setTimeout(() => {
      void hideSplashScreen()
    }, Math.max(0, remaining))

    return () => {
      clearTimeout(timer)
    }
  }, [])

  // 7. OTA 부팅 확인. 체크만 한다. 웹 `main.tsx` 가 하던 그 호출이고,
  //  이 벽 둘을 없애며 이 자리로 돌아왔다(파일 머리 7번).
  //
  // `void` 인 것이 요점이다. 확인은 곁가지라 실패해도 앱은 떠야 한다. 스토어가 실패를
  // `check-error` 로 삼켜 던지지 않지만(그쪽 `check()`), 여기서 await 하지 않는 것으로 **부팅이
  // 네트워크를 기다리지 않는다** 를 구조로 못박는다.
  useEffect(() => {
    void useLiveUpdateStore.getState().checkOnBoot()
  }, [])

  return (
    <>
      {/* 테마 벽지. **첫 자식이어야 한다.** RN 은 형제 순서가 곧 그리는 순서라, 이 자리가 웹의
          `z-index: -1`(앱 루트 첫 자식)을 대신한다. 배경을 선언하지 않은
          테마에서는 아무것도 그리지 않는다. */}
      <ThemeBackdrop />
      <AppNavigation />
      {/*: 저장된 키가 무효화되거나 호출 한도를 넘기면
          원래 화면 위에 닫을 수 없는 안내 모달이 덮이고, "확인"을 눌러야 키 입력 화면으로
          이동한다. 내비게이터 **밖**이라 어느 화면에서 감지되든 뜬다(웹에서 라우트 밖이던 자리). */}
      <ApiKeyNoticeModal />
      {/* 토스트는 자기가 놓인 자리에 절대 배치로 그린다. 여기가 `ThemeProvider` 의 화면 채움
          View 직속이라 탭바 위에 뜬다(`ToastStack.tsx` 파일 머리 ①이 셸에 넘긴 결정). */}
      <ToastStack hasTabBar={isCompleted && !isKeyboardVisible} />
    </>
  )
}
