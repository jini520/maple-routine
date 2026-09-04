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
 *
 * 배치는 `organisms/NoticeModal` 이 갖는다. 이 파일이 정하는 것은 아이콘 · 톤 · 문구와 아래
 * 단계 표뿐이다.
 */
import { Linking, View } from 'react-native'

import { useAuthStore } from '../../features/auth/store'

import { KeyRoundIcon, Text } from '../../components/atoms'
import { NoticeModal } from '../../components/organisms/NoticeModal/NoticeModal'
import { GUIDE_URL } from './api-key-links'

/**
 * 넣은 키와 필요한 키를 마주 세우는 두 줄 표.
 *
 * **두 줄이 붙어 있어야** 두 낱말이 같은 축의 두 값으로 읽힌다. 떼어 놓으면 각각이 따로 선
 * 사실이 되어, 고를 수 있었던 것이라는 관계가 사라진다.
 */
function KeyStageTable(): React.JSX.Element {
  return (
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
  )
}

export function DevelopmentStageKeyModal(): React.JSX.Element | null {
  const blocked = useAuthStore((state) => state.developmentStageBlocked)
  const acknowledge = useAuthStore((state) => state.acknowledgeDevelopmentStageKey)

  // falsy 검사인 것이 의도다. 스토어를 부분 모킹한 테스트에서 `undefined` 가 오면 `=== false` 는
  // 모달을 띄운다. 차단 UI 는 켜라고 명시했을 때만 켜지는 쪽이 안전하다.
  if (!blocked) {
    return null
  }

  return (
    // 열쇠이되 **붉은 원이 아니다**(`tone="primary"`). 이 자리는 무언가 실패한 곳이 아니라 종류가
    // 다른 것을 넣은 곳이고, 앱의 빨강은 조회 실패와 삭제가 이미 쓰고 있다.
    //
    // **주 동작은 되돌아가는 것이다.** 이 모달은 길을 막고 서 있어 사용자가 바로 할 일이 폼으로
    // 돌아가는 것이라, 가장 큰 버튼이 앱 밖으로 내보내면 안 된다. 발급 안내는 도움말이라 링크로
    // 내린다. 그 버튼은 모달을 닫으면 폼 아래에도 그대로 있다.
    <NoticeModal
      icon={KeyRoundIcon}
      tone="primary"
      title="이 키로는 연결할 수 없습니다"
      titleTestId="development-stage-key-title"
      content={<KeyStageTable />}
      description="넥슨 오픈 API에서 단계를 ‘서비스 단계’로 골라 키를 새로 발급받은 뒤 입력해주세요."
      action={{ label: '다시 입력하기', onPress: acknowledge }}
      link={{
        label: '발급 방법 자세히 보기',
        onPress: () => void Linking.openURL(GUIDE_URL),
      }}
      onClose={acknowledge}
      testId="development-stage-key-overlay"
    />
  )
}
