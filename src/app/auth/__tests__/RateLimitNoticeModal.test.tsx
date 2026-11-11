// 429 다시 시도 모달. 키를 지우지 않고, 다시 부를지 다른 키를 넣을지 사용자가 고른다.
//
// 스토어를 모킹하지 않고 `setState` 로 몬다. 동작 셋(`retryRateLimitNotice` · `rateLimitedKeyRole` · `replaceMainApiKey`)만
// 갈아 끼운다. 실물은 저장소를 만지고, 여기서는 불렸는가와 무엇을 그리는가가 계약이다.
jest.mock('../../../native/browser', () => ({ openInAppBrowser: jest.fn() }))
jest.mock('../../../features/refresh/pull', () => ({ pullRefresh: jest.fn(async () => undefined) }))

import { fireEvent, waitFor } from '@testing-library/react-native'

import { useAuthStore } from '../../../features/auth/store'
import { renderOverlay } from '../../../components/__tests__/render-atom'
import { ApiKeyNoticeModal } from '../ApiKeyNoticeModal'
import { GUIDE_URL } from '../api-key-links'
import { keepWords } from '../../../lib/keep-words'

const { openInAppBrowser } = jest.requireMock('../../../native/browser') as Record<string, jest.Mock>
const { pullRefresh } = jest.requireMock('../../../features/refresh/pull') as Record<string, jest.Mock>

let retryRateLimitNotice: jest.Mock
let rateLimitedKeyRole: jest.Mock
let replaceMainApiKey: jest.Mock

function notice(attempt: number, role: 'main' | 'sub' | null = 'main'): void {
  rateLimitedKeyRole.mockResolvedValue(role)
  useAuthStore.setState({ apiKeyNotice: { kind: 'rateLimited', apiKey: 'key-1', attempt } })
}

beforeEach(() => {
  jest.clearAllMocks()
  retryRateLimitNotice = jest.fn(() => useAuthStore.setState({ apiKeyNotice: null }))
  rateLimitedKeyRole = jest.fn()
  replaceMainApiKey = jest.fn(async () => 'replaced')
  useAuthStore.setState({
    apiKeyNotice: null,
    developmentStageBlocked: false,
    retryRateLimitNotice,
    rateLimitedKeyRole,
    replaceMainApiKey,
  })
})

describe('429 다시 시도 모달', () => {
  it('제목 아래 설명 없이, 안내 칸 둘과 발급 방법 링크를 그린다', async () => {
    notice(1)
    const { getByText, queryByText } = await renderOverlay(<ApiKeyNoticeModal />)

    expect(getByText('호출 한도를 초과했습니다')).toBeTruthy()
    expect(getByText(keepWords('서비스 단계 키인지 확인해주세요'))).toBeTruthy()
    expect(getByText(keepWords('개발 단계 키라면 넥슨 오픈 API에서 ‘서비스 단계’ 키를 새로 발급받아 입력해주세요.'))).toBeTruthy()
    expect(queryByText('서비스 단계 키로 다시 입력해주세요.')).toBeNull()

    await fireEvent.press(getByText('API 키 발급 방법 보기'))
    expect(openInAppBrowser).toHaveBeenCalledWith(GUIDE_URL)
  })

  // 첫 429 는 잠깐 몰린 것일 수 있어 다시 부르기를 앞에 둔다. 다시 불러도 429 면 하루 한도에 걸린 개발 단계 키일 가능성이 크다.
  it('첫 번째 429 는 다시 시도가 주 버튼이다', async () => {
    notice(1)
    const { getByText, getByTestId } = await renderOverlay(<ApiKeyNoticeModal />)

    await waitFor(() => expect(getByText('다른 키 입력')).toBeTruthy())
    expect(getByTestId('rate-limit-notice-primary')).toHaveTextContent('다시 시도')
  })

  it('두 번째 429 부터는 다른 키 입력이 주 버튼이다', async () => {
    notice(2)
    const { getByTestId } = await renderOverlay(<ApiKeyNoticeModal />)

    await waitFor(() => expect(getByTestId('rate-limit-notice-primary')).toHaveTextContent('다른 키 입력'))
  })

  it('다시 시도는 알림을 닫고 회차를 다시 돌린다. 키는 지우지 않는다', async () => {
    notice(1)
    const { getByText } = await renderOverlay(<ApiKeyNoticeModal />)

    await fireEvent.press(getByText('다시 시도'))

    expect(retryRateLimitNotice).toHaveBeenCalledTimes(1)
    expect(pullRefresh).toHaveBeenCalledTimes(1)
    expect(replaceMainApiKey).not.toHaveBeenCalled()
  })

  // 계정 관리 화면이 생기기 전까지 부계정 키는 다시 시도만 둔다(사용자 선택 2026-11-11).
  it('부계정 키면 다른 키 입력 없이 다시 시도 하나다', async () => {
    notice(2, 'sub')
    const { queryByText, getByText } = await renderOverlay(<ApiKeyNoticeModal />)

    await waitFor(() => expect(rateLimitedKeyRole).toHaveBeenCalledWith('key-1'))
    expect(getByText('다시 시도')).toBeTruthy()
    expect(queryByText('다른 키 입력')).toBeNull()
  })

  it('메인 키의 다른 키 입력은 키 입력 시트를 열고, 새 키가 저장되면 시트를 닫고 회차를 다시 돌린다', async () => {
    notice(2)
    const { getByText, getByTestId, queryByTestId, queryByText, getByLabelText } = await renderOverlay(<ApiKeyNoticeModal />)

    await waitFor(() => expect(getByText('다른 키 입력')).toBeTruthy())
    await fireEvent.press(getByText('다른 키 입력'))
    expect(getByTestId('api-key-sheet')).toBeTruthy()
    // 앱을 쓰는 중에 키만 바꾸는 자리다. 로그인 화면의 제목과 `일부 기능 제한` 배지를 쓰지 않는다.
    expect(getByText('다른 API 키로 바꾸기')).toBeTruthy()
    expect(queryByText('API 키로 시작하기')).toBeNull()
    expect(queryByText('일부 기능 제한')).toBeNull()

    await fireEvent.changeText(getByLabelText('Nexon Open API 키'), 'new-key')
    await fireEvent.press(getByText('확인'))

    await waitFor(() => expect(replaceMainApiKey).toHaveBeenCalledWith('new-key'))
    await waitFor(() => expect(queryByTestId('api-key-sheet')).toBeNull())
    expect(pullRefresh).toHaveBeenCalled()
  })

  it('오버레이를 눌러도 닫히지 않는다', async () => {
    notice(1)
    const { getByText, getByTestId } = await renderOverlay(<ApiKeyNoticeModal />)

    await fireEvent.press(getByTestId('rate-limit-notice'))

    expect(getByText('호출 한도를 초과했습니다')).toBeTruthy()
    expect(retryRateLimitNotice).not.toHaveBeenCalled()
  })
})
