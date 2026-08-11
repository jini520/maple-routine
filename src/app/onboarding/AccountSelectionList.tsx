import { AlertTriangle } from 'lucide-react'
import type { MapleAccount } from '@core/types'
import { pickRepresentativeCharacter } from '../../features/onboarding/representative-character'
import { useAccountProbes } from '../../features/onboarding/use-account-probes'
import { useApiKeyNotice } from '../../features/onboarding/use-api-key-notice'
import { formatRosterError } from '../../features/schedule-sync/format'
import { worldEmblemUrl } from '@core/lib/world-emblem'
import { useState } from 'react'
import { Button } from '../../components/atoms/Button/Button'
import { ErrorState } from '../../components/molecules/ErrorState/ErrorState'
import { ProgressBar } from '../../components/atoms/ProgressBar/ProgressBar'

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
  const { probes, isSettled, progress, retry } = useAccountProbes(props.accounts)

  // ADR-116 결정 3: 003이 아닌 실패는 "확인하지 못했다"이지 "괜찮다"가 아니다. 판정 못 한 계정이
  // 하나라도 있으면 목록을 그리지 않는다 — ADR-113 결정 3("모르는 동안은 보여주지도 않는다")을
  // 429에도 적용한 것이다. 전에는 프로브가 429를 조용히 버려 못 쓰는 계정이 정상으로 보이고
  // 선택됐고, 고르면 그대로 온보딩 캐릭터 선택의 잠금이었다(이슈 #177 → #176 인과).
  const undetermined = Object.values(probes).flatMap((probe) =>
    probe.verdict.kind === 'undetermined' ? [probe.verdict.error] : [],
  )
  // 429만 안내 모달로 보낸다 — 이 원인만 처방이 "키 교체"라 이 화면에서 할 수 있는 것이 없다
  // (ADR-116 결정 1의 사슬: 닫을 수 없는 모달 → 확인 → 키 입력 화면). 그 외(네트워크 등)는
  // 원인을 모르므로 키를 지울 근거가 없고, 아래 ErrorState가 재시도를 준다.
  //
  // 원인이 섞이면 429를 앞세운다 — 출구를 쥔 쪽이라 그것을 먼저 말해야 화면과 모달이 같은
  // 이야기를 한다. 값은 프로브가 만든 객체 그대로라 재렌더에도 참조가 유지된다(훅의 dep).
  const rateLimited = undetermined.find((error) => error.kind === 'rateLimited') ?? null
  useApiKeyNotice(rateLimited)

  // ADR-113 결정 3: 전수 프로브가 settle 하기 전에는 목록을 그리지 않는다. 전에는 잠정 대표로
  // 카드를 먼저 그렸다가 결과가 오면 경고를 붙이고 비활성으로 바꿨는데, 그것은 고를 수 없는 카드를
  // 고를 수 있는 것처럼 보여주고 나서 뺏는 것이었다. "모르면 단정하지 않는다"를 "모르는 동안은
  // 보여주지도 않는다"로 적용한다. 안내 문구와 "계속하기"도 함께 감춘다 — 고를 것이 없는데
  // 고르라고 하는 화면이 된다.
  if (!isSettled) {
    // ADR-113 결정 5: 총량(전 계정 캐릭터 수의 합)을 시작 시점에 알 수 있어 진행률을 정확히
    // 그린다. 설명 문구는 붙이지 않는다 — 이 대기는 사용자가 아무것도 고르기 전의 관문이라
    // 설명할 대상이 화면에 없고, 직후 설정 `verifying` 단계와 마크가 같아야 하나의 연속된
    // 로딩으로 읽힌다. 프리미티브는 ADR-061 결정 6의 얇은 바 하나(결정 1의 두 번째 예외 —
    // 총량을 아는 대기에 불확정 스피너를 두는 것은 아는 것을 안 보여주는 것이다).
    const percent =
      progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0
    return (
      // `m-auto` 하나로 세로 중앙에 선다 — 이 대기는 화면에 자기 혼자뿐이라 온보딩의 다른 두
      // 전체 대기(`prefetching`·`seedingTracking`)와 같은 자리에 있어야 한다. 그것들이 쓰는
      // `items-center` 를 여기서 쓸 수 없는 이유는 **이 컴포넌트가 두 곳에 쓰이기** 때문이다:
      // 온보딩(화면 전체)과 설정 계정 변경 모달(`AccountFlowStatus`, 카드 안). 자동 여백은
      // **부모가 남는 세로 공간을 줄 때만** 작동하므로, 높이를 준 온보딩에서는 중앙에 서고
      // 카드 안에서는 아무 일도 일어나지 않는다 — 한쪽을 맞추려고 다른 쪽을 깨지 않는다.
      // (짝이 되는 변경은 `OnboardingScreen` 의 `selectingAccount`·`error` 컨테이너 min-h.)
      <div data-testid="account-probe-wait" className="m-auto w-full space-y-4">
        <p className="text-sm text-text-muted">
          ({progress.completed}/{progress.total})
        </p>
        <ProgressBar percent={percent} aria={{ now: percent, max: 100 }} />
      </div>
    )
  }

  // ADR-116 결정 4: 이 자리에서 사용자가 앞으로 갈 수 있어야 한다. 429는 위 모달이 덮으므로
  // 여기 액션이 없어도 막다른 길이 아니고(그래서 formatRosterError의 429에 액션이 없는 것과
  // 어긋나지 않는다), 그 외 원인은 재시도가 실제 처방이다.
  //
  // 문구는 formatRosterError를 그대로 쓴다 — 이 프로브도 "계정의 캐릭터 정보를 못 불러왔다"라
  // 같은 어휘이고, 새 포맷터를 만들면 원인별 문구 표가 세 벌이 된다(ADR-114 결정 3이 배너를
  // 따로 뗀 근거는 "담을 수 있는 양과 액션 규칙이 다르다"였는데 여기는 둘 다 같다).
  // place는 'onboarding' — 이 화면에는 키를 바꿀 자리가 없어 401도 재시도가 처방이다.
  if (undetermined.length > 0) {
    const copy = formatRosterError(rateLimited ?? undetermined[0], 'onboarding')
    return (
      <div className="flex w-full flex-col">
        <ErrorState
          title={copy.title}
          description={copy.description}
          action={copy.action === undefined ? undefined : { label: copy.action.label, onClick: retry }}
        />
      </div>
    )
  }

  return (
    <div className="w-full space-y-4">
      <p className="text-sm text-text">사용할 메이플 ID를 선택해주세요.</p>

      <ul className="space-y-2">
        {props.accounts.map((account) => {
          const probe = probes[account.accountId]
          // ADR-068 결정 4: 대표는 **조회 가능한 캐릭터 중** 최고 레벨이다. 목록이 그려지는
          // 시점에는 이미 프로브 결과가 있으므로 잠정 표시는 없다(ADR-113 결정 3).
          // `pickRepresentativeCharacter` 는 프로브 실패 시 폴백이다 — API 키를 못 읽어 프로브가
          // 시작조차 못 한 경우에도 대기는 끝나므로(ADR-113 결정 4) 엔트리가 없을 수 있고,
          // 그때 카드가 빈 채로 남으면 안 된다.
          const representative = probe?.representative ?? pickRepresentativeCharacter(account.characters)
          const emblemUrl = worldEmblemUrl(representative.world)
          const isHighlighted = account.accountId === highlightedAccountId
          const portraitUrl = probe?.portraitUrl ?? null
          // ADR-086 결정 8: 전원 조회 불가인 계정은 고를 수 없다 — 고르면 후보가 0명이라
          // "최소 1명"(결정 7)을 만족할 수 없어 온보딩이 진행 불가 상태로 멈춘다.
          // 목록이 프로브 뒤에 그려지므로 이 판정은 처음부터 확정이다(ADR-113 결정 3) —
          // 나중에 비활성으로 바뀌는 카드가 없다.
          const isUnselectable = probe?.verdict.kind === 'allUnavailable'

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
                  {isUnselectable && (
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
        probes[highlightedAccountId]?.verdict.kind === 'allUnavailable'
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
