import { AlertTriangle } from 'lucide-react'
import type { MapleAccount } from '../../types'
import { pickRepresentativeCharacter } from '../../features/onboarding/representative-character'
import { useAccountProbes } from '../../features/onboarding/use-account-probes'
import { worldEmblemUrl } from '../../lib/world-emblem'
import { useState } from 'react'
import { Button } from '../../components/atoms/Button/Button'

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

// ADR-083 결정 4: 실패 문구를 받지 않는다 — 계정 목록·"계속하기"가 그 자리에 남으므로 실패는
// 이벤트다([[ADR-063]] 원칙 4). 스토어가 토스트로 알린다.
export interface AccountSelectionListProps {
  accounts: MapleAccount[]
  isSubmitting: boolean
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
  const probes = useAccountProbes(props.accounts)

  return (
    <div className="w-full space-y-4">
      <p className="text-sm text-text">사용할 메이플 ID를 선택해주세요.</p>

      <ul className="space-y-2">
        {props.accounts.map((account) => {
          const probe = probes[account.accountId]
          // ADR-068 결정 4: 대표는 **조회 가능한 캐릭터 중** 최고 레벨이다. 프로브가 끝나기 전에는
          // character/list 기준으로 잠깐 보여주고(빈 카드보다 낫다) 결과가 오면 교체된다.
          const representative = probe?.representative ?? pickRepresentativeCharacter(account.characters)
          const emblemUrl = worldEmblemUrl(representative.world)
          const isHighlighted = account.accountId === highlightedAccountId
          const portraitUrl = probe?.portraitUrl ?? null
          // ADR-086 결정 8: 전원 조회 불가인 계정은 고를 수 없다 — 고르면 후보가 0명이라
          // "최소 1명"(결정 7)을 만족할 수 없어 온보딩이 진행 불가 상태로 멈춘다.
          // 프로브가 도착하기 전에는 고를 수 있다(모르는 것을 단정하지 않는다).
          const isUnselectable = probe?.allUnavailable === true

          return (
            <li key={account.accountId}>
              <button
                type="button"
                aria-pressed={isHighlighted}
                disabled={props.isSubmitting || isUnselectable}
                onClick={() => setHighlightedAccountId(account.accountId)}
                className={
                  isHighlighted
                    ? 'w-full flex items-center gap-3 text-left rounded-[10px] border border-primary bg-primary-tint px-4 py-3 disabled:opacity-50'
                    : 'w-full flex items-center gap-3 text-left rounded-[10px] border border-border px-4 py-3 hover:bg-primary-tint disabled:opacity-50'
                }
              >
                <span className="relative w-9 h-9 shrink-0 overflow-hidden rounded-full bg-surface-2 border border-border">
                  {portraitUrl !== null ? (
                    <img
                      src={portraitUrl}
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
                  {/* ADR-068 결정 4: 전원 조회 불가는 고른 뒤가 아니라 **고르기 전에** 알린다 —
                      고르면 피커가 빈 목록이 되고 아무 설명이 없었다. 전수 프로브라 "이 계정
                      전체"를 단정할 수 있다(표본 1명으로는 못 한다). */}
                  {probe?.allUnavailable === true && (
                    <span className="mt-0.5 flex items-start gap-1.5 text-xs font-medium text-error-ink">
                      <AlertTriangle className="mt-px h-3.5 w-3.5 flex-none" strokeWidth={2} aria-hidden="true" />
                      이 계정의 캐릭터를 조회할 수 없습니다
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <Button
        variant="primary"
        // ADR-086 결정 8: 계정이 1개라 초기 하이라이트로 지정된 항목(ADR-051 결정 3)이 나중에
        // 조회 불가로 판명될 수 있다 — 항목 비활성만으로는 막히지 않으므로 확정 버튼도 막는다.
        disabled={
        highlightedAccountId === null ||
        props.isSubmitting ||
        probes[highlightedAccountId]?.allUnavailable === true
        }
        onClick={() => {
        if (highlightedAccountId !== null) props.onSelect(highlightedAccountId)
        }}
        className="w-full disabled:opacity-50"
      >
        계속하기
      </Button>
    </div>
  )
}
