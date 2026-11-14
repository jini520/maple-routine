/**
 * 토스트 스택. 스토어의 목록을 아래에서부터 쌓아 그린다.
 */
import { View, useWindowDimensions } from 'react-native'

import { useToastStore } from '../../../features/toast/store'

import { useButtonNavigation } from '../../../hooks/useButtonNavigation'
import { resolveBottomBarMetrics } from '../../../lib/bottom-bar-metrics'
import { useBottomSafeAreaPx } from '../../../lib/safe-area'
import { Toast } from './Toast'

/** 탭바(또는 안전영역) 위로 띄우는 간격. 웹 `0.75rem`. */
const GAP = 12

export interface ToastStackProps {
  /** 하단 탭바가 떠 있는 화면인지. 기본 true. */
  hasTabBar?: boolean
}

export function ToastStack(props: ToastStackProps): React.JSX.Element | null {
  const hasTabBar = props.hasTabBar ?? true
  // **인셋이 아니라 하한이 깔린 값이다**. 토스트는 바 **위에** 쌓이므로 바와
  // 같은 자리에서 출발해야 한다. 여기만 인셋으로 두면 안드로이드 제스처 기기에서 바는 34 에
  // 뜨는데 토스트는 15 + 바 높이에 서서 캡슐 안으로 7px 들어간다.
  const bottomSafeAreaPx = useBottomSafeAreaPx()
  // 바 높이는 창 폭에 따라 바뀌고 3버튼 내비게이션 바 위에서는 더 뜬다. 바와 같은 함수를 봐야 토스트가 바에 겹치지 않는다.
  const { width: windowWidth } = useWindowDimensions()
  const buttonNavigation = useButtonNavigation()
  const barSpacePx = resolveBottomBarMetrics(windowWidth, buttonNavigation).spacePx
  const { toasts, dismiss } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <View
      testID="toast-stack"
      pointerEvents="box-none"
      className="absolute inset-x-0 gap-2 px-4"
      style={{ bottom: (hasTabBar ? barSpacePx : 0) + bottomSafeAreaPx + GAP }}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </View>
  )
}
