import { useSyncExternalStore } from 'react'

import { addButtonNavigationListener, isButtonNavigation } from '../native/system-bars'

/**
 * 아래에 3버튼 내비게이션 바가 있는가. 하단바를 더 띄울지 정하는 값.
 *
 * 값을 상태로 복사하지 않고 그릴 때마다 네이티브에서 읽는다. 복사하면 첫 그림이 기본값으로 나가 3버튼 기기에서
 * 앱을 열 때마다 바가 한 번 튀고, 구독이 붙기 전에 온 바뀜은 사라진다.
 */
export function useButtonNavigation(): boolean {
  return useSyncExternalStore(addButtonNavigationListener, isButtonNavigation)
}
