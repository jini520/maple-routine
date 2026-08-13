import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '../../atoms/Button/Button'
import { hideSplashScreen } from '@core/native/splash-screen'

// 앱 전역 에러 바운더리([[ADR-065]] 결정 5). 렌더 중 예외가 나면 아무 문구 없는 흰 화면이
// 남던 것을 폴백 화면으로 바꾼다.
//
// **폴백은 최소로 둔다** — 아이콘 + 제목 + 짧은 설명 + '다시 시작' 하나뿐이다. 설정 열기(캐시
// 삭제로 가는 길)도 스택트레이스 노출도 브랜드 마크도 넣지 않는다. 이 화면의 목적은 복구 도구를
// 주는 게 아니라 **흰 화면을 없애는 것**이고, 리로드로 안 풀리는 크래시라면 앱 안에서 할 수 있는
// 게 없다(그때의 탈출구인 OS 설정의 앱 데이터 삭제·재설치는 앱 밖에 있다). 선택지를 하나로 줄이면
// 그 하나가 분명해진다.
//
// 크래시 리포팅(Sentry 등)은 도입하지 않았다 — opt-in 토글·전송 항목을 정해야 하므로
// (error-resilience.md 원칙 7) 바운더리만 먼저 넣는다.
//
// 에러 바운더리는 클래스 컴포넌트로만 만들 수 있다(훅 대체제가 없다).

interface ErrorBoundaryProps {
  children: ReactNode
  /** 테스트 주입용 — 기본은 window.location.reload */
  onRestart?: () => void
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
    // 리포팅은 미도입이라 개발 중 확인용으로만 남긴다 — 프로덕션에서도 콘솔은 사용자에게
    // 보이지 않으므로 무해하고, 실기기 원격 디버깅에서는 유일한 단서가 된다.
    console.error('[ErrorBoundary]', error, info.componentStack)

    // 폴백이 뜨는 것과 같은 커밋에서 스플래시를 내린다([[ADR-117]] 결정 6). 부팅 크래시에서는
    // 셋이 겹쳐 이 폴백이 **가장 필요한 순간에 무용지물**이 되기 때문이다:
    //   ⑴ 커버가 안 걷힌다 — `#boot-cover` 를 지우는 코드는 App.tsx 의 `useEffect` 안 타이머
    //      하나뿐인데, 첫 1초(MIN_SPLASH_MS) 안에 렌더가 던지면 바운더리가 그 트리를 언마운트해
    //      클린업이 타이머를 **취소한다.** 걷을 주체가 사라진다.
    //   ⑵ 폴백이 커버 **밑에** 그려진다 — 폴백은 `#root` 안이고, 커버는 index.html 에서 32비트
    //      정수 최댓값으로 쌓임 순서 맨 위에 고정돼 있다.
    //   ⑶ **버튼이 눌리지 않는다.** iOS `SplashScreen.show()` 가 건
    //      `isUserInteractionEnabled = false` 는 네이티브 `hide()` 에서만 풀린다. 이것이 이 호출의
    //      진짜 이유이자, 폴백의 쌓임 순서를 올리는 안이 기각된 이유다 — 보이게 만들어도 '다시
    //      시작' 은 여전히 안 눌린다(게다가 올릴 숫자가 없고 같은 매직 넘버가 두 곳에 생긴다).
    //      `hideSplashScreen()` 은 DOM 커버 제거와 네이티브 해제를 함께 하므로 한 번으로 셋을 끊고,
    //      커버가 사라지면 쌓임 순서를 손댈 이유 자체가 없어진다.
    // 실패는 삼킨다 — 이 순간 사용자에게 필요한 것은 화면이지 정확한 실패 처리가 아니다.
    hideSplashScreen().catch(() => {})
  }

  private handleRestart = (): void => {
    if (this.props.onRestart !== undefined) {
      this.props.onRestart()
      return
    }
    window.location.reload()
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div
        data-testid="error-boundary-fallback"
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center"
      >
        <AlertTriangle className="h-10 w-10 text-error-ink" strokeWidth={1.75} aria-hidden="true" />

        <div className="space-y-1">
          <p className="text-base font-semibold text-text">화면을 표시하지 못했습니다</p>
          <p className="mx-auto max-w-[260px] text-sm text-text-muted">
            앱을 다시 시작하면 대부분 해결됩니다.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={this.handleRestart}
          className="flex w-full max-w-[260px] items-center justify-center gap-2 text-sm"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          다시 시작
        </Button>
      </div>
    )
  }
}
