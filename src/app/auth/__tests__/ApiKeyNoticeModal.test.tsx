// API 키 안내 모달. 갈린 것 둘.
//
// 스토어를 **모킹하지 않고 `setState` 로 몬다**. 이 패키지의 관례다(`RootNavigator.test.tsx`).
//   실물 리듀서를 쓰므로 `apiKeyNotice` 가 실제로 그 값을 가질 수 있는지까지 함께 검사된다.
//   `confirmApiKeyNotice` 만 갈아 끼운다(실물은 저장소를 만지고, 여기서는 **불렸는가**가 계약이다).
// `getAllByRole('button')` → RN 에서는 `Modal` 오버레이 자체가 `Pressable` 이라 버튼 수를 세면
//   자리마다 값이 달라진다. 대신 **닫기 수단이 없다**는 사실을 직접 본다(오버레이를 눌러도
//   확인이 안 불리고 화면이 그대로다).
import { fireEvent, waitFor } from '@testing-library/react-native'

import { useAuthStore } from '../../../features/auth/store'
import type { ApiKeyNoticeKind } from '../../../features/auth/state'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { ApiKeyNoticeModal } from '../ApiKeyNoticeModal'

// 모달이 띄우는 문구 표를 그대로 옮긴 것이다. 이 배열이 계약이고, 같은 문자열을 화면도
// 단언한다. 두 원인이 같은 문구로 합쳐지면 여기서 먼저 깨진다.
const CASES: ReadonlyArray<{ kind: ApiKeyNoticeKind; title: string; body: string }> = [
  {
    kind: 'invalid',
    title: 'API 키가 더 이상 유효하지 않습니다',
    body: '키 입력 화면으로 이동합니다.',
  },
]

let confirmApiKeyNotice: jest.Mock
let invalidKeyDestination: jest.Mock

beforeEach(() => {
  confirmApiKeyNotice = jest.fn(async () => {})
  invalidKeyDestination = jest.fn(async () => 'signIn')
  useAuthStore.setState({ apiKeyNotice: null, confirmApiKeyNotice, invalidKeyDestination })
})

describe('ApiKeyNoticeModal', () => {
  it('알림이 꺼져 있으면 아무것도 그리지 않는다', async () => {
    const { queryByTestId } = await renderOverlay(<ApiKeyNoticeModal />)

    expect(queryByTestId('api-key-notice-overlay')).toBeNull()
  })

  describe.each(CASES)('$kind', ({ kind, title, body }) => {
    beforeEach(() => {
      useAuthStore.setState({ apiKeyNotice: { kind, apiKey: null } })
    })

    // 원인마다 다른 말을 해야 한다. 무효 키는 "다음에 무슨 일이 일어나는가"를, 429 는 처방을
    // 말한다(모달은 줄바꿈이 되므로 처방까지 담는 자리다).
    it('원인에 맞는 제목과 본문을 그린다', async () => {
      const { findByText, getByText } = await renderOverlay(<ApiKeyNoticeModal />)

      expect(await findByText(title)).toBeTruthy()
      expect(getByText(body)).toBeTruthy()
    })

    // 사용자가 이유를 인지하고 넘어가도록 확인을 강제한다. 확인 전에는 이동도 삭제도 없다.
    it('확인을 눌러야 이동이 일어난다', async () => {
      const { findByText } = await renderOverlay(<ApiKeyNoticeModal />)
      expect(confirmApiKeyNotice).not.toHaveBeenCalled()

      await fireEvent.press(await findByText('확인'))

      expect(confirmApiKeyNotice).toHaveBeenCalledTimes(1)
    })

    // 닫을 수 없어야 한다: 저장된 키로는 앞으로 갈 수 없으므로 닫아서 돌아갈 곳이 없다.
    it('오버레이를 눌러도 닫히지 않는다', async () => {
      const { getByText, findByTestId } = await renderOverlay(<ApiKeyNoticeModal />)

      await fireEvent.press(await findByTestId('api-key-notice-overlay'))

      expect(getByText(title)).toBeTruthy()
      expect(confirmApiKeyNotice).not.toHaveBeenCalled()
    })

    // RN 에서만 물을 수 있는 것. 안드로이드 시스템 뒤로가기도 닫기다(후반).
    // `onClose` 가 no-op 이므로 아무 일도 일어나지 않아야 한다.
    it('안드로이드 뒤로가기로도 닫히지 않는다', async () => {
      const { getByText, findByTestId } = await renderOverlay(<ApiKeyNoticeModal />)

      await fireEvent(await findByTestId('api-key-notice-overlay-modal'), 'requestClose')

      expect(getByText(title)).toBeTruthy()
      expect(confirmApiKeyNotice).not.toHaveBeenCalled()
    })
  })

  // 확인을 누르면 화면이 바뀌므로 갈 곳을 먼저 말한다. 부계정 키는 지우지 않고 그 키의 캐릭터만 추적에서 뺀다.
  it.each([
    ['accounts', '이 키의 캐릭터를 추적에서 빼고 계정 관리로 이동합니다.'],
    ['characterSetup', '이 키의 캐릭터를 추적에서 빼고 캐릭터 설정으로 이동합니다.'],
  ])('무효 키의 본문은 확인 뒤 가는 곳(%s)을 말한다', async (destination, body) => {
    invalidKeyDestination.mockResolvedValue(destination)
    useAuthStore.setState({ apiKeyNotice: { kind: 'invalid', apiKey: '부-키' } })

    const { findByText } = await renderOverlay(<ApiKeyNoticeModal />)

    expect(await findByText(body)).toBeTruthy()
    await waitFor(() => expect(invalidKeyDestination).toHaveBeenCalledWith('부-키'))
  })
})
