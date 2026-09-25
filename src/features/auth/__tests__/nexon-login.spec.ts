// 넥슨 Open ID 로그인 흐름. 여기서 막는 사고는 남의 콜백을 내 것으로 읽는 것이다.
//
// 안드로이드에서는 같은 스킴을 선언한 다른 앱이 콜백을 가로챌 수 있고, 반대로 다른 앱이 보낸
// 콜백이 우리에게 올 수도 있다. `state` 대조가 그것을 가린다.
import { Platform } from 'react-native'

import { signInWithNexon } from '../nexon-login'

jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }))
jest.mock('../../../server/nexon-auth', () => ({
  startNexonLogin: jest.fn(),
  exchangeNexonCode: jest.fn(),
}))
jest.mock('../../../storage/api-key', () => ({ setNexonLogin: jest.fn() }))

const { openAuthSessionAsync } = jest.requireMock('expo-web-browser') as Record<string, jest.Mock>
const { startNexonLogin, exchangeNexonCode } = jest.requireMock(
  '../../../server/nexon-auth',
) as Record<string, jest.Mock>
const { setNexonLogin } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>

const 시작값 = {
  authorizeUrl: 'https://openid.nexon.com/oauth2/authorize?state=진짜state',
  state: '진짜state',
  verifier: '진짜검증값',
}

function 콜백(url: string): void {
  openAuthSessionAsync.mockResolvedValue({ type: 'success', url })
}

beforeEach(() => {
  jest.clearAllMocks()
  Platform.OS = 'ios'
  startNexonLogin.mockResolvedValue(시작값)
  exchangeNexonCode.mockResolvedValue('받은세션')
  setNexonLogin.mockResolvedValue(undefined)
  콜백('com.mapleroutine.app://oauth/callback?code=받은code&state=진짜state')
})

describe('정상 흐름', () => {
  it('세션을 받아 저장하고 성공으로 끝난다', async () => {
    await expect(signInWithNexon()).resolves.toEqual({ kind: 'signedIn' })

    expect(setNexonLogin).toHaveBeenCalledWith('받은세션')
  })

  it('서버가 준 주소를 그대로 연다', async () => {
    await signInWithNexon()

    const [url, redirect] = openAuthSessionAsync.mock.calls[0] as [string, string]
    expect(url).toBe(시작값.authorizeUrl)
    // 넥슨에 등록한 값과 같아야 인증 세션이 콜백을 우리에게 돌려준다.
    expect(redirect).toBe('com.mapleroutine.app://oauth/callback')
  })

  it('앱이 도는 플랫폼을 서버에 알린다', async () => {
    // 넥슨 애플리케이션이 플랫폼마다 따로 등록돼 client_id 와 secret 이 쌍으로 갈린다.
    Platform.OS = 'android'
    await signInWithNexon()
    expect(startNexonLogin).toHaveBeenCalledWith('android')

    jest.clearAllMocks()
    startNexonLogin.mockResolvedValue(시작값)
    exchangeNexonCode.mockResolvedValue('받은세션')
    콜백('com.mapleroutine.app://oauth/callback?code=받은code&state=진짜state')
    Platform.OS = 'ios'
    await signInWithNexon()
    expect(startNexonLogin).toHaveBeenCalledWith('ios')
  })

  it('교환에 code 와 state 와 검증값을 함께 보낸다', async () => {
    await signInWithNexon()

    expect(exchangeNexonCode).toHaveBeenCalledWith({
      code: '받은code',
      state: '진짜state',
      verifier: '진짜검증값',
    })
  })
})

describe('state 가 다르면 교환하지 않는다', () => {
  it('다른 state 로 돌아온 콜백은 거절한다', async () => {
    // 넥슨 보안 가이드라인이 지목한 CSRF 대응이다. 콜백이 우리가 시작한 그 요청의 답인지
    // 가리는 유일한 방법이고, 다르면 code 를 서버에 넘기지 않는다.
    콜백('com.mapleroutine.app://oauth/callback?code=남의code&state=남의state')

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'failed' })
    expect(exchangeNexonCode).not.toHaveBeenCalled()
    expect(setNexonLogin).not.toHaveBeenCalled()
  })

  it('state 가 아예 없어도 거절한다', async () => {
    콜백('com.mapleroutine.app://oauth/callback?code=받은code')

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'failed' })
    expect(exchangeNexonCode).not.toHaveBeenCalled()
  })

  it('code 가 없으면 교환할 것이 없다', async () => {
    콜백('com.mapleroutine.app://oauth/callback?state=진짜state')

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'failed' })
    expect(exchangeNexonCode).not.toHaveBeenCalled()
  })

  it('넥슨이 error 를 돌려주면 거절한다', async () => {
    콜백('com.mapleroutine.app://oauth/callback?error=access_denied&state=진짜state')

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'failed' })
    expect(exchangeNexonCode).not.toHaveBeenCalled()
  })
})

describe('취소는 실패가 아니다', () => {
  it.each(['cancel', 'dismiss'])('사용자가 창을 닫으면 %s 로 끝난다', async (type) => {
    // 아무 일도 안 일어난 것이다. 실패로 다루면 안내가 뜨고, 사용자는 자기가 닫아 놓고
    // 무엇이 잘못됐나 찾게 된다.
    openAuthSessionAsync.mockResolvedValue({ type })

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'cancelled' })
    expect(exchangeNexonCode).not.toHaveBeenCalled()
    expect(setNexonLogin).not.toHaveBeenCalled()
  })
})

describe('실패는 던지지 않는다', () => {
  it('시작 요청이 실패하면 창을 열지도 않는다', async () => {
    startNexonLogin.mockRejectedValue(new Error('서버가 죽었다'))

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'failed' })
    expect(openAuthSessionAsync).not.toHaveBeenCalled()
  })

  it('교환이 실패하면 저장하지 않는다', async () => {
    exchangeNexonCode.mockRejectedValue(new Error('넥슨이 거절했다'))

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'failed' })
    expect(setNexonLogin).not.toHaveBeenCalled()
  })

  it('저장이 실패하면 로그인도 실패다', async () => {
    // 세션을 못 적으면 앱을 다시 켤 때 로그인 상태가 아니다. 성공이라고 말하면 안 된다.
    setNexonLogin.mockRejectedValue(new Error('disk full'))

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'failed' })
  })
})
