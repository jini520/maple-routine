// 온보딩 — 앱을 처음 여는 사람은 이 화면만 본다(
// ).
//
// **단계는 라우트가 아니라 `status` switch 다.** 웹과 같고, 그래서 뒤로 갈 UI 가 없다. 잠기면 출구가
// 없다는 뜻이라 이 그 자리에 안내 모달을 얹었다(그 배선은 `ContentCharacterStep` 이
// 갖는다). 화면 목록을 갈아 끼우는 온보딩 분기는 `RootNavigator` 다.
//
// ## 온보딩은 **세 단계**다
//
//   API 키 → 스케줄 관리 방법 → 캐릭터 선택
//
// 계정을 고르는 일이 캐릭터 선택 화면의 드롭다운 안으로 들어갔고, 예열은 **계정을 열
// 때의 자격 판정** 으로 대체됐다(결정 5). 그 둘을 위해 있던 상태·이벤트·모듈은 전부 지웠다 —
// 도달할 수 없는 상태를 남겨 두면 다음 사람이 그리로 가는 길을 찾게 된다.
//
// ## 상태는 core 에 있다. 여기서 다시 만들지 않는다
//
// `src/features/onboarding/store` 가 그대로 산다. 이 파일이 하는 일은 그
// `status` 를 화면에 매핑하는 것과, 웹에 있던 로컬 state 하나(`isSubmittingContent`)를 그대로 두는
// 것뿐이다.
//
// ## 단계 셸(`OnboardingStep`)은 옆 파일에 있다. **한 case 는 스스로 두른다**
//
// 스크롤 뷰·안전영역·인디케이터 색을 그 셸이 갖는다(RN 으로 옮기며 갈린 것 넷이 그 파일 머리에
// 적혀 있다). 캐릭터 선택 단계만 이 switch 가 셸을 안 두르는데, 그 단계는 CTA 를 **고정 바**로
// 넘겨야 하고 바의 활성 조건이 `useCharacterManage` 안에 있어 **그 훅을 부르는
// 컴포넌트가 스크롤과 바 둘 다의 조상**이어야 하기 때문이다. 훅은 조건부로 못 부르므로 그 자리를
// 이 화면으로 올릴 수 없다. 올리면 키 입력 단계부터 로스터 조회가 돈다.
import { useState } from 'react'
import { View } from 'react-native'

import { useOnboardingStore } from '../../features/onboarding/store'
import {
  clearRepresentativeCharacter,
  setRepresentativeCharacter,
} from '../../storage/character-selection'

import { MapleSweepSpinner, Text } from '../../components/atoms'
import { ApiKeyForm } from './ApiKeyForm'
import { ContentCharacterStep } from './ContentCharacterStep'
import { OnboardingStep } from './OnboardingStep'
import { TrackingModeStep } from './TrackingModeStep'

export function OnboardingScreen(): React.JSX.Element {
  const { status, submitApiKey, selectTrackingMode, submitContentCharacters } = useOnboardingStore()
  // 컨텐츠 캐릭터 저장(setTrackedCharacterOcids)이 끝나 다음 상태로 전이하기 전까지의 짧은
  // 구간 동안 CTA를 스피너로 바꿔 중복 누름을 막는다. 전용 status가 없어 로컬 상태로 다룬다.
  const [isSubmittingContent, setIsSubmittingContent] = useState(false)

  async function handleSubmitContentCharacters(
    ocids: string[],
    representativeOcid: string | null,
  ): Promise<void> {
    setIsSubmittingContent(true)
    try {
      await submitContentCharacters(ocids)
      // **대표는 목록 뒤에 쓴다**. `setTrackedCharacterOcids` 의 참조 무결성이 목록에 없는 대표를
      // 지우므로, 순서를 뒤집으면 방금 고른 대표가 지워진다(`SettingsCharactersScreen` 과 같은 순서).
      //
      // 실패는 삼킨다: 여기 도달했다는 것은 목록이 이미 저장돼 **온보딩이 끝났다**는 뜻이고, 대표는
      // 표식뿐이라 없어도 화면이 성립한다. 되던지면 호출부가 `void` 라 미처리
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
      // 두 상태가 같은 화면인 것은 우연이 아니다. 이 앱에서 **키 입력 앞뒤로 갈 수 있는 곳이 그
      // 자리 하나**다.
      //
      // ① `awaitingApiKey`. 첫 화면.
      // ② `error`. 실패는 스토어가 토스트로 알린다. 계정 목록이라는 것이
      //  없으므로 그릴 수 있는 것이 폼 하나다. **출구 없는 흰 화면을 만들지
      //  않는다**. 이 없앤 잠금과 같은 얼굴이고, 그때 통한 처방도 "키를 다시 넣는
      //    것" 하나였다.
      case 'awaitingApiKey':
      case 'error':
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

      // : 스케줄 관리 방법(자동/수동)을 고르는 단계 — 이 앱에서는 키 입력 **다음**
      // 이다(예열이 없어졌다).
      case 'selectingTrackingMode':
        return (
          <OnboardingStep>
            <TrackingModeStep onSubmit={selectTrackingMode} />
          </OnboardingStep>
        )

      //  ·: 관리할 캐릭터를 1개 이상 고르는 단계 — 계정 드롭다운이
      // 그 안에 있어 여러 메이플 ID 를 넘나든다.
      // **이 case 만 셸을 안 두른다**(파일 머리). 단계가 자기 CTA 를 고정 바로 넘기려고 셸을
      // 직접 두르고, 끌기 자동 스크롤 배선도 함께 갖는다.
      case 'selectingContentCharacters':
        return (
          <ContentCharacterStep
            isSubmitting={isSubmittingContent}
            onSubmit={(ocids, representativeOcid) => {
              void handleSubmitContentCharacters(ocids, representativeOcid)
            }}
          />
        )

      // : 수동 모드 시드가 끝날 때까지 스피너를 보여준다(진행률 숫자 없음 —
      // 템플릿 기본값으로 먼저 그리지 않고 최종 값이 확정될 때까지 로딩만 유지).
      case 'seedingTracking':
        return (
          <OnboardingStep center>
            {/*: 화면 전체 대기라 셸 승계 카드를 씌우지 않는다(뒤에 카드가 오지 않는다).
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

  // `testID` 는 내비게이션 계약이다. `RootNavigator` 의 온보딩 분기 테스트가 이 이름으로 "지금 이
  // 화면이 떠 있는가"를 묻는다(자리표시자가 쓰던 `screen-<라우트 이름>` 규약을 그대로 잇는다).
  return (
    <View testID="screen-Onboarding" className="flex-1">
      {renderStep()}
    </View>
  )
}
