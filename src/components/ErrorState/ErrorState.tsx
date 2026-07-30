import { AlertTriangle } from 'lucide-react'

// 실패를 표시하는 곳이 공통으로 쓰는 컴포넌트([[ADR-062]]). 아이콘 + 제목 + 설명 + 액션 중앙 정렬.
//
// 세 상태(조회 중 / 확정된 빈 상태 / 확인 불가·실패)는 항상 구분 가능해야 하므로([[ADR-060]]·
// [[ADR-061]], error-resilience.md 원칙 2) EmptyState와 디자인을 공유하지 않는다:
//   EmptyState        원형 배지 안 아이콘 · 브랜드색 · 액션은 목적지가 앱 안에 있을 때만
//   UnavailableNotice 단독 Info · 정보 톤(info-tint) · 액션 없음(고칠 수 없는 제약)
//   ErrorState        단독 AlertTriangle · 경고색 · 액션 항상
//
// **아이콘을 배지로 감싸지 않는다** — design-system.md "아이콘" 절의 *배경 없이 단독* 규칙을 그대로
// 따라 예외를 늘리지 않는다(빈 상태 배지가 그 예외다). 그 결과 배지 유무만으로 빈 상태와 즉시 갈려,
// 규칙 준수와 상태 구분이 같은 선택으로 해결된다.
//
// 자체 카드와 크기 변형을 두지 않는다 — 적용처가 모두 이미 껍데기 안이고(피커=모달 카드,
// 온보딩=페이지) 같은 크기를 쓴다. LoadingState를 이 두 자리에 씌우지 않는 것과 같은 판단([[ADR-061]]).
// 카드가 필요하거나 크기가 갈리는 자리가 생기면 그때 추가한다.

interface ErrorStateAction {
  label: string
  onClick: () => void
}

export interface ErrorStateProps {
  title: string
  description?: string
  /** 그 원인을 실제로 푸는 행동만 준다 — 401에 "다시 시도"를 주지 말 것([[ADR-062]] 결정 3). */
  action?: ErrorStateAction
}

export function ErrorState(props: ErrorStateProps): React.JSX.Element {
  return (
    <div
      data-testid="error-state"
      role="alert"
      className="flex min-h-[120px] flex-1 flex-col items-center justify-center gap-3 px-4 text-center"
    >
      <AlertTriangle className="h-7 w-7 text-error" strokeWidth={1.75} aria-hidden="true" />

      <div className="space-y-1">
        <p data-testid="error-state-title" className="text-sm font-semibold text-text">
          {props.title}
        </p>
        {props.description !== undefined && (
          <p data-testid="error-state-description" className="mx-auto max-w-[240px] text-xs text-text-muted">
            {props.description}
          </p>
        )}
      </div>

      {props.action !== undefined && (
        // 재시도는 파괴적 동작이 아니라 진행 동작이라 primary다(삭제 버튼의 border-error text-error 와 구분).
        <button
          type="button"
          onClick={props.action.onClick}
          className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-bg hover:bg-primary-hover"
        >
          {props.action.label}
        </button>
      )}
    </div>
  )
}
