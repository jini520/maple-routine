import { Minus, Plus, Users } from 'lucide-react'

// 파티원 수 스테퍼 — 보스 관리 페이지 행과 파티 인원 모달이 공유한다(ADR-121 결정 7).
//
// 크기 두 벌만 있고 레시피(보더 pill + Users + −/값/+)는 같다.
//   compact  목록 행 우상단. 좁아서 단위 없이 숫자만.
//   default  모달. 전폭으로 벌어지고 −/+ 가 양 끝에 앉는다.
//
// **−/+ 에 채움을 두지 않는다** — `surface-2` 는 표면과 대비 1.14~1.30 이라(등록 테마 6종 실측)
// 어느 테마에서도 원이 안 보인다. 경계는 pill 의 `border-border` 가 이미 그린다.
//
// 히트 영역은 시각 크기보다 넓다(`-m-1 p-1`) — 32px·24px 는 권장 타깃 44px 보다 작다.
const SIZES = {
  compact: {
    root: 'inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-surface py-0.5 pl-2 pr-1',
    button: 'h-6 w-6',
    icon: 'h-3.5 w-3.5',
    valueSlot: 'w-5 justify-center',
    value: 'text-sm font-semibold',
    marker: 'h-3.5 w-3.5',
    showUnit: false,
  },
  default: {
    root: 'flex h-10 items-center justify-between rounded-full border border-border bg-surface p-1',
    button: 'h-8 w-8',
    icon: 'h-4 w-4',
    // min-w 고정 + tabular-nums 라 1↔6 을 오가도 −/+ 가 제자리에 있다.
    valueSlot: 'min-w-[66px] justify-center gap-0.5',
    value: 'text-[19px] font-extrabold leading-none tracking-[-.03em]',
    marker: null,
    showUnit: true,
  },
} as const

export function PartySizeStepper(props: {
  /** aria-label 접두 — 목록에서 어느 행의 스테퍼인지 구분한다(보스명). */
  label: string
  value: number
  max: number
  onChange: (next: number) => void
  size?: keyof typeof SIZES
}): React.JSX.Element {
  const size = SIZES[props.size ?? 'default']
  const buttonClass = `flex ${size.button} items-center justify-center rounded-full text-text hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent`

  return (
    <span className={size.root}>
      {/* default 는 라벨 줄에 Users 가 따로 서므로 안에 두지 않는다 — 한 화면에 두 번 나오면 중복이다. */}
      {size.marker !== null && (
        <Users className={`${size.marker} text-text-muted`} strokeWidth={2} aria-hidden="true" />
      )}
      <button
        type="button"
        onClick={() => props.onChange(props.value - 1)}
        disabled={props.value <= 1}
        aria-label={`${props.label} 파티원 수 감소`}
        className={buttonClass}
      >
        <Minus className={size.icon} strokeWidth={2} aria-hidden="true" />
      </button>

      <span className={`flex items-baseline ${size.valueSlot}`}>
        <span className={`tabular-nums text-text ${size.value}`}>{props.value}</span>
        {size.showUnit && <span className="text-xs font-semibold text-text-muted">인</span>}
      </span>

      <button
        type="button"
        onClick={() => props.onChange(props.value + 1)}
        disabled={props.value >= props.max}
        aria-label={`${props.label} 파티원 수 증가`}
        className={buttonClass}
      >
        <Plus className={size.icon} strokeWidth={2} aria-hidden="true" />
      </button>
    </span>
  )
}
