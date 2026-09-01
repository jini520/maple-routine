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
//
// ── 「계속하기」는 하단에 **고정**된다 ([[ADR-144]] 정정 2, 사용자 지정 2026-08-18) ──────────
//
// 설정 하위 페이지의 「저장」과 같은 액션 바다 — 본문이 그 화면과 **같은 두 층**이라, 캐릭터가 많은
// 계정에서는 본문 끝의 CTA 가 화면 밖에 있게 된다. 되돌릴 UI 가 없는 단계라([[ADR-116]]) 앞으로
// 갈 버튼이 그것 하나뿐인데, 그것이 화면 밖에 있으면 안 된다.
//
// **그래서 이 단계가 단계 셸(`OnboardingStep`)을 직접 두른다.** 바의 활성 조건이 `useCharacterManage`
// 안에 있어 그 훅을 부르는 컴포넌트가 스크롤과 바 **둘 다의 조상**이어야 하고, 훅은 조건부로 못
// 부르므로 그 자리를 `OnboardingScreen` 으로 올릴 수 없다. 끌기 자동 스크롤 배선(결정 5)도 같은
// 이유로 여기 있다 — 그 배선의 자리는 늘 «스크롤 뷰를 가진 쪽» 이고, 그것이 이제 이 단계다
// (설정 하위 페이지가 `ScreenScroll` 에 같은 두 값을 거는 것과 같다).
import { View } from 'react-native'

import { useApiKeyNotice } from '../../features/onboarding/use-api-key-notice'

import { Button } from '../../components/atoms/Button/Button'
import { MapleSpinner } from '../../components/atoms/MapleSpinner/MapleSpinner'
import { Text } from '../../components/atoms/Text/Text'
import { CharacterManageBody } from '../../components/organisms/CharacterManage/CharacterManageBody'
import { useCharacterManage } from '../../components/organisms/CharacterManage/use-character-manage'
import { useReorderScroll } from '../../components/organisms/CharacterManage/use-reorder-scroll'
import { OnboardingStep } from './OnboardingStep'

export interface ContentCharacterStepProps {
  isSubmitting: boolean
  /** 목록과 대표를 함께 넘긴다 — 저장 순서는 받는 쪽이 지킨다(파일 머리). */
  onSubmit: (ocids: string[], representativeOcid: string | null) => void
}

export function ContentCharacterStep(props: ContentCharacterStepProps): React.JSX.Element {
  const manage = useCharacterManage()
  const { scrollRef, onScroll, scroll } = useReorderScroll()

  // 파일 머리 — **429 만** 넘긴다. 두 조회가 각각 맞을 수 있어 두 번 부르지만 두 겹은 아니다
  // (훅은 값 하나를 지켜보고, 멱등은 스토어 가드가 진다 — [[ADR-115]] 결정 6).
  useApiKeyNotice(manage.rosterError?.kind === 'rateLimited' ? manage.rosterError : null)
  useApiKeyNotice(manage.accountsError?.kind === 'rateLimited' ? manage.accountsError : null)

  // [[ADR-086]] 결정 7: 최소 1개. 이 제약은 온보딩 전용이고 설정 화면에는 «변경 없음» 게이트가
  // 따로 있다(`isDirty`) — 그래서 두 화면의 CTA 가 갈린다.
  const isSubmitDisabled = manage.selectedOcids.length === 0 || props.isSubmitting

  return (
    <OnboardingStep
      scrollRef={scrollRef}
      onScroll={onScroll}
      footer={
        <Button
          variant="primary"
          disabled={isSubmitDisabled}
          aria-busy={props.isSubmitting}
          onPress={() => props.onSubmit(manage.selectedOcids, manage.representativeOcid)}
          // 웹의 `disabled:opacity-50` 은 CSS 의사 클래스라 RN 의 `disabled` 프롭과 이어지지
          // 않는다 — 그대로 두면 비활성 버튼이 멀쩡한 색으로 보인다(설정 화면과 같은 처방).
          className={`w-full flex-row items-center justify-center gap-2${isSubmitDisabled ? ' opacity-50' : ''}`}
        >
          {/* [[ADR-061]] 결정 5·9 — 스피너 + 말줄임표 없는 '~중' 라벨 */}
          {props.isSubmitting && <MapleSpinner size={16} />}
          {props.isSubmitting ? '저장 중' : '계속하기'}
        </Button>
      }
    >
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
        <CharacterManageBody manage={manage} scroll={scroll} place="onboarding" />
      </View>
    </OnboardingStep>
  )
}
