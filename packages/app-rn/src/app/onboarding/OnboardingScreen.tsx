// 온보딩 — 앱을 처음 여는 사람이 보는 유일한 화면([[ADR-016]] · [[ADR-035]] · [[ADR-061]] ·
// [[ADR-083]] · [[ADR-086]]).
//
// **단계는 라우트가 아니라 `status` switch 다.** 웹과 같고, 그래서 뒤로 갈 UI 가 없다 — 잠기면 출구가
// 없다는 뜻이라 [[ADR-116]] 이 그 자리에 안내 모달을 얹었다(그 배선은 `AccountSelectionList` ·
// `ContentCharacterStep` 이 각각 갖는다). 화면 목록을 갈아 끼우는 온보딩 분기는 `RootNavigator` 다.
//
// ## 상태는 core 에 있다 — 여기서 다시 만들지 않는다
//
// `@core/features/onboarding/store` 가 그대로 산다([[ADR-128]] 결정 4·5). 이 파일이 하는 일은 그
// `status` 를 화면에 매핑하는 것과, 웹에 있던 로컬 state 하나(`isSubmittingContent`)를 그대로 두는
// 것뿐이다.
//
// ── RN 으로 옮기며 갈린 것 넷 ─────────────────────────────────────────────────────
//
// ① **컨테이너가 `<div>` 가 아니라 `ScrollView` 다.** 웹은 문서 스크롤을 썼고([[ADR-099]] 이전의
//    전제) RN 에는 문서가 없다. `ScreenScroll` 을 쓰지 않는 이유는 그 셸이 **탭 화면 + `PageHeader`**
//    를 위한 것이라서다 — 온보딩은 헤더가 없고 탭바도 없으며, 무엇보다 아래 ②의 `flexGrow` 를
//    요구한다(그 셸에는 없는 축이다). 웹에서도 온보딩만 공용 셸 밖에 있었다.
// ② **`min-h-[calc(100dvh-…)]` → 콘텐츠 컨테이너의 `flexGrow: 1`.** 웹이 그 min-height 로 노린 것은
//    "남는 세로 공간을 만들어 자동 여백·`justify-center` 가 작동하게" 하는 것이었고, RN 스크롤에서
//    같은 뜻을 내는 것이 `flexGrow` 다. 세 자리가 그 공간을 쓴다 — `prefetching` · `seedingTracking`
//    (`justify-center`)과 `selectingAccount` 의 프로브 대기(`m-auto`, `AccountSelectionList` 안).
// ③ **상단 안전영역을 이 화면이 먹는다.** 웹에서는 `TabLayer` 루트의 `pt-[var(--sa-top)]` 가 앱 전체에
//    깔려 온보딩도 그 값을 받았는데, RN 에는 그 공통 래퍼가 없다(탭 화면은 `PageHeader` 가,
//    헤더 없는 화면은 `ScreenScroll` 이 각자 먹는다). **콘텐츠 패딩이 아니라 상자의 마진**이어야
//    한다 — 인디케이터는 콘텐츠가 아니라 스크롤포트 위에 겹쳐 그려진다([[ADR-099]] 결정 6).
// ④ **인디케이터 색을 알려 준다**([[ADR-099]] 결정 5). 웹은 `:root` 의 `color-scheme` 가 문서
//    스크롤바까지 칠했지만, RN 은 `ScrollView` 마다 프롭으로 줘야 하고 기본값(`'default'`)은 테마가
//    아니라 OS 설정을 따라간다 — 그것이 웹에서 겪은 실패다.
import { useState } from 'react'
import { Platform, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useOnboardingStore } from '@core/features/onboarding/store'

import { MapleSweepSpinner } from '../../components/atoms/MapleSweepSpinner/MapleSweepSpinner'
import { ProgressBar } from '../../components/atoms/ProgressBar/ProgressBar'
import { useScrollIndicatorStyle } from '../../theme/context'
import { AccountSelectionList } from './AccountSelectionList'
import { ApiKeyForm } from './ApiKeyForm'
import { ContentCharacterStep } from './ContentCharacterStep'
import { TrackingModeStep } from './TrackingModeStep'

/**
 * 단계 하나가 놓이는 자리 — 웹 `OnboardingScreen` 의 컨테이너 `<div>` 세 모양을 하나로 합친 것.
 *
 * `center` 가 곧 웹의 `items-center justify-center` 이고(전체 대기 두 자리), 아닌 자리는 `pt-8 pb-4`
 * 로 위에서부터 그린다. 두 모양 모두 `flexGrow: 1` 을 갖는 이유는 파일 머리 ②.
 */
function OnboardingStep(props: { center?: boolean; children: React.ReactNode }): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const indicatorStyle = useScrollIndicatorStyle()

  return (
    <ScrollView
      testID="onboarding-scroll"
      indicatorStyle={indicatorStyle}
      className="flex-1"
      // 파일 머리 ③ — 마진이지 패딩이 아니다. 하단은 홈 인디케이터 자리라 콘텐츠 여백으로 남긴다
      // (탭바가 없는 화면의 규칙 — `ScreenScroll` 의 `bottom-inset.ts` 와 같은 갈래다).
      style={{ marginTop: insets.top }}
      contentContainerClassName={
        props.center === true ? 'items-center justify-center px-4' : 'px-4 pt-8 pb-4'
      }
      contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom }}
      // 키보드가 떠 있는 동안에도 첫 탭이 버튼에 닿는다 — 없으면 그 탭이 키보드를 내리는 데만 쓰인다
      // (`ApiKeyForm` 의 확인 버튼이 그 자리다). 웹에서는 없던 문제라 짝이 없는 프롭이다.
      keyboardShouldPersistTaps="handled"
      // iOS 는 키보드가 떠도 스크롤 뷰 크기가 그대로라 확인 버튼이 가려질 수 있다(안드로이드는 창이
      // `adjustResize` 로 줄어 저절로 해결된다). 그 인셋을 OS 가 넣게 한다 — 안드로이드에서는 no-op.
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
    >
      {props.children}
    </ScrollView>
  )
}

export function OnboardingScreen(): React.JSX.Element {
  const {
    status,
    accounts,
    prefetchProgress,
    submitApiKey,
    selectAccount,
    selectTrackingMode,
    submitContentCharacters,
    restartAccountSelection,
  } = useOnboardingStore()
  // 컨텐츠 캐릭터 저장(setTrackedCharacterOcids)이 끝나 다음 상태로 전이하기 전까지의 짧은
  // 구간 동안 CTA를 스피너로 바꿔 중복 누름을 막는다 — 전용 status가 없어 로컬 상태로 다룬다.
  const [isSubmittingContent, setIsSubmittingContent] = useState(false)

  async function handleSubmitContentCharacters(ocids: string[]): Promise<void> {
    setIsSubmittingContent(true)
    try {
      await submitContentCharacters(ocids)
    } finally {
      setIsSubmittingContent(false)
    }
  }

  function renderStep(): React.JSX.Element {
    switch (status) {
      case 'awaitingApiKey':
        return (
          <OnboardingStep>
            <ApiKeyForm isSubmitting={false} onSubmit={submitApiKey} />
          </OnboardingStep>
        )

      // 검증(캐릭터 목록 조회)은 보통 1초 미만이라 별도 로딩 문구를 띄우지 않고, 입력 폼을
      // 그대로 유지한 채 제출 버튼만 로딩 스피너로 바꾼다(`docs/features/onboarding.md`).
      case 'verifyingApiKey':
        return (
          <OnboardingStep>
            <ApiKeyForm isSubmitting={true} onSubmit={submitApiKey} />
          </OnboardingStep>
        )

      // [[ADR-016]]: 계정 확정 직후 전체 캐릭터의 정보·일정을 예열하는 동안 보여주는 진행률 화면.
      case 'prefetching': {
        const percent =
          prefetchProgress !== null && prefetchProgress.total > 0
            ? Math.round((prefetchProgress.completed / prefetchProgress.total) * 100)
            : 0
        return (
          <OnboardingStep center>
            {/* [[ADR-061]] 결정 6: 결정형 진행률은 얇은 바 프리미티브 하나 — MapleWaveProgress(물결형)
                폐기. 바가 가로로 늘어나므로 컨테이너 폭을 잡아준다. */}
            <View className="w-full max-w-sm gap-2">
              <Text className="text-sm text-text-muted">
                캐릭터 정보를 준비하고 있어요
                {prefetchProgress !== null
                  ? ` (${prefetchProgress.completed}/${prefetchProgress.total})`
                  : ''}
              </Text>
              <ProgressBar percent={percent} aria={{ now: percent, max: 100 }} />
            </View>
          </OnboardingStep>
        )
      }

      case 'selectingAccount':
        return (
          <OnboardingStep>
            <AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={selectAccount} />
          </OnboardingStep>
        )

      // [[ADR-035]] 결정 13: 예열 후 자동/수동 트래킹 모드를 고르는 단계.
      case 'selectingTrackingMode':
        return (
          <OnboardingStep>
            <TrackingModeStep onSubmit={selectTrackingMode} />
          </OnboardingStep>
        )

      // [[ADR-035]] 결정 13: 컨텐츠 추적 캐릭터를 1명 이상 고르는 단계.
      case 'selectingContentCharacters':
        return (
          <OnboardingStep>
            <ContentCharacterStep
              isSubmitting={isSubmittingContent}
              onSubmit={handleSubmitContentCharacters}
              // [[ADR-086]] 결정 8: 고른 계정에 고를 수 있는 캐릭터가 하나도 없을 때의 유일한
              // 탈출구 — 온보딩 중에는 설정 화면이 없다.
              emptyAction={{
                label: '계정 다시 선택',
                onClick: () => {
                  void restartAccountSelection()
                },
              }}
            />
          </OnboardingStep>
        )

      // [[ADR-035]] 결정 15: 수동 모드 시드가 끝날 때까지 스피너를 보여준다(진행률 숫자 없음 —
      // 템플릿 기본값으로 먼저 그리지 않고 최종 값이 확정될 때까지 로딩만 유지).
      case 'seedingTracking':
        return (
          <OnboardingStep center>
            {/* [[ADR-061]]: 화면 전체 대기라 셸 승계 카드를 씌우지 않는다(뒤에 카드가 오지 않는다).
                24px 이상 자리이므로 스피너는 스윕. */}
            <View className="items-center gap-3" role="status" aria-busy>
              <MapleSweepSpinner size={32} className="text-primary" />
              <Text className="text-sm text-text-muted">체크리스트를 준비하고 있어요</Text>
            </View>
          </OnboardingStep>
        )

      case 'completed':
        return (
          <OnboardingStep>
            <Text className="text-sm text-text-muted">연동이 완료됐습니다.</Text>
          </OnboardingStep>
        )

      case 'error':
        if (accounts.length === 0) {
          return (
            <OnboardingStep>
              <ApiKeyForm isSubmitting={false} onSubmit={submitApiKey} />
            </OnboardingStep>
          )
        }
        return (
          <OnboardingStep>
            {/* [[ADR-083]] 결정 4: 실패는 스토어가 토스트로 알린다 — 목록은 고를 수 있는 상태 그대로 둔다. */}
            <AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={selectAccount} />
          </OnboardingStep>
        )
    }
  }

  // `testID` 는 내비게이션 계약이다 — `RootNavigator` 의 온보딩 분기 테스트가 이 이름으로 "지금 이
  // 화면이 떠 있는가"를 묻는다(자리표시자가 쓰던 `screen-<라우트 이름>` 규약을 그대로 잇는다).
  return (
    <View testID="screen-Onboarding" className="flex-1">
      {renderStep()}
    </View>
  )
}
