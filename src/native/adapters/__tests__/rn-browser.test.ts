import { rnBrowserPort } from '../rn-browser'

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  openAuthSessionAsync: jest.fn(),
  WebBrowserPresentationStyle: { PAGE_SHEET: 'pageSheet' },
}))

const { openAuthSessionAsync, openBrowserAsync } = jest.requireMock('expo-web-browser') as Record<string, jest.Mock>

// 넥슨 로그인 창(`ASWebAuthenticationSession`)이 카드 시트로 뜬다. 웹 문서 창도 같은 모양이어야 한다.
// 라이브러리 기본값은 화면 전체를 덮는 `overFullScreen` 이다.
describe('rnBrowserPort.open', () => {
  it('로그인 창과 같은 카드 시트로 띄우고, 받은 색을 그대로 넘긴다', async () => {
    openBrowserAsync.mockResolvedValue({ type: 'dismiss' })

    await rnBrowserPort.open('https://mapleroutine.store/privacy', {
      toolbarColor: '#111111',
      controlsColor: '#222222',
    })

    expect(openBrowserAsync).toHaveBeenCalledWith('https://mapleroutine.store/privacy', {
      toolbarColor: '#111111',
      controlsColor: '#222222',
      presentationStyle: 'pageSheet',
    })
  })
})

/**
 * 인증 세션의 결과를 돌아온 주소 하나로 줄이는 검사.
 *
 * 성공이 아닌 결과를 전부 `null` 로 모은다. 사용자가 창을 닫은 것은 실패가 아니라 아무 일도 없던
 * 것이라, 로그인 쪽이 이 `null` 을 보고 취소로 끝낸다.
 */
describe('rnBrowserPort.openAuthSession', () => {
  beforeEach(() => {
    openAuthSessionAsync.mockReset()
  })

  it('돌아왔으면 그 주소를 돌려준다', async () => {
    openAuthSessionAsync.mockResolvedValue({ type: 'success', url: 'app://cb?receipt=r' })

    await expect(rnBrowserPort.openAuthSession('https://login', 'app://cb')).resolves.toBe(
      'app://cb?receipt=r',
    )
  })

  it.each(['cancel', 'dismiss'])('창을 닫은 %s 는 null 이다', async (type) => {
    openAuthSessionAsync.mockResolvedValue({ type })

    await expect(rnBrowserPort.openAuthSession('https://login', 'app://cb')).resolves.toBeNull()
  })
})
