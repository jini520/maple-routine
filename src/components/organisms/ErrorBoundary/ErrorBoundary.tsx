/**
 * 앱 전역 에러 바운더리. 렌더 중 예외가 나면 빈 화면 대신 폴백을 그리는 클래스 컴포넌트
 * (훅으로는 못 만든다).
 *
 * **폴백은 최소로 둔다.** 아이콘 · 제목 · 짧은 설명 · `다시 시작` 하나뿐이다. 재시작으로 안 풀리는
 * 크래시라면 앱 안에서 할 수 있는 것이 없어서, 선택지를 하나로 줄이면 그 하나가 분명해진다.
 *
 * 지키는 것 둘.
 *
 * ① 마운트하면 스플래시를 내린다. 네이티브 스플래시가 JS 트리 위에 뜨는 뷰라 부팅 중 렌더가
 *    던지면 폴백이 그 아래 가린다.
 * ② 재시작 수단을 **호출부에서 받는다**(`App.tsx` 가 `reloadAppAsync` 를 넘긴다). 기본값을
 *    지어내면 같은 예외로 즉시 되돌아오는 버튼이 된다.
 *
 * @see docs/foundation/error-resilience.md 크래시 리포팅은 아직 없다
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { View } from 'react-native'

import { hideSplashScreen } from '../../../native/splash-screen'

import { AlertTriangleIcon, Button, RotateCcwIcon, Text } from '../../atoms'

interface ErrorBoundaryProps {
  children: ReactNode
  /** 앱을 다시 실행하는 콜백. 기본값을 두지 않는 이유는 파일 머리 참고. */
  onRestart: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 리포팅은 미도입이라 개발 중 확인용으로만 남긴다. 프로덕션에서도 콘솔은 사용자에게 보이지
    // 않으므로 무해하고, 실기기 원격 디버깅에서는 단서가 이것뿐이다.
    console.error('[ErrorBoundary]', error, info.componentStack)

    // 폴백이 뜨는 것과 같은 커밋에서 스플래시를 내린다(위 ⑵).
    // 실패는 삼킨다. 이 순간 사용자에게 필요한 것은 화면이지 정확한 실패 처리가 아니다.
    hideSplashScreen().catch(() => {})
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <View
        testID="error-boundary-fallback"
        role="alert"
        className="flex-1 items-center justify-center gap-4 bg-bg px-6"
      >
        <AlertTriangleIcon className="h-10 w-10 text-error-ink" strokeWidth={1.75} aria-hidden />

        <View className="gap-1">
          <Text className="text-center text-base font-semibold text-text">
            화면을 표시하지 못했습니다
          </Text>
          <Text className="max-w-[260px] text-center text-sm text-text-muted">
            앱을 다시 시작하면 대부분 해결됩니다.
          </Text>
        </View>

        <Button
          variant="primary"
          onPress={this.props.onRestart}
          className="w-full max-w-[260px] flex-row items-center justify-center gap-2"
          textClassName="text-sm"
        >
          <RotateCcwIcon className="h-4 w-4 text-on-primary" strokeWidth={2} aria-hidden />
          다시 시작
        </Button>
      </View>
    )
  }
}
