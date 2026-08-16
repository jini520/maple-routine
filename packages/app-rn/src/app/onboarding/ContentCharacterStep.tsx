// 온보딩 마지막 단계 — 관리할 캐릭터 고르기([[ADR-035]] 결정 13 · [[ADR-143]] 결정 1).
//
// **본문은 이 파일에 없다.** 설정 하위 페이지(`SettingsCharactersScreen`)와 **같은**
// `CharacterManageBody` + `useCharacterManage` 를 쓰고, 갈리는 것은 머리와 CTA 뿐이다
// ([[ADR-144]] 결정 1). 여기 있는 것은 제목 블록 · 「계속하기」 · 최소 1개 게이트 셋이다.
//
// ── 무엇이 없어졌나 ([[ADR-143]]) ───────────────────────────────────────────────────
//
// | 전 | 후 |
// |---|---|
// | 3열 그리드(`CharacterTrackingGrid`) 한 층 | 「선택됨」/「고르는 곳」 두 층의 행 카드([[ADR-144]] 결정 2) |
// | 고른 계정 하나의 후보 | 계정 드롭다운 — 여러 메이플 ID 를 넘나든다 |
// | `accountId` 프롭(설정 계정 변경이 넘기던 후보 계정) | 없다 — 그 플로우가 폐지됐다(결정 7) |
// | `submitLabel` 프롭 | 없다 — 이 컴포넌트는 이제 온보딩 전용이다 |
// | 후보 0건의 「계정 다시 선택」(`emptyAction`) | 없다 — 출구는 **드롭다운을 되돌리는 것**이다(결정 10) |
//
// ── 401 은 여전히 배선하지 않는다 ([[ADR-115]] "구현하며 정정한 것" 5 · [[ADR-116]] 결정 2) ──
//
// 설정 화면은 `manage.rosterError` 를 통째로 키 재입력 진입점에 넘기지만 **이 자리는 429 만** 넘긴다.
// 여기의 401 은 "사용자가 방금 넣은 키가 나쁘다"는 뜻이라 성질이 다르고, 그래서 폼 자체의 실패로
// 남아 아래 `ErrorState` 의 「다시 시도」가 실제 처방이 된다. 429 만 넘기는 이유는 반대로 그 자리가
// **하드 잠금**이기 때문이다(이슈 #176 — 고를 캐릭터가 없어 CTA 가 영구 비활성이고, 재시도는 같은
// 키로 또 429 이며, 단계는 라우트가 아니라 `status` switch 라 되돌릴 UI 도 없다).
//
// ── 대표 캐릭터도 여기서 함께 넘긴다 ([[ADR-143]] 결정 4) ───────────────────────────
//
// 본문이 별을 그리므로 이 화면에서도 대표를 고를 수 있다. 고른 것을 안 실어 보내면 사용자의 선택이
// 조용히 사라지므로 CTA 가 목록과 함께 넘긴다 — 저장 순서(목록 먼저, 대표 나중)는 화면이 아니라
// `OnboardingScreen` 이 지킨다(`setTrackedCharacterOcids` 의 참조 무결성이 목록에 없는 대표를 지운다).
import { Text, View } from 'react-native'

import { useApiKeyNotice } from '@core/features/onboarding/use-api-key-notice'

import { Button } from '../../components/atoms/Button/Button'
import { MapleSpinner } from '../../components/atoms/MapleSpinner/MapleSpinner'
import { CharacterManageBody } from '../../components/organisms/CharacterManage/CharacterManageBody'
import type { ReorderScroll } from '../../components/organisms/CharacterManage/use-reorder-scroll'
import { useCharacterManage } from '../../components/organisms/CharacterManage/use-character-manage'

export interface ContentCharacterStepProps {
  isSubmitting: boolean
  /** 목록과 대표를 함께 넘긴다 — 저장 순서는 받는 쪽이 지킨다(파일 머리). */
  onSubmit: (ocids: string[], representativeOcid: string | null) => void
  /**
   * 끌기 중 자동 스크롤이 만질 스크롤 뷰([[ADR-144]] 결정 5) — **화면이 소유한다.**
   * 온보딩의 스크롤 뷰는 `OnboardingScreen` 의 `OnboardingStep` 이라 그 짝이 거기서 내려온다
   * (설정 하위 페이지가 `ScreenScroll` 에 같은 두 값을 거는 것과 같은 배선이다).
   */
  scroll: ReorderScroll
}

export function ContentCharacterStep(props: ContentCharacterStepProps): React.JSX.Element {
  const manage = useCharacterManage()

  // 파일 머리 — **429 만** 넘긴다. 두 조회가 각각 맞을 수 있어 두 번 부르지만 두 겹은 아니다
  // (훅은 값 하나를 지켜보고, 멱등은 스토어 가드가 진다 — [[ADR-115]] 결정 6).
  useApiKeyNotice(manage.rosterError?.kind === 'rateLimited' ? manage.rosterError : null)
  useApiKeyNotice(manage.accountsError?.kind === 'rateLimited' ? manage.accountsError : null)

  // [[ADR-086]] 결정 7: 최소 1개. 이 제약은 온보딩 전용이고 설정 화면에는 «변경 없음» 게이트가
  // 따로 있다(`isDirty`) — 그래서 두 화면의 CTA 가 갈린다.
  const isSubmitDisabled = manage.selectedOcids.length === 0 || props.isSubmitting

  return (
    <View className="w-full gap-4">
      <View className="gap-1">
        <Text className="text-lg font-semibold text-text">관리할 캐릭터를 선택해주세요</Text>
        {/* 캐릭터를 세는 단위는 «개» 다([[ADR-144]] 결정 8 — «명» 은 사람을 센다). */}
        <Text className="text-sm text-text-muted">
          선택한 캐릭터만 스케줄러 목록에 표시됩니다. 최소 한 개는 선택해주세요.
        </Text>
      </View>

      {/* 401 을 넘기지 않으므로 화면이 안 옮겨간다 — 문구도 그 사실에 맞아야 하고, 그래서 이
          자리에서만 401 에 「다시 시도」가 남는다(`formatRosterError` 의 `'onboarding'`). */}
      <CharacterManageBody manage={manage} scroll={props.scroll} place="onboarding" />

      <Button
        variant="primary"
        disabled={isSubmitDisabled}
        aria-busy={props.isSubmitting}
        onPress={() => props.onSubmit(manage.selectedOcids, manage.representativeOcid)}
        className={`w-full flex-row items-center justify-center gap-2${isSubmitDisabled ? ' opacity-50' : ''}`}
      >
        {/* [[ADR-061]] 결정 5·9 — 스피너 + 말줄임표 없는 '~중' 라벨 */}
        {props.isSubmitting && <MapleSpinner size={16} />}
        {props.isSubmitting ? '저장 중' : '계속하기'}
      </Button>
    </View>
  )
}
