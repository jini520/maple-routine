import { useEffect } from 'react'
import { BackHandler } from 'react-native'
import { moveAppToBackground } from '../native/back-gesture'

/**
 * 스택이 비었을 때의 뒤로가기. 묻지 않고 백그라운드로.
 *
 * 하위 페이지가 열려 있으면 react-navigation 이 뒤로가기를 받아 pop 한다. 남는 자리는 더 pop
 * 할 것이 없을 때뿐이고, 그때의 기본값이 액티비티 종료다
 * (`ReactActivity.invokeDefaultOnBackPressed`). 끝내면 다음 실행이 콜드 스타트라 스플래시부터
 * 다시 본다.
 *
 * 순서에 기대지 않는다. `BackHandler` 는 나중에 등록된 리스너부터 부르고 `true` 를 돌려준 첫
 * 리스너에서 멈추는데, 누가 먼저 등록될지는 마운트 순서에 달렸다. 이 구현은 어느 쪽이든 같은
 * 결과를 낸다.
 *
 * | 먼저 불리는 쪽 | 하위 페이지가 열려 있을 때 | 탭 최상위일 때 |
 * |---|---|---|
 * | 우리 | `canGoBack()` 참 → `false` → 다음(react-navigation)이 pop | `true` → 백그라운드 |
 * | react-navigation | pop 하고 `true` → 우리는 안 불림 | `false` → 우리 차례 → 백그라운드 |
 *
 * 판정을 `canGoBack()` 하나로 둔 것이 그 성질을 만든다. 스택 깊이를 따로 세면 그 값과 실제
 * 내비게이션 상태가 어긋나 뒤로가기가 두 단계 가거나 아무 일도 안 하게 된다.
 *
 * 모달은 아직 여기 없다. 지금 두면 존재하지 않는 상태를 물어야 한다.
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
      // 아직 컨테이너가 준비되지 않았으면 우리가 판정할 근거가 없다. 가로채지 않는다. 이 구간은
      // 첫 프레임 전이라 사용자가 뒤로를 누를 수 있는 시간이 사실상 없다.
      if (!navigation.isReady()) return false
      if (navigation.canGoBack()) return false

      // 판정이 하나다. 층이 진짜 스택이라 하위 층까지 `canGoBack()` 에 잡히므로, 여기까지
      // 왔다는 것은 정말로 pop 할 것이 없다는 뜻이다.
      void moveAppToBackground()
      return true
    })

    return () => {
      subscription.remove()
    }
  }, [navigation])
}
