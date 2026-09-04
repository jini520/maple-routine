/**
 * 넣은 키가 개발 단계라 안 받았다는 것을 알리고, 서비스 단계 키를 받는 길을 주는 모달.
 *
 * **제목이 낱말을 안 쓴다.** 이 사람은 개발 단계가 무엇인지 모르고 그것을 골랐으므로, 그 말을
 * 돌려주면 무엇이 잘못됐는지가 전달되지 않는다. 먼저 못 쓴다고 말하고, 두 단계는 아래 표에서
 * **같은 축의 두 값**으로 만난다. 뜻을 설명하는 대신 그 자리에 다른 값이 있었다는 사실을 준다.
 *
 * **닫을 수 있다.** 같은 모양의 `ApiKeyNoticeModal` 이 닫히지 않는 것은 뒤에 있는 화면이 이미
 * 제 기능을 못 하기 때문인데, 여기는 뒤에 키 입력 폼이 멀쩡히 서 있어 닫는 것이 곧 다시 넣는
 * 것이다. 그래서 확인이 저장소를 건드리지도 않는다(받지 않은 키라 지울 것이 없다).
 *
 * **왜 못 쓰는지는 안 적는다.** 사용자가 할 일은 다른 키를 받는 것 하나이고, 호출 한도 같은
 * 사정은 그 일을 바꾸지 않는다.
 */
import { Linking, Pressable, View } from 'react-native'

import { useOnboardingStore } from '../../features/onboarding/store'

import { Button, ExternalLinkIcon, KeyRoundIcon, Text } from '../../components/atoms'
import { Modal } from '../../components/organisms/Modal/Modal'
import { GUIDE_URL } from './api-key-links'

export function DevelopmentStageKeyModal(): React.JSX.Element | null {
  const blocked = useOnboardingStore((state) => state.developmentStageBlocked)
  const acknowledge = useOnboardingStore((state) => state.acknowledgeDevelopmentStageKey)

  // falsy 검사인 것이 의도다. 스토어를 부분 모킹한 테스트에서 `undefined` 가 오면 `=== false` 는
  // 모달을 띄운다. 차단 UI 는 켜라고 명시했을 때만 켜지는 쪽이 안전하다.
  if (!blocked) {
    return null
  }

  return (
    // 입력이 없어 키보드를 안 띄우므로 중앙 정렬이다(`ApiKeyNoticeModal` 과 같은 판단).
    <Modal onClose={acknowledge} testId="development-stage-key-overlay" align="center">
      <Modal.Card maxWidth="max-w-xs">
        <View className="gap-5">
          {/* 머리는 가운데 정렬이다. `ApiKeyNoticeModal` 과 같은 골격이라 두 모달이 한 앱에서
              온 것으로 읽힌다. 아래 표만 좌우로 벌어지는데, 그것은 표가 원래 그런 물건이다. */}
          <View className="items-center gap-3">
            {/* 열쇠이되 **붉은 원이 아니다**. 이 자리는 무언가 실패한 곳이 아니라 종류가 다른
                것을 넣은 곳이고, 앱의 빨강은 조회 실패와 삭제가 이미 쓰고 있다. 원이 아니라
                네모인 것은 아래 표와 모서리를 맞춰 둘이 한 덩어리로 읽히게 하려는 것이다. */}
            <View className="h-14 w-14 items-center justify-center rounded-[16px] bg-primary-tint">
              <KeyRoundIcon className="h-7 w-7 text-primary-ink" strokeWidth={1.7} aria-hidden />
            </View>
            <Text
              testID="development-stage-key-title"
              className="text-center text-base font-semibold leading-snug text-text"
            >
              이 키로는 연결할 수 없습니다
            </Text>
          </View>

          {/* 두 줄이 붙어 있어야 두 낱말이 **같은 축의 두 값**으로 읽힌다. 떼어 놓으면 각각이
              따로 선 사실이 되어, 고를 수 있었던 것이라는 관계가 사라진다. */}
          <View className="overflow-hidden rounded-[10px] border border-border">
            <View className="flex-row items-center justify-between gap-2.5 px-3 py-2">
              <Text className="text-xs text-text-muted">넣으신 키</Text>
              <Text className="text-sm font-semibold text-text-muted">개발 단계</Text>
            </View>
            <View className="h-px bg-border" />
            <View className="flex-row items-center justify-between gap-2.5 bg-primary-tint px-3 py-2">
              <Text className="text-xs text-text-muted">필요한 키</Text>
              <Text className="text-sm font-semibold text-primary-ink">서비스 단계</Text>
            </View>
          </View>

          <Text className="text-center text-xs text-text-muted">
            넥슨 오픈 API에서 단계를 ‘서비스 단계’로 골라 키를 새로 발급받은 뒤 입력해주세요.
          </Text>

          {/* **주 동작은 되돌아가는 것이다.** 이 모달은 길을 막고 서 있어 사용자가 바로 할 일이
              폼으로 돌아가는 것이라, 가장 큰 버튼이 앱 밖으로 내보내면 안 된다. 발급 안내는
              도움말이라 폼이 이미 쓰는 인라인 링크와 같은 모양으로 내린다(그 버튼은 모달을 닫으면
              폼 아래에도 그대로 있다).
              
              **링크는 알약 아래여야 한다.** 위 설명 문장 바로 밑에 두면 12px 글자 둘이 한 문단으로
              뭉쳐 누를 수 있는 것으로 안 보인다. 알약이 사이에 서서 그 둘을 갈라 준다. */}
          <View className="items-center gap-3">
            <Button
              variant="primary"
              onPress={acknowledge}
              className="w-full items-center"
              textClassName="text-sm"
            >
              다시 입력하기
            </Button>
            <Pressable
              role="link"
              onPress={() => void Linking.openURL(GUIDE_URL)}
              className="flex-row items-center gap-1"
            >
              <Text className="text-xs text-primary-ink">발급 방법 자세히 보기</Text>
              <ExternalLinkIcon className="h-3 w-3 text-primary-ink" aria-hidden />
            </Pressable>
          </View>
        </View>
      </Modal.Card>
    </Modal>
  )
}
