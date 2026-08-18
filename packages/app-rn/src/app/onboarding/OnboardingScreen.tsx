// 온보딩 — 앱을 처음 여는 사람이 보는 유일한 화면([[ADR-016]] · [[ADR-035]] · [[ADR-061]] ·
// [[ADR-083]] · [[ADR-086]]).
//
// **단계는 라우트가 아니라 `status` switch 다.** 웹과 같고, 그래서 뒤로 갈 UI 가 없다 — 잠기면 출구가
// 없다는 뜻이라 [[ADR-116]] 이 그 자리에 안내 모달을 얹었다(그 배선은 `ContentCharacterStep` 이
// 갖는다). 화면 목록을 갈아 끼우는 온보딩 분기는 `RootNavigator` 다.
//
// ## 이 앱의 온보딩은 **세 단계**다 ([[ADR-143]] 결정 1)
//
//   웹뷰(Capacitor)   API 키 → 계정 선택 → 예열 → 스케줄 관리 방법 → 캐릭터 선택
//   RN               API 키 →                     스케줄 관리 방법 → 캐릭터 선택
//
// 계정을 고르는 일이 캐릭터 선택 화면의 드롭다운 안으로 들어갔고([[ADR-144]]), 예열([[ADR-016]])은
// «계정을 열 때의 자격 판정» 으로 대체됐다(결정 5). 그래서 `selectingAccount`·`prefetching` 은 이
// 앱에서 **도달할 수 없는 상태**다 — 두 흐름이 갈리는 자리는 core 의 계정 범위 플래그 하나이고
// (`features/onboarding/flow.ts`, `boot.ts` 가 `'all'` 을 넣는다) 리듀서·상태 이름은 그대로다.
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
//    같은 뜻을 내는 것이 `flexGrow` 다. 그 공간을 쓰는 자리는 `seedingTracking` 의 `justify-center` 다.
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
import {
  clearRepresentativeCharacter,
  setRepresentativeCharacter,
} from '@core/storage/character-selection'

import { MapleSweepSpinner } from '../../components/atoms/MapleSweepSpinner/MapleSweepSpinner'
import { useReorderScroll } from '../../components/organisms/CharacterManage/use-reorder-scroll'
import { useBottomSafeAreaPx } from '../../lib/bottom-safe-area'
import { useScrollIndicatorStyle } from '../../theme/context'
import { ApiKeyForm } from './ApiKeyForm'
import { ContentCharacterStep } from './ContentCharacterStep'
import { TrackingModeStep } from './TrackingModeStep'

/**
 * 단계 하나가 놓이는 자리 — 웹 `OnboardingScreen` 의 컨테이너 `<div>` 세 모양을 하나로 합친 것.
 *
 * `center` 가 곧 웹의 `items-center justify-center` 이고(전체 대기 두 자리), 아닌 자리는 `pt-8 pb-4`
 * 로 위에서부터 그린다. 두 모양 모두 `flexGrow: 1` 을 갖는 이유는 파일 머리 ②.
 */
// `props` 를 통째로 받지 않고 **구조 분해**하는 것이 계약이다 — `react-hooks/refs` 는 ref 를 품은
// 객체를 렌더 중에 읽는 것을 통째로 막으므로, `props.center` 처럼 다른 필드를 읽는 자리까지 전부
// 걸린다(`ScreenScroll`·`CharacterManageBody` 도 같은 이유로 구조 분해한다).
function OnboardingStep({
  center,
  scrollRef,
  onScroll,
  children,
}: {
  center?: boolean
  /** 끌기 자동 스크롤 배선([[ADR-144]] 결정 5) — 캐릭터 선택 단계에서만 온다. */
  scrollRef?: React.Ref<ScrollView>
  onScroll?: React.ComponentProps<typeof ScrollView>['onScroll']
  children: React.ReactNode
}): React.JSX.Element {
  const insets = useSafeAreaInsets()
  // **위아래가 갈린다.** 상단은 [[ADR-139]] 결정 2 대로 인셋 그대로다 — 단계에 제목 줄이 없어 그
  // `marginTop` 은 헤더 여백이 아니라 콘텐츠 여백이라 축이 다르다. 하단은 반대로 «탭바 없는 화면의
  // 규칙»(아래) 그 자체라, 하한이 깔린 값을 본다([[ADR-132]] 정정 31).
  const bottomSafeAreaPx = useBottomSafeAreaPx()
  const indicatorStyle = useScrollIndicatorStyle()

  return (
    <ScrollView
      testID="onboarding-scroll"
      ref={scrollRef}
      indicatorStyle={indicatorStyle}
      className="flex-1"
      // 파일 머리 ③ — 마진이지 패딩이 아니다. 하단은 홈 인디케이터 자리라 콘텐츠 여백으로 남긴다
      // (탭바가 없는 화면의 규칙 — `ScreenScroll` 의 `bottom-inset.ts` 와 같은 갈래다).
      style={{ marginTop: insets.top }}
      contentContainerClassName={
        center === true ? 'items-center justify-center px-4' : 'px-4 pt-8 pb-4'
      }
      contentContainerStyle={{ flexGrow: 1, paddingBottom: bottomSafeAreaPx }}
      // 키보드가 떠 있는 동안에도 첫 탭이 버튼에 닿는다 — 없으면 그 탭이 키보드를 내리는 데만 쓰인다
      // (`ApiKeyForm` 의 확인 버튼이 그 자리다). 웹에서는 없던 문제라 짝이 없는 프롭이다.
      keyboardShouldPersistTaps="handled"
      // iOS 는 키보드가 떠도 스크롤 뷰 크기가 그대로라 확인 버튼이 가려질 수 있다(안드로이드는 창이
      // `adjustResize` 로 줄어 저절로 해결된다). 그 인셋을 OS 가 넣게 한다 — 안드로이드에서는 no-op.
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      // 조건부 전개다 — 안 쓰는 단계의 스크롤 뷰 프롭을 한 개도 바꾸지 않는다(`ScreenScroll` 과
      // 같은 처리: `onScroll={undefined}` 로 넘기면 iOS 가 기본 주기로 이벤트를 흘린다).
      {...(onScroll === undefined ? null : { onScroll, scrollEventThrottle: 16 })}
    >
      {children}
    </ScrollView>
  )
}

export function OnboardingScreen(): React.JSX.Element {
  const { status, submitApiKey, selectTrackingMode, submitContentCharacters } = useOnboardingStore()
  // 컨텐츠 캐릭터 저장(setTrackedCharacterOcids)이 끝나 다음 상태로 전이하기 전까지의 짧은
  // 구간 동안 CTA를 스피너로 바꿔 중복 누름을 막는다 — 전용 status가 없어 로컬 상태로 다룬다.
  const [isSubmittingContent, setIsSubmittingContent] = useState(false)
  // 캐릭터 선택 단계의 끌기가 페이지를 굴린다([[ADR-144]] 결정 5). 스크롤 뷰를 가진 것이 이
  // 화면이라 배선도 여기 있다 — 설정 하위 페이지가 `ScreenScroll` 에 같은 두 값을 거는 것과 같다.
  const { scrollRef, onScroll, scroll } = useReorderScroll()

  async function handleSubmitContentCharacters(
    ocids: string[],
    representativeOcid: string | null,
  ): Promise<void> {
    setIsSubmittingContent(true)
    try {
      await submitContentCharacters(ocids)
      // **대표는 목록 뒤에 쓴다** — `setTrackedCharacterOcids` 의 참조 무결성이 목록에 없는 대표를
      // 지우므로, 순서를 뒤집으면 방금 고른 대표가 지워진다(`SettingsCharactersScreen` 과 같은 순서).
      //
      // 실패는 삼킨다: 여기 도달했다는 것은 목록이 이미 저장돼 **온보딩이 끝났다**는 뜻이고, 대표는
      // 표식뿐이라 없어도 화면이 성립한다([[ADR-143]] 결정 4). 되던지면 호출부가 `void` 라 미처리
      // rejection 이 되고, 사용자에게 돌아가는 것은 그래도 없다.
      await (representativeOcid === null
        ? clearRepresentativeCharacter()
        : setRepresentativeCharacter(representativeOcid)
      ).catch(() => {})
    } finally {
      setIsSubmittingContent(false)
    }
  }

  function renderStep(): React.JSX.Element {
    switch (status) {
      // 네 상태가 같은 화면인 것은 우연이 아니다 — 이 앱에서 **키 입력 앞뒤로 갈 수 있는 곳이 그
      // 자리 하나**다.
      //
      // ① `awaitingApiKey` — 첫 화면.
      // ② `error` — 실패는 스토어가 토스트로 알린다([[ADR-083]] 결정 4). 웹뷰 앱은 `accounts` 가
      //    남아 있으면 계정 목록을 그렸지만, 이 앱에는 그 목록 자체가 없다([[ADR-143]] 결정 1).
      // ③④ `selectingAccount`·`prefetching` — **도달할 수 없는 상태**다(파일 머리). case 를 지우지
      //    않는 것은 리듀서를 안 고쳤기 때문이고([[ADR-143]] 결정 8), 빈 화면 대신 폼을 두는 것은
      //    `submitApiKey` 의 방어 분기(저장 직후 `getAuthConfig()` 가 `null` 이면 `API_KEY_VERIFIED`)
      //    가 이 자리에 닿을 수 있어서다. **출구 없는 흰 화면을 만들지 않는다** — [[ADR-116]] 이
      //    없앤 잠금과 같은 얼굴이고, 그때 실제로 통한 처방도 "키를 다시 넣는 것" 하나였다.
      case 'awaitingApiKey':
      case 'error':
      case 'selectingAccount':
      case 'prefetching':
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

      // [[ADR-035]] 결정 13: 스케줄 관리 방법(자동/수동)을 고르는 단계 — 이 앱에서는 키 입력 **다음**
      // 이다(예열이 없어졌다, [[ADR-143]] 결정 5).
      case 'selectingTrackingMode':
        return (
          <OnboardingStep>
            <TrackingModeStep onSubmit={selectTrackingMode} />
          </OnboardingStep>
        )

      // [[ADR-035]] 결정 13 · [[ADR-144]]: 관리할 캐릭터를 1개 이상 고르는 단계 — 계정 드롭다운이
      // 그 안에 있어 여러 메이플 ID 를 넘나든다([[ADR-143]] 결정 1).
      case 'selectingContentCharacters':
        return (
          <OnboardingStep scrollRef={scrollRef} onScroll={onScroll}>
            <ContentCharacterStep
              isSubmitting={isSubmittingContent}
              onSubmit={(ocids, representativeOcid) => {
                void handleSubmitContentCharacters(ocids, representativeOcid)
              }}
              scroll={scroll}
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
