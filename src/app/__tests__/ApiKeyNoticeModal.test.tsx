// 웹판 넷을 옮겼다(`app-capacitor/src/app/__tests__/ApiKeyNoticeModal.test.tsx`). 갈린 것 둘.
//
// · 스토어를 **모킹하지 않고 `setState` 로 몬다** — 이 패키지의 관례다(`RootNavigator.test.tsx`).
//   실물 리듀서를 쓰므로 `apiKeyNotice` 가 실제로 그 값을 가질 수 있는지까지 함께 검사된다.
//   `confirmApiKeyNotice` 만 갈아 끼운다(실물은 저장소를 만지고, 여기서는 **불렸는가**가 계약이다).
// · `getAllByRole('button')` → RN 에서는 `Modal` 오버레이 자체가 `Pressable` 이라 버튼 수를 세면
//   자리마다 값이 달라진다. 대신 **닫기 수단이 없다**는 사실을 직접 본다(오버레이를 눌러도
//   확인이 안 불리고 화면이 그대로다).
import { fireEvent } from '@testing-library/react-native'

import { useOnboardingStore } from '../../features/onboarding/store'
import type { ApiKeyNoticeKind } from '../../features/onboarding/state'

import { renderOverlay } from '../../components/__tests__/render-atom'
import { ApiKeyNoticeModal } from '../ApiKeyNoticeModal'

// ADR-116 결정 1 의 문구 표를 그대로 옮긴 것이다 — 이 배열이 계약이고, 웹판 테스트가 같은 문자열을
// 단언한다. 두 원인이 같은 문구로 합쳐지면 여기서 먼저 깨진다.
const CASES: ReadonlyArray<{ kind: ApiKeyNoticeKind; title: string; body: string }> = [
  {
    kind: 'invalid',
    title: 'API 키가 더 이상 유효하지 않습니다',
    body: '키 입력 화면으로 이동합니다.',
  },
  {
    kind: 'rateLimited',
    title: '호출 한도를 초과했습니다',
    body: '서비스 단계 키로 다시 입력해주세요.',
  },
]

let confirmApiKeyNotice: jest.Mock

beforeEach(() => {
  confirmApiKeyNotice = jest.fn(async () => {})
  useOnboardingStore.setState({ apiKeyNotice: null, confirmApiKeyNotice })
})

describe('ApiKeyNoticeModal', () => {
  it('알림이 꺼져 있으면 아무것도 그리지 않는다', async () => {
    const { queryByTestId } = await renderOverlay(<ApiKeyNoticeModal />)

    expect(queryByTestId('api-key-notice-overlay')).toBeNull()
  })

  describe.each(CASES)('$kind', ({ kind, title, body }) => {
    beforeEach(() => {
      useOnboardingStore.setState({ apiKeyNotice: kind })
    })

    // 원인마다 다른 말을 해야 한다 — 무효 키는 "다음에 무슨 일이 일어나는가"를, 429 는 처방을
    // 말한다(— 모달은 줄바꿈이 되므로 처방까지 담는 자리다).
    it('원인에 맞는 제목과 본문을 그린다', async () => {
      const { getByText } = await renderOverlay(<ApiKeyNoticeModal />)

      expect(getByText(title)).toBeTruthy()
      expect(getByText(body)).toBeTruthy()
    })

    // 사용자가 이유를 인지하고 넘어가도록 확인을 강제한다 — 확인 전에는 이동도 삭제도 없다.
    it('확인을 눌러야 이동이 일어난다', async () => {
      const { getByText } = await renderOverlay(<ApiKeyNoticeModal />)
      expect(confirmApiKeyNotice).not.toHaveBeenCalled()

      await fireEvent.press(getByText('확인'))

      expect(confirmApiKeyNotice).toHaveBeenCalledTimes(1)
    })

    // 닫을 수 없어야 한다: 저장된 키로는 앞으로 갈 수 없으므로 닫아서 돌아갈 곳이 없다.
    // 429 도 마찬가지다(— 사용자 확정).
    it('오버레이를 눌러도 닫히지 않는다', async () => {
      const { getByText, getByTestId } = await renderOverlay(<ApiKeyNoticeModal />)

      await fireEvent.press(getByTestId('api-key-notice-overlay'))

      expect(getByText(title)).toBeTruthy()
      expect(confirmApiKeyNotice).not.toHaveBeenCalled()
    })

    // RN 에서만 물을 수 있는 것 — 안드로이드 시스템 뒤로가기도 닫기다(후반).
    // `onClose` 가 no-op 이므로 아무 일도 일어나지 않아야 한다.
    it('안드로이드 뒤로가기로도 닫히지 않는다', async () => {
      const { getByText, getByTestId } = await renderOverlay(<ApiKeyNoticeModal />)

      await fireEvent(getByTestId('api-key-notice-overlay-modal'), 'requestClose')

      expect(getByText(title)).toBeTruthy()
      expect(confirmApiKeyNotice).not.toHaveBeenCalled()
    })
  })

})
