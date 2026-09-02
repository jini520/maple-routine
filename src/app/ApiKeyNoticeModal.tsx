// 저장된 키로는 앞으로 갈 수 없게 된 것을 **알리고 확인을 받는** 모달.
//
// 결정 1 의 "토스트 + 즉시 이동"을 대체한다. 즉시 이동은 사용자가 이유를 읽기도 전에 화면을
// 바꿔버려, 원인과 결과가 이어지지 않았다. 토스트는 스스로 사라지기까지 한다. 이제 원래 화면이
// 뒤에 남은 채 이 모달이 덮이고, 사용자가 "확인"을 눌러야 이동한다.
//
// 429(호출 한도 초과)가 이 사슬을 **그대로** 탄다. 원인은 달라도 처방이 같기
// 때문이다(저장된 키로는 앞으로 갈 수 없고, 사용자가 새 키를 넣어야 한다). 그래서 새 알림 UI 를
// 만들지 않고 **문구만** 갈린다.
//
// **닫을 수 없다**: `onClose` 가 no-op 이라 오버레이를 눌러도 닫히지 않고, 취소 버튼도 없다.
// 두 원인 모두 그 상태에서는 어느 화면도 제 기능을 못 하므로 **닫아서 돌아갈 곳이 없다**.
//
// ── RN 으로 옮기며 갈린 것 넷 ─────────────────────────────────────────────────────
//
// ① **"확인"을 누르면 실제로 화면이 바뀌는 경로는 그대로다.** `confirmApiKeyNotice()` 가 저장된
//    `apiKey` 를 지우고 온보딩 상태를 `awaitingApiKey` 로 되돌리면, `RootNavigator` 가 **화면 목록
//    자체를 갈아 끼워**(3-2단계) 온보딩만 남는다. 웹은 라우트 가드가 `/onboarding` 으로 보냈고
//  RN 은 갈 곳이 그것뿐이 된다. 계약은 같고 수단이 다르다.
// ② `space-y-*` → `gap-*`(NativeWind 에 형제 간격 유틸이 없다).
// ③ `text-center` 는 **컨테이너가 아니라 각 `Text`** 가 갖는다. RN 은 글자 스타일이 상속되지 않는다.
// ④ 확인 버튼이 `Button` atom 이 됐다. 웹의 클래스 문자열
//    (`rounded-full bg-primary text-on-primary font-semibold px-5 py-2.5 text-sm`)에서 `hover:` 만
//    빠지고 나머지는 `primary` 변형이 그대로 갖는다. 웹이 `text-sm` 으로 줄여 쓰던 것만
//    `textClassName` 으로 옮긴다(atom 기본은 `text-base`).
import { View } from 'react-native'

import { useOnboardingStore } from '../features/onboarding/store'
import type { ApiKeyNoticeKind } from '../features/onboarding/state'

import { Button, GaugeIcon, KeyRoundIcon, Text } from '../components/atoms'
import { Modal } from '../components/organisms/Modal/Modal'

interface NoticeCopy {
  icon: typeof KeyRoundIcon
  title: string
  body: string
}

const NOTICE_COPY: Record<ApiKeyNoticeKind, NoticeCopy> = {
  // 다음에 무슨 일이 일어나는지 먼저 말한다. 확인을 누르면 화면이 바뀌기 때문이다.
  invalid: {
    icon: KeyRoundIcon,
    title: 'API 키가 더 이상 유효하지 않습니다',
    body: '키 입력 화면으로 이동합니다.',
  },
  // 429 본문은 **처방까지** 담는다. 같은 실패의 토스트 문구(`호출 한도를 초과했습니다` 한 줄)와
  // 갈리는 것이 의도다. 토스트는 한 줄이 상한이지만 모달은 줄바꿈이 되므로, "자리마다 담을 수
  // 있는 만큼" 기준이 여기서는 담는 쪽으로 나온다. 문구가 키의 단계를 판정하지
  // 않고 안내만 하는 것은 그대로다.
  rateLimited: {
    icon: GaugeIcon,
    title: '호출 한도를 초과했습니다',
    body: '서비스 단계 키로 다시 입력해주세요.',
  },
}

export function ApiKeyNoticeModal(): React.JSX.Element | null {
  const apiKeyNotice = useOnboardingStore((state) => state.apiKeyNotice)
  const confirmApiKeyNotice = useOnboardingStore((state) => state.confirmApiKeyNotice)

  // falsy 검사인 것이 의도다. `=== null` 이면 스토어를 부분 모킹한 테스트에서 `undefined` 가 와
  // **모든 화면 위에 닫을 수 없는 모달이 떠버린다**(웹에서 실제로 그렇게 깨졌다). 차단 UI 는
  // "켜라고 명시했을 때만" 켜지는 쪽이 안전하다.
  if (!apiKeyNotice) {
    return null
  }

  const { icon: Icon, title, body } = NOTICE_COPY[apiKeyNotice]

  return (
    // 입력이 없어 키보드를 띄우지 않으므로 중앙 정렬이다(UpdatePromptModal 과 같은 판단).
    <Modal onClose={() => {}} testId="api-key-notice-overlay" align="center">
      <Modal.Card maxWidth="max-w-xs">
        <View className="gap-5">
          {/* 톤은 두 원인 모두 `error` 다. 429 도 어미 규칙상 실패(`~습니다`)이고
              error-resilience.md 의 실패 표에 함께 서 있다. 아이콘만 원인을 가리킨다:
              무효 키는 `KeyRound`, 한도 초과는 계기판(`Gauge`) — 시간이 지나면 풀린다는 뜻이
              읽히는 타이머 계열은 처방(키 단계 확인)과 어긋나 고르지 않았다. */}
          <View className="mx-auto h-14 w-14 items-center justify-center rounded-full bg-error-tint">
            <Icon className="h-7 w-7 text-error-ink" strokeWidth={1.75} aria-hidden />
          </View>
          <View className="gap-2">
            <Text className="text-center text-base font-semibold text-text">{title}</Text>
            <Text className="text-center text-sm text-text-muted">{body}</Text>
          </View>
          <Button
            variant="primary"
            onPress={() => void confirmApiKeyNotice()}
            className="w-full items-center"
            textClassName="text-sm"
          >
            확인
          </Button>
        </View>
      </Modal.Card>
    </Modal>
  )
}
