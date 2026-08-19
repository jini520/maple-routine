// 앱 전역 에러 바운더리([[ADR-065]] 결정 5). 렌더 중 예외가 나면 아무 문구 없는 빈 화면이 남던
// 것을 폴백 화면으로 바꾼다.
//
// **폴백은 최소로 둔다** — 아이콘 + 제목 + 짧은 설명 + '다시 시작' 하나뿐이다. 설정 열기(캐시
// 삭제로 가는 길)도 스택트레이스 노출도 브랜드 마크도 넣지 않는다. 이 화면의 목적은 복구 도구를
// 주는 게 아니라 **빈 화면을 없애는 것**이고, 재시작으로 안 풀리는 크래시라면 앱 안에서 할 수 있는
// 게 없다(그때의 탈출구인 OS 설정의 앱 데이터 삭제·재설치는 앱 밖에 있다). 선택지를 하나로 줄이면
// 그 하나가 분명해진다.
//
// 크래시 리포팅(Sentry 등)은 도입하지 않았다 — opt-in 토글·전송 항목을 정해야 하므로
// (error-resilience.md 원칙 7) 바운더리만 먼저 넣는다.
//
// 에러 바운더리는 클래스 컴포넌트로만 만들 수 있다(훅 대체제가 없다).
//
// ── [[ADR-117]] 결정 6 — **셋 중 하나만 RN 에 대응된다** ──────────────────────────────
//
// 웹판은 `componentDidCatch` 에서 `hideSplashScreen()` 을 부른다. 그 호출 하나가 웹뷰의 사슬 셋을
// 끊었는데, RN 에서는 사슬 자체의 구성이 다르다.
//
//   ⑴ *"커버가 안 걷힌다"* — **대응 없음.** `#boot-cover` 는 `index.html` 의 DOM 요소이고 그것을
//      지우는 타이머가 `App.tsx` 의 `useEffect` 클린업에 취소되던 문제였다. RN 에는 문서도 DOM
//      커버도 없다.
//   ⑵ *"폴백이 커버 밑에 그려진다"* — **대응된다.** 네이티브 스플래시(`expo-splash-screen`)는 JS
//      트리 위에 뜨는 네이티브 뷰라, 부팅 중 렌더가 던지면 폴백이 그 아래 가려진다. 그래서
//      마운트 시 스플래시를 내리는 것이 여기서도 필요하다.
//   ⑶ *"버튼이 눌리지 않는다"* — **대응 없음.** iOS Capacitor `SplashScreen.show()` 가 걸던
//      `isUserInteractionEnabled = false` 는 그 플러그인의 동작이다. `expo-splash-screen` 은 터치를
//      막지 않는다.
//
// 그래서 호출은 남기되 **이유가 ⑵ 하나로 줄어든다.** z-index 를 올리지 않는다는 결정도 그대로다 —
// 애초에 그 숫자가 RN 에 없다.
//
// ── '다시 시작' 이 필수 프롭이 됐다 ────────────────────────────────────────────────
//
// 웹은 기본값이 `window.location.reload()` 였다. 없는 기본값을 지어내면(예: 상태만 초기화해 다시
// 렌더) 같은 예외로 즉시 되돌아오는 버튼이 되어 [[ADR-065]] 결정 5 가 세운 *"그 하나가
// 분명해진다"* 를 깬다. 그래서 이 컴포넌트는 재시작 수단을 **호출부에서 받는다.**
//
// > **정정(4단계 step 0)**: 이 자리에 원래 *"RN 에는 그 짝이 없다 — 번들 재실행은 OTA 런타임의
// > 일이고 [[ADR-128]] 결정 7 이 미뤄 뒀다"* 고 적혀 있었으나 **사실이 아니다.** `expo` 가
// > 내보내는 `reloadAppAsync()`(expo-modules-core)가 release·debug 양쪽에서 **지금 도는 것과 같은
// > 번들을** 다시 실행한다 — 새 업데이트를 집는 `Updates.reloadAsync()` 와 갈리는 지점이 정확히
// > 그것이라 OTA 와 무관하다. 셸이 그것을 넘긴다(`App.tsx`). 프롭으로 받는 구조는 그대로 둔다 —
// > 이 컴포넌트가 재시작 수단을 아는 것과 폴백을 그리는 것은 다른 관심사다.
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { View } from 'react-native'

import { hideSplashScreen } from '@core/native/splash-screen'

import { AlertTriangleIcon, RotateCcwIcon } from '../../../lib/icons'
import { Button } from '../../atoms/Button/Button'
import { Text } from '../../atoms/Text/Text'

interface ErrorBoundaryProps {
  children: ReactNode
  /** 앱을 다시 실행한다. 기본값을 두지 않는 이유는 파일 머리 참고. */
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
    // 리포팅은 미도입이라 개발 중 확인용으로만 남긴다 — 프로덕션에서도 콘솔은 사용자에게 보이지
    // 않으므로 무해하고, 실기기 원격 디버깅에서는 유일한 단서가 된다.
    console.error('[ErrorBoundary]', error, info.componentStack)

    // 폴백이 뜨는 것과 같은 커밋에서 스플래시를 내린다([[ADR-117]] 결정 6, 위 ⑵).
    // 실패는 삼킨다 — 이 순간 사용자에게 필요한 것은 화면이지 정확한 실패 처리가 아니다.
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
