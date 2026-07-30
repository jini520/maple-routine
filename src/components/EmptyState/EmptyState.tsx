import { MAPLE_LEAF_PATH } from '../mapleLeafPath'

// "비어있음"을 표시하는 곳이 공통으로 쓰는 컴포넌트(ADR-060). 원형 배지(컨텍스트 아이콘) +
// 제목 + 설명 + CTA 중앙 정렬이고, size 는 배지 크기·타이포·CTA 크기만 바꾼다.
//   page   — 캐릭터 미선택(화면 전체). 자체 박스 없이 화면이 감싼 중앙 영역을 채운다.
//   inline — 목록 자리에 들어가는 박스. 자체 카드 테두리를 가진다.
// "조회 불가"(확인 자체를 못 함)에는 이걸 쓰지 말 것 — UnavailableNotice 를 쓴다.

interface EmptyStateAction {
  label: string
  onClick: () => void
}

interface EmptyStateProps {
  /**
   * 목록 빈 상태는 무엇이 비었는지 알려주는 아이콘, 캐릭터 미선택(page)은 브랜드 마크 'leaf'.
   * 타입이 `LucideIcon` 이 아니라 "우리가 실제로 넘기는 두 prop"인 이유는 커스텀 아이콘도 받기
   * 위해서다([[ADR-066]] 결정 5) — `LucideIcon` 은 forwardRef 타입이라 평범한 함수 컴포넌트가
   * 대입되지 않는다. lucide 아이콘은 이 타입에 그대로 들어온다.
   */
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }> | 'leaf'
  title: string
  description?: string
  /** 문구가 지시하는 목적지가 앱 안에 있을 때만 준다 — 없으면 CTA를 만들지 않는다(ADR-060 결정 3). */
  action?: EmptyStateAction
  size?: 'page' | 'inline'
}

export function EmptyState(props: EmptyStateProps): React.JSX.Element {
  const { icon: Icon, title, description, action, size = 'inline' } = props
  const isPage = size === 'page'

  return (
    <div
      data-testid="empty-state"
      className={
        isPage
          ? 'flex flex-col items-center gap-4 text-center'
          : 'flex flex-col items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-8 text-center'
      }
    >
      <div
        data-testid="empty-state-badge"
        aria-hidden="true"
        className={`flex items-center justify-center rounded-full bg-primary-tint ${
          isPage ? 'h-[84px] w-[84px]' : 'h-14 w-14'
        }`}
      >
        {/* 마크 색은 primary 계열로 통일 — primary-ink 는 라이트 테마에선 더 또렷하지만 레테(다크)에서
            배지 배경에 묻힌다(그 테마만 primary-ink 가 primary 보다 어둡다). */}
        {Icon === 'leaf' ? (
          <svg
            data-testid="empty-state-leaf"
            width={isPage ? 42 : 28}
            height={isPage ? 43 : 29}
            viewBox="0 0 127 130"
            className="fill-primary-ink"
          >
            <path d={MAPLE_LEAF_PATH} />
          </svg>
        ) : (
          <Icon className={`text-primary-ink ${isPage ? 'h-10 w-10' : 'h-7 w-7'}`} strokeWidth={1.75} />
        )}
      </div>

      <div className="space-y-1">
        <p
          data-testid="empty-state-title"
          className={`font-semibold text-text ${isPage ? 'text-base' : 'text-sm'}`}
        >
          {title}
        </p>
        {description !== undefined && (
          <p
            data-testid="empty-state-description"
            className={
              isPage
                ? 'max-w-[220px] text-sm text-text-muted'
                : 'mx-auto max-w-[240px] text-xs text-text-muted'
            }
          >
            {description}
          </p>
        )}
      </div>

      {action !== undefined && (
        <button
          type="button"
          onClick={action.onClick}
          className={`rounded-full bg-primary font-semibold text-on-primary hover:bg-primary-hover ${
            isPage ? 'px-5 py-2.5 text-sm' : 'px-4 py-2 text-xs'
          }`}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
