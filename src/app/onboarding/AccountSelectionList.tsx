import type { MapleAccount } from '../../types'
import { pickRepresentativeCharacter } from '../../features/onboarding/representative-character'
import { useRepresentativePortraits } from '../../features/onboarding/use-representative-portraits'
import { worldEmblemUrl } from '../../lib/world-emblem'
import { useState } from 'react'

// BossProfitScreen의 CharacterAvatar와 동일한 얼굴 크롭 방식(ADR-015) — character/basic이
// 반환하는 300x300 전신 이미지에서 얼굴 부분만 보이도록 확대·정렬한다. 아바타 크기가
// 화면마다 다르게 튜닝되는 기존 관례를 따라 이 화면(w-9, 36px) 전용 상수를 둔다.
const PORTRAIT_SOURCE_IMAGE_SIZE = 300
const PORTRAIT_FACE_CROP_BOX = { x: 123, y: 128, size: 48 }
const PORTRAIT_AVATAR_SIZE = 36

function portraitFaceCropStyle(): React.CSSProperties {
  const scale = PORTRAIT_AVATAR_SIZE / PORTRAIT_FACE_CROP_BOX.size
  return {
    width: PORTRAIT_SOURCE_IMAGE_SIZE * scale,
    height: PORTRAIT_SOURCE_IMAGE_SIZE * scale,
    left: -PORTRAIT_FACE_CROP_BOX.x * scale,
    top: -PORTRAIT_FACE_CROP_BOX.y * scale,
  }
}

export interface AccountSelectionListProps {
  accounts: MapleAccount[]
  isSubmitting: boolean
  errorMessage: string | null
  onSelect: (accountId: string) => void
}

export function AccountSelectionList(props: AccountSelectionListProps): React.JSX.Element {
  // ADR-051 결정 3: 계정이 정확히 1개면 그 항목을 초기 하이라이트로 지정한다. 화면은 반드시
  // 보여주되(어떤 메이플 ID에 연동되는지 확인하는 것이 목적) 고를 것이 하나뿐이니 항목 선택 탭
  // 1회는 아끼고 "계속하기" 확정 행위만 남긴다. 확정은 어디까지나 사용자의 클릭이므로 여기서
  // onSelect 를 자동 호출하지 않는다. 목록은 마운트 시점에 확정돼 있어 초깃값 하나면 충분하다.
  const [highlightedAccountId, setHighlightedAccountId] = useState<string | null>(
    props.accounts.length === 1 ? props.accounts[0].accountId : null,
  )
  const portraits = useRepresentativePortraits(props.accounts)

  return (
    <div className="w-full space-y-4">
      <p className="text-sm text-text">사용할 메이플 ID를 선택해주세요.</p>

      {props.errorMessage !== null && <p className="text-sm text-error">{props.errorMessage}</p>}

      <ul className="space-y-2">
        {props.accounts.map((account) => {
          const representative = pickRepresentativeCharacter(account.characters)
          const emblemUrl = worldEmblemUrl(representative.world)
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
                <span className="relative w-9 h-9 shrink-0 overflow-hidden rounded-full bg-surface-2 border border-border">
                  {portraits[account.accountId] ? (
                    <img
                      src={portraits[account.accountId] ?? undefined}
                      alt={representative.name}
                      className="absolute max-w-none"
                      style={portraitFaceCropStyle()}
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs text-text-muted">
                      ?
                    </span>
                  )}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-0.5 text-sm text-text">
                    {emblemUrl !== null && (
                      <img
                        src={emblemUrl}
                        alt={representative.world}
                        className="h-[22px] w-auto shrink-0 object-contain"
                      />
                    )}
                    <span className="min-w-0 truncate">
                      {representative.world} · {representative.name} · Lv.{representative.level}
                    </span>
                  </span>
                  <span className="text-sm text-text-muted">캐릭터 {account.characters.length}개</span>
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
