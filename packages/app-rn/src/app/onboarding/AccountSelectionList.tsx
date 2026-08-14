// 메이플 ID(계정) 선택 — [[ADR-015]] · [[ADR-051]] · [[ADR-061]] · [[ADR-063]] · [[ADR-068]] ·
// [[ADR-083]] · [[ADR-086]] · [[ADR-113]] · [[ADR-114]] · [[ADR-116]].
//
// 온보딩 페이지형 레이아웃에 맞춰 자체 카드 없이 `w-full gap-4` 다 — 설정 계정 변경 모달이 이걸
// 카드로 감싸 재사용한다. 그래서 **이 컴포넌트는 자기 바깥 상자를 정하지 않는다**(아래 `m-auto` 가
// 두 자리에서 다르게 동작하는 이유이기도 하다).
//
// ── 캐릭터 0명 계정은 여기서 거르지 않는다 ([[ADR-127]]) ──────────────────────────────
//
// 그 계정이 목록에 올라오면 대표 캐릭터를 못 세워 **렌더 중에 던졌고**(2026-08-12 테스터 보고),
// 키가 이미 저장된 뒤라 재시작해도 같은 단계로 돌아와 앱 안에 탈출구가 없었다. 수정은 사슬의 가장 위
// 고리인 `core/nexon/character/normalize.ts` 에 있다 — `MapleAccount` 의 뜻이 *"응답에 있던 계정"* 이
// 아니라 **"고를 수 있는 계정"** 이라서다. **여기서 다시 거르지 말 것**: 그러면 "캐릭터 0명 계정"을
// 아는 코드가 세 곳으로 흩어진다(그 ADR 이 명시적으로 기각한 형태).
//
// 걸러진 결과로 `accounts` 가 **빈 배열**이 될 수는 있다. 그때는 프로브가 즉시 settle 하고(전체 0건)
// 판정 불가도 없어 아래 목록 분기로 내려가 안내 문구 + 비활성 "계속하기"만 남는다 — 웹과 같은 동작이라
// 여기서 새 빈 상태를 만들지 않는다(온보딩의 탈출구는 이 화면이 아니라 다음 단계의 `emptyAction` 과
// 키 재입력 모달이 쥔다).
//
// ── RN 으로 옮기며 갈린 것 다섯 ─────────────────────────────────────────────────────
//
// ① `<ul>/<li>` → `View`. 목록 시맨틱이 RN 에 없어 구조만 남는다.
// ② **`aria-pressed` → `aria-selected`**(RN 접근성 상태에 *pressed* 가 없다 — `DifficultySegment`·
//    `CharacterTrackingGrid` 와 같은 판단).
// ③ **`source` 가 둘로 갈린다** — 초상화는 넥슨이 주는 원격 URL 이라 `{ uri }` 로 감싸고, 월드
//    엠블럼은 [[ADR-129]] 이후 번들 에셋 id 라 값을 그대로 넘긴다(감싸면 안 뜬다).
//    `alt` 는 `accessibilityLabel` 이다.
// ④ `hover:`·`disabled:opacity-50` 제거 — 앞은 터치 기기에 없고, 뒤는 CSS 의사 클래스라 RN 의
//    `disabled` 프롭과 이어지지 않아 조건부 클래스가 된다(그대로 두면 비활성 카드가 멀쩡해 보인다).
// ⑤ `truncate` → `numberOfLines={1}`.
// ⑥ **월드 엠블럼의 `w-auto` 에 짝이 없다**([[ADR-135]]) — RN 은 안 적은 축에 에셋의 고유 픽셀
//    크기를 남기므로 «높이만 정한다» 를 `naturalAspectStyle` 로 적어야 한다.
import { useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'

import { pickRepresentativeCharacter } from '@core/features/onboarding/representative-character'
import { useAccountProbes } from '@core/features/onboarding/use-account-probes'
import { useApiKeyNotice } from '@core/features/onboarding/use-api-key-notice'
import { formatRosterError } from '@core/features/schedule-sync/format'
import { worldEmblemUrl } from '@core/lib/world-emblem'
import type { MapleAccount } from '@core/types'

import { Button } from '../../components/atoms/Button/Button'
import { ProgressBar } from '../../components/atoms/ProgressBar/ProgressBar'
import { ErrorState } from '../../components/molecules/ErrorState/ErrorState'
import { naturalAspectStyle } from '../../lib/image-aspect'
import { AlertTriangleIcon } from '../../lib/icons'

// `CharacterTrackingGrid` 와 동일한 얼굴 크롭 방식([[ADR-015]]) — character/basic 이 반환하는
// 300x300 전신 이미지에서 얼굴 부분만 보이도록 확대·정렬한다. 아바타 크기가 화면마다 다르게
// 튜닝되는 기존 관례를 따라 이 화면(w-9, 36px) 전용 상수를 둔다.
const PORTRAIT_SOURCE_IMAGE_SIZE = 300
const PORTRAIT_FACE_CROP_BOX = { x: 123, y: 128, size: 48 }
const PORTRAIT_AVATAR_SIZE = 36

interface PortraitCropStyle {
  width: number
  height: number
  left: number
  top: number
}

function portraitFaceCropStyle(): PortraitCropStyle {
  const scale = PORTRAIT_AVATAR_SIZE / PORTRAIT_FACE_CROP_BOX.size
  return {
    width: PORTRAIT_SOURCE_IMAGE_SIZE * scale,
    height: PORTRAIT_SOURCE_IMAGE_SIZE * scale,
    left: -PORTRAIT_FACE_CROP_BOX.x * scale,
    top: -PORTRAIT_FACE_CROP_BOX.y * scale,
  }
}

// [[ADR-083]] 결정 4: 실패 문구를 받지 않는다 — 계정 목록·"계속하기"가 그 자리에 남으므로 실패는
// 이벤트다([[ADR-063]] 원칙 4). 스토어가 토스트로 알린다.
export interface AccountSelectionListProps {
  accounts: MapleAccount[]
  isSubmitting: boolean
  onSelect: (accountId: string) => void
}

export function AccountSelectionList(props: AccountSelectionListProps): React.JSX.Element {
  // [[ADR-051]] 결정 3: 계정이 정확히 1개면 그 항목을 초기 하이라이트로 지정한다. 화면은 반드시
  // 보여주되(어떤 메이플 ID에 연동되는지 확인하는 것이 목적) 고를 것이 하나뿐이니 항목 선택 탭
  // 1회는 아끼고 "계속하기" 확정 행위만 남긴다. 확정은 어디까지나 사용자의 누름이므로 여기서
  // onSelect 를 자동 호출하지 않는다. 목록은 마운트 시점에 확정돼 있어 초깃값 하나면 충분하다.
  const [highlightedAccountId, setHighlightedAccountId] = useState<string | null>(
    props.accounts.length === 1 ? props.accounts[0].accountId : null,
  )
  const { probes, isSettled, progress, retry } = useAccountProbes(props.accounts)

  // [[ADR-116]] 결정 3: 003이 아닌 실패는 "확인하지 못했다"이지 "괜찮다"가 아니다. 판정 못 한 계정이
  // 하나라도 있으면 목록을 그리지 않는다 — [[ADR-113]] 결정 3("모르는 동안은 보여주지도 않는다")을
  // 429에도 적용한 것이다. 전에는 프로브가 429를 조용히 버려 못 쓰는 계정이 정상으로 보이고
  // 선택됐고, 고르면 그대로 온보딩 캐릭터 선택의 잠금이었다(이슈 #177 → #176 인과).
  const undetermined = Object.values(probes).flatMap((probe) =>
    probe.verdict.kind === 'undetermined' ? [probe.verdict.error] : [],
  )
  // 429만 안내 모달로 보낸다 — 이 원인만 처방이 "키 교체"라 이 화면에서 할 수 있는 것이 없다
  // ([[ADR-116]] 결정 1의 사슬: 닫을 수 없는 모달 → 확인 → 키 입력 화면). 그 외(네트워크 등)는
  // 원인을 모르므로 키를 지울 근거가 없고, 아래 ErrorState가 재시도를 준다.
  //
  // 원인이 섞이면 429를 앞세운다 — 출구를 쥔 쪽이라 그것을 먼저 말해야 화면과 모달이 같은
  // 이야기를 한다. 값은 프로브가 만든 객체 그대로라 재렌더에도 참조가 유지된다(훅의 dep).
  const rateLimited = undetermined.find((error) => error.kind === 'rateLimited') ?? null
  useApiKeyNotice(rateLimited)

  // [[ADR-113]] 결정 3: 전수 프로브가 settle 하기 전에는 목록을 그리지 않는다. 전에는 잠정 대표로
  // 카드를 먼저 그렸다가 결과가 오면 경고를 붙이고 비활성으로 바꿨는데, 그것은 고를 수 없는 카드를
  // 고를 수 있는 것처럼 보여주고 나서 뺏는 것이었다. "모르면 단정하지 않는다"를 "모르는 동안은
  // 보여주지도 않는다"로 적용한다. 안내 문구와 "계속하기"도 함께 감춘다 — 고를 것이 없는데
  // 고르라고 하는 화면이 된다.
  if (!isSettled) {
    // [[ADR-113]] 결정 5: 총량(전 계정 캐릭터 수의 합)을 시작 시점에 알 수 있어 진행률을 정확히
    // 그린다. 설명 문구는 붙이지 않는다 — 이 대기는 사용자가 아무것도 고르기 전의 관문이라
    // 설명할 대상이 화면에 없고, 직후 설정 `verifying` 단계와 마크가 같아야 하나의 연속된
    // 로딩으로 읽힌다. 프리미티브는 [[ADR-061]] 결정 6의 얇은 바 하나(결정 1의 두 번째 예외 —
    // 총량을 아는 대기에 불확정 스피너를 두는 것은 아는 것을 안 보여주는 것이다).
    const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0
    return (
      // `m-auto` 하나로 세로 중앙에 선다 — 이 대기는 화면에 자기 혼자뿐이라 온보딩의 다른 두
      // 전체 대기(`prefetching`·`seedingTracking`)와 같은 자리에 있어야 한다. 자동 여백은
      // **부모가 남는 세로 공간을 줄 때만** 작동하므로, 스크롤 콘텐츠가 화면을 채우는 온보딩에서는
      // 중앙에 서고 설정 계정 변경 모달의 카드 안에서는 아무 일도 일어나지 않는다 — 한쪽을
      // 맞추려고 다른 쪽을 깨지 않는다(짝이 되는 변경은 `OnboardingScreen` 의 `flexGrow`).
      <View testID="account-probe-wait" className="m-auto w-full gap-4">
        <Text className="text-sm text-text-muted">
          ({progress.completed}/{progress.total})
        </Text>
        <ProgressBar percent={percent} aria={{ now: percent, max: 100 }} />
      </View>
    )
  }

  // [[ADR-116]] 결정 4: 이 자리에서 사용자가 앞으로 갈 수 있어야 한다. 429는 위 모달이 덮으므로
  // 여기 액션이 없어도 막다른 길이 아니고(그래서 formatRosterError의 429에 액션이 없는 것과
  // 어긋나지 않는다), 그 외 원인은 재시도가 실제 처방이다.
  //
  // 문구는 formatRosterError를 그대로 쓴다 — 이 프로브도 "계정의 캐릭터 정보를 못 불러왔다"라
  // 같은 어휘이고, 새 포맷터를 만들면 원인별 문구 표가 세 벌이 된다.
  // place는 'onboarding' — 이 화면에는 키를 바꿀 자리가 없어 401도 재시도가 처방이다.
  if (undetermined.length > 0) {
    const copy = formatRosterError(rateLimited ?? undetermined[0], 'onboarding')
    return (
      <View className="w-full flex-1">
        <ErrorState
          title={copy.title}
          description={copy.description}
          action={copy.action === undefined ? undefined : { label: copy.action.label, onClick: retry }}
        />
      </View>
    )
  }

  // [[ADR-086]] 결정 8: 계정이 1개라 초기 하이라이트로 지정된 항목([[ADR-051]] 결정 3)이 나중에
  // 조회 불가로 판명될 수 있다 — 항목 비활성만으로는 막히지 않으므로 확정 버튼도 막는다.
  // 웹은 `disabled` 프롭 하나로 끝났지만 RN 은 흐림(`disabled:opacity-50` 의 짝)까지 같은 판정을
  // 봐야 해서 값으로 뽑는다.
  const isConfirmDisabled =
    highlightedAccountId === null ||
    props.isSubmitting ||
    probes[highlightedAccountId]?.verdict.kind === 'allUnavailable'

  return (
    <View className="w-full gap-4">
      <Text className="text-sm text-text">사용할 메이플 ID를 선택해주세요.</Text>

      <View className="gap-2">
        {props.accounts.map((account) => {
          const probe = probes[account.accountId]
          // [[ADR-068]] 결정 4: 대표는 **조회 가능한 캐릭터 중** 최고 레벨이다. 목록이 그려지는
          // 시점에는 이미 프로브 결과가 있으므로 잠정 표시는 없다([[ADR-113]] 결정 3).
          // `pickRepresentativeCharacter` 는 프로브 실패 시 폴백이다 — API 키를 못 읽어 프로브가
          // 시작조차 못 한 경우에도 대기는 끝나므로([[ADR-113]] 결정 4) 엔트리가 없을 수 있고,
          // 그때 카드가 빈 채로 남으면 안 된다. 캐릭터가 0명인 계정은 여기 도달하지 않는다
          // (파일 머리 — [[ADR-127]] 이 `normalizeCharacterList` 에서 걸렀다).
          const representative = probe?.representative ?? pickRepresentativeCharacter(account.characters)
          const emblemUrl = worldEmblemUrl(representative.world)
          const isHighlighted = account.accountId === highlightedAccountId
          const portraitUrl = probe?.portraitUrl ?? null
          // [[ADR-086]] 결정 8: 전원 조회 불가인 계정은 고를 수 없다 — 고르면 후보가 0명이라
          // "최소 1명"(결정 7)을 만족할 수 없어 온보딩이 진행 불가 상태로 멈춘다.
          // 목록이 프로브 뒤에 그려지므로 이 판정은 처음부터 확정이다([[ADR-113]] 결정 3) —
          // 나중에 비활성으로 바뀌는 카드가 없다.
          const isUnselectable = probe?.verdict.kind === 'allUnavailable'
          const isDisabled = props.isSubmitting || isUnselectable

          return (
            <Pressable
              key={account.accountId}
              role="button"
              aria-selected={isHighlighted}
              disabled={isDisabled}
              onPress={() => setHighlightedAccountId(account.accountId)}
              className={`w-full flex-row items-center gap-3 rounded-[10px] border px-4 py-3${
                isHighlighted ? ' border-primary bg-primary-tint' : ' border-border'
              }${isDisabled ? ' opacity-50' : ''}`}
            >
              <View className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border bg-surface-2">
                {portraitUrl !== null ? (
                  <Image
                    testID={`account-portrait-${account.accountId}`}
                    accessibilityLabel={representative.name}
                    source={{ uri: portraitUrl }}
                    style={{ position: 'absolute', ...portraitFaceCropStyle() }}
                  />
                ) : (
                  <View className="h-full w-full items-center justify-center">
                    <Text className="text-xs text-text-muted">?</Text>
                  </View>
                )}
              </View>

              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-0.5">
                  {emblemUrl !== null && (
                    <Image
                      testID={`world-emblem-${account.accountId}`}
                      accessibilityLabel={representative.world}
                      source={emblemUrl}
                      // 웹 `h-[22px] w-auto` 의 짝 — 폭은 그림이 정한다([[ADR-135]]). 폭을 안 적으면
                      // 엠블럼(46×50)의 고유 폭이 남아 이름 줄 왼쪽이 벌어진다.
                      style={naturalAspectStyle(emblemUrl, { height: 22 })}
                      className="shrink-0"
                      resizeMode="contain"
                    />
                  )}
                  <Text numberOfLines={1} className="min-w-0 text-sm text-text">
                    {representative.world} · {representative.name} · Lv.{representative.level}
                  </Text>
                </View>
                <Text className="text-sm text-text-muted">캐릭터 {account.characters.length}개</Text>
                {/* [[ADR-068]] 결정 4: 전원 조회 불가는 고른 뒤가 아니라 **고르기 전에** 알린다 —
                    고르면 피커가 빈 목록이 되고 아무 설명이 없었다. 전수 프로브라 "이 계정
                    전체"를 단정할 수 있다(표본 1명으로는 못 한다). */}
                {isUnselectable && (
                  <View className="mt-0.5 flex-row items-start gap-1.5">
                    <AlertTriangleIcon
                      className="mt-px h-3.5 w-3.5 flex-none text-error-ink"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <Text className="text-xs font-medium text-error-ink">
                      이 계정의 캐릭터를 조회할 수 없습니다
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          )
        })}
      </View>

      <Button
        variant="primary"
        disabled={isConfirmDisabled}
        onPress={() => {
          if (highlightedAccountId !== null) props.onSelect(highlightedAccountId)
        }}
        className={`w-full items-center${isConfirmDisabled ? ' opacity-50' : ''}`}
      >
        계속하기
      </Button>
    </View>
  )
}
