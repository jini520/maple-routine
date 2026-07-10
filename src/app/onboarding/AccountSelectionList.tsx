import type { MapleAccount } from '../../types'
import { pickRepresentativeCharacter } from '../../features/onboarding/representative-character'

export interface AccountSelectionListProps {
  accounts: MapleAccount[]
  isSubmitting: boolean
  errorMessage: string | null
  onSelect: (accountId: string) => void
}

export function AccountSelectionList(props: AccountSelectionListProps): React.JSX.Element {
  return (
    <div className="rounded-[14px] bg-white border border-[#F0DFD1] p-6 space-y-4">
      <p className="text-sm text-[#5B4636]">사용할 메이플 ID를 선택해주세요.</p>

      {props.errorMessage !== null && <p className="text-sm text-[#B91C1C]">{props.errorMessage}</p>}

      <ul className="space-y-2">
        {props.accounts.map((account) => {
          const representative = pickRepresentativeCharacter(account.characters)
          const label = `${representative.name} · ${representative.jobClass} Lv.${representative.level}`
          return (
            <li key={account.accountId}>
              <button
                type="button"
                disabled={props.isSubmitting}
                onClick={() => props.onSelect(account.accountId)}
                className="w-full text-left rounded-[10px] border border-[#F0DFD1] px-4 py-3 text-[#2B1B10] hover:bg-[#FFE9DB] disabled:opacity-50"
              >
                {label}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
