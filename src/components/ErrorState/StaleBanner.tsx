import { AlertTriangle } from 'lucide-react'

// 보여줄 항목이 있는 채로 실패했을 때 목록 위에 얹는 한 줄([[ADR-062]] 결정 4).
//
// 캐시 stub이 네트워크보다 먼저 방출되므로([[ADR-017]] 결정 6) 예열([[ADR-016]])이 끝난 정상
// 경로에서는 실패해도 목록이 그대로 남는다 — 이 배너가 없으면 실패의 대다수가 무음이 되고,
// 사용자는 낡은 목록을 최신으로 믿고 저장한다.
//
// 목록을 가리지 않아야 하므로 한 줄로 둔다. 배경 틴트는 Toast의 error 톤과 같은 color-mix라
// error-tint 토큰을 새로 만들 필요가 없다(4개 테마에 값을 추가하는 비용을 피한다).

export interface StaleBannerProps {
  message: string
  onRetry: () => void
}

export function StaleBanner(props: StaleBannerProps): React.JSX.Element {
  return (
    <div
      data-testid="stale-banner"
      role="alert"
      className="mb-3 flex items-center gap-2 rounded-[10px] bg-[color-mix(in_oklab,var(--color-error)_9%,var(--color-surface))] px-3 py-2.5"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-error" strokeWidth={2} aria-hidden="true" />
      <span className="min-w-0 flex-1 text-left text-xs text-text">{props.message}</span>
      <button
        type="button"
        onClick={props.onRetry}
        className="shrink-0 text-xs font-semibold text-primary-text hover:text-primary-hover"
      >
        다시 시도
      </button>
    </div>
  )
}
