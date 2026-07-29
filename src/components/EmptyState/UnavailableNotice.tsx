import { Info } from 'lucide-react'

// "조회 불가" — 롤링 조회 윈도우를 벗어나 확인 자체를 못 한 상태(ADR-032). 빈 상태(EmptyState)와
// 디자인을 공유하지 않는다(ADR-060 결정 5): 같은 모양이면 "데이터가 없다"로 오해된다.
// 톤은 경고(error)가 아니라 정보 — 사용자가 고칠 수 있는 실패가 아니라 API의 알려진 제약이다.

const TITLE = '이 기간은 조회할 수 없어요'
const DESCRIPTION = '조회 가능한 기간(최근 13일)을 지나 확인할 수 없습니다 — 처치 기록이 없다는 뜻은 아닙니다'

interface UnavailableNoticeProps {
  /** 캐릭터 카드 안처럼 이미 카드에 중첩될 때 — 한 단계 축소하고 설명을 생략한다. */
  compact?: boolean
}

export function UnavailableNotice(props: UnavailableNoticeProps): React.JSX.Element {
  if (props.compact === true) {
    return (
      <div data-testid="unavailable-notice" className="mx-4 my-3 rounded-[10px] bg-surface-2 px-3 py-2.5">
        <p className="flex items-center gap-2 text-xs text-text-muted">
          <Info className="h-4 w-4 flex-none" strokeWidth={1.75} aria-hidden="true" />
          {TITLE}
        </p>
      </div>
    )
  }

  return (
    <div
      data-testid="unavailable-notice"
      className="flex items-start gap-3 rounded-[14px] border border-border bg-info-tint p-4"
    >
      <Info className="h-5 w-5 flex-none text-text-muted" strokeWidth={1.75} aria-hidden="true" />
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-text">{TITLE}</p>
        <p data-testid="unavailable-notice-description" className="text-xs text-text-muted">
          {DESCRIPTION}
        </p>
      </div>
    </div>
  )
}
