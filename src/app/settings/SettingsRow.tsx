import { ChevronRight } from 'lucide-react'

export interface SettingsRowProps {
  label: string
  onClick: () => void
  rightContent?: React.ReactNode
  danger?: boolean
  /** rightContent가 없을 때 기본 chevron을 보여줄지 — 기본 true. */
  showChevron?: boolean
}

// 설정 화면의 단일 리스트 컨테이너 안에서 반복되는 행 — 구분선은 부모(SettingsScreen)가
// space-y 대신 divide-y로 형제 사이에 준다(이 컴포넌트 자체는 테두리를 갖지 않는다).
export function SettingsRow(props: SettingsRowProps): React.JSX.Element {
  const showChevron = props.showChevron ?? true

  return (
    <button
      type="button"
      onClick={props.onClick}
      className="flex w-full items-center justify-between py-4 text-left"
    >
      <span className={props.danger ? 'text-sm font-medium text-error' : 'text-sm font-medium text-text'}>
        {props.label}
      </span>
      {props.rightContent ??
        (showChevron && (
          <ChevronRight
            data-testid="settings-row-chevron"
            className="h-4 w-4 text-text-muted"
            strokeWidth={2}
          />
        ))}
    </button>
  )
}
