import { useState } from 'react'
import type { MapleAccount } from '../../types'
import { pickRepresentativeCharacter } from '../../features/onboarding/representative-character'

export interface AccountSelectionListProps {
  accounts: MapleAccount[]
  isSubmitting: boolean
  errorMessage: string | null
  onSelect: (accountId: string) => void
}

export function AccountSelectionList(props: AccountSelectionListProps): React.JSX.Element {
  const [highlightedAccountId, setHighlightedAccountId] = useState<string | null>(null)

  return (
    <div className="rounded-[14px] bg-surface border border-border p-6 space-y-4">
      <p className="text-sm text-text">사용할 메이플 ID를 선택해주세요.</p>

      {props.errorMessage !== null && <p className="text-sm text-error">{props.errorMessage}</p>}

      <ul className="space-y-2">
        {props.accounts.map((account) => {
          const representative = pickRepresentativeCharacter(account.characters)
          const isHighlighted = account.accountId === highlightedAccountId

          return (
            <li key={account.accountId}>
              <button
                type="button"
                aria-pressed={isHighlighted}
                disabled={props.isSubmitting}
                onClick={() => setHighlightedAccountId(account.accountId)}
                className={
                  isHighlighted
                    ? 'w-full flex items-center gap-3 text-left rounded-[10px] border border-primary bg-primary/15 px-4 py-3 disabled:opacity-50'
                    : 'w-full flex items-center gap-3 text-left rounded-[10px] border border-border px-4 py-3 hover:bg-primary/15 disabled:opacity-50'
                }
              >
                <span className="w-9 h-9 shrink-0 rounded-full bg-surface-2 border border-border" />
                <span className="flex flex-col">
                  <span className="text-sm text-text">
                    {representative.name} · {representative.jobClass} Lv.{representative.level}
                  </span>
                  <span className="text-sm text-text-muted">
                    {representative.world} · 캐릭터 {account.characters.length}명
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        disabled={highlightedAccountId === null || props.isSubmitting}
        onClick={() => {
          if (highlightedAccountId !== null) props.onSelect(highlightedAccountId)
        }}
        className="w-full rounded-full bg-primary text-bg font-semibold hover:bg-primary-hover px-5 py-2.5 disabled:opacity-50"
      >
        계속하기
      </button>
    </div>
  )
}
