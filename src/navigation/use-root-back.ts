import { useEffect } from 'react'
import { BackHandler } from 'react-native'
import { moveAppToBackground } from '../native/back-gesture'

/**
 * 스택이 비었을 때의 뒤로가기 — **묻지 않고 백그라운드로**([[ADR-120]] 결정 18).
 *
 * ## 이것만 프레임워크가 안 해 준다
 *
 * 하위 페이지가 열려 있으면 react-navigation 이 뒤로가기를 받아 pop 한다(결정 9 «진짜 pop» 이
 * 손으로 만들던 것). 남는 자리는 **더 pop 할 것이 없을 때**뿐이고, 그때의 기본값이 정확히 결정 18 이
 * 거부한 종료다 — RN 자신의 주석이 그렇게 적어 두었다(`ReactActivity.invokeDefaultOnBackPressed`:
 * *"the fallback logic (**finish activity**)"*). 끝내면 다음 실행이 콜드 스타트라 스플래시부터
 * 다시 본다.
 *
 * ## 순서에 기대지 않는다
 *
 * `BackHandler` 는 나중에 등록된 리스너부터 부르고 **`true` 를 돌려준 첫 리스너에서 멈춘다.** 우리
 * 리스너와 react-navigation 의 리스너 중 누가 먼저 등록될지는 마운트 순서에 달렸는데, 이 구현은
 * 어느 쪽이든 같은 결과를 낸다:
 *
 * | 먼저 불리는 쪽 | 하위 페이지가 열려 있을 때 | 탭 최상위일 때 |
 * |---|---|---|
 * | 우리 | `canGoBack()` 참 → `false` → 다음(react-navigation)이 pop | `true` → 백그라운드 |
 * | react-navigation | pop 하고 `true` → 우리는 안 불림 | `false` → 우리 차례 → 백그라운드 |
 *
 * 판정을 `canGoBack()` **하나**로 둔 것이 그 성질을 만든다. "스택 깊이 > 0" 을 우리가 따로 세면
 * 그 값과 실제 내비게이션 상태가 어긋날 수 있고, 어긋난 프레임에서 뒤로가기가 두 단계 가거나
 * (웹뷰 시절 [[ADR-120]] 결정 6-b 가 `touchcancel` 에서 겪은 실패) 아무 일도 안 하게 된다.
 *
 * ## 모달은 아직 여기 없다
 *
 * 결정 18 은 *"모달이 떠 있는데 뒤로가 또 오면 닫는다"* 도 함께 정했다. 모달은 `components/organisms`
 * 이라 그 컴포넌트를 옮길 때 붙는다 — 지금 여기에 두면 존재하지 않는 상태를 물어야 한다.
 *
 * iOS 에서는 `hardwareBackPress` 가 오지 않으므로 이 훅은 아무 일도 하지 않는다.
 */
export interface RootBackNavigation {
  isReady(): boolean
  canGoBack(): boolean
}

export function useRootBackToBackground(navigation: RootBackNavigation): void {
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      // 아직 컨테이너가 준비되지 않았으면 우리가 판정할 근거가 없다 — 가로채지 않는다. 이 구간은
      // 첫 프레임 전이라 사용자가 뒤로를 누를 수 있는 시간이 사실상 없다.
      if (!navigation.isReady()) return false
      if (navigation.canGoBack()) return false

      // **판정이 다시 하나다**([[ADR-167]] 결정 7). [[ADR-132]] 결정 10 은 하단바의 «층» 기록이
      // react-navigation 이 모르는 우리 것이라 `canGoBack()` 에 안 잡힌다는 이유로 여기에 단을
      // 하나 더 뒀었다. 층이 진짜 스택이 된 지금은 그 판정에 **하위 층까지 포함해** 잡히므로,
      // 여기까지 왔다는 것은 정말로 pop 할 것이 없다는 뜻이다.
      void moveAppToBackground()
      return true
    })

    return () => {
      subscription.remove()
    }
  }, [navigation])
}
