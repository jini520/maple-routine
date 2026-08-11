import { Clock, Info } from 'lucide-react'

// "지금 볼 수 없다"를 알리는 고지. 빈 상태(EmptyState)와 디자인을 공유하지 않는다(ADR-060 결정 5):
// 같은 모양이면 "데이터가 없다"로 오해된다. 실패(ErrorState)와도 다르다 — 사용자가 고칠 수 있는
// 실패가 아니라 API의 알려진 제약이라 액션을 두지 않는다.
//
// **두 변형(variant)을 가진다**([[ADR-068]] 결정 1). 성질이 다른 두 상태가 같은 얼굴이면 안 된다:
//   outOfRange   조회 가능 구간 밖 — **영구**. 정보 톤(info-tint) + Info
//   notCollected 아직 집계 전(OPENAPI00009) — **시간이 지나면 스스로 풀린다**. 중립 톤(surface-2) + Clock
//
// notCollected가 셋째 얼굴을 갖는 이유: 고칠 수 없는 제약이므로 ErrorState가 아니고, 그렇다고
// "영구히 확인할 수 없다"고 말하면 거짓말이 된다(매주 목요일 새벽에만 나오는 상태다).
// 새 컴포넌트를 만들지 않고 이 컴포넌트의 변형으로 흡수한다.

/** 기간 조회 하한은 실측 13일이지만 넥슨 한도 자체는 14일이라 **문구는 14일**이다([[ADR-068]] 결정 1). */
const COPY = {
  outOfRange: {
    icon: Info,
    title: '이 기간은 조회할 수 없습니다',
    description: '조회 가능한 기간(최근 14일)을 지나 확인할 수 없습니다 — 처치 기록이 없다는 뜻은 아닙니다',
    box: 'border border-border bg-info-tint',
    iconColor: 'text-info-ink',
  },
  // 집계 시각을 말하지 않는다 — 우리가 모르고(KST 새벽 01:52~03:44 브래킷만 실측), 넥슨이 배치를
  // 옮기면 틀린 안내가 된다([[ADR-067]] 트레이드오프).
  notCollected: {
    icon: Clock,
    title: '아직 집계되지 않았습니다',
    description: '이 기간 기록이 준비되면 자동으로 채워집니다',
    box: 'border border-border bg-surface-2',
    iconColor: 'text-text-muted',
  },
} as const

export type UnavailableNoticeVariant = keyof typeof COPY

interface UnavailableNoticeProps {
  /** 기본값은 `outOfRange` — 기존 호출부(롤링 윈도우 밖)의 의미를 그대로 유지한다. */
  variant?: UnavailableNoticeVariant
  /** 캐릭터 카드 안처럼 이미 카드에 중첩될 때 — 한 단계 축소하고 설명을 생략한다. */
  compact?: boolean
}

export function UnavailableNotice(props: UnavailableNoticeProps): React.JSX.Element {
  const copy = COPY[props.variant ?? 'outOfRange']
  const Icon = copy.icon

  if (props.compact === true) {
    return (
      <div data-testid="unavailable-notice" className="mx-4 my-3 rounded-[10px] bg-surface-2 px-3 py-2.5">
        <p className="flex items-center gap-2 text-xs text-text-muted">
          <Icon className="h-4 w-4 flex-none" strokeWidth={1.75} aria-hidden="true" />
          {copy.title}
        </p>
      </div>
    )
  }

  return (
    <div data-testid="unavailable-notice" className={`flex items-start gap-3 rounded-[14px] p-4 ${copy.box}`}>
      <Icon className={`h-5 w-5 flex-none ${copy.iconColor}`} strokeWidth={1.75} aria-hidden="true" />
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-text">{copy.title}</p>
        <p data-testid="unavailable-notice-description" className="text-xs text-text-muted">
          {copy.description}
        </p>
      </div>
    </div>
  )
}
