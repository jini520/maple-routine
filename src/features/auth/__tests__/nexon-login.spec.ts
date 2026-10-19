// 넥슨 Open ID 로그인 흐름. 여기서 막는 사고는 열쇠 하나로 세션을 받는 것과, 콜백이 도는 중인데
// 실패로 접는 것이다. 돌아오는 길에 실린 receipt 와 앱이 든 redeemKey 를 둘 다 서버에 내야 세션이 온다.
import { Platform } from 'react-native'

import { REDEEM_MAX_TRIES, REDEEM_RETRY_MS, signInWithNexon } from '../nexon-login'

jest.mock('../../../native/browser', () => ({ openAuthSession: jest.fn() }))
jest.mock('../../../server/nexon-auth', () => ({
  startNexonLogin: jest.fn(),
  redeemNexonSession: jest.fn(),
}))
jest.mock('../../../storage/api-key', () => ({ setNexonLogin: jest.fn() }))
jest.mock('../prune-covered-keys', () => ({ pruneCoveredApiKeys: jest.fn() }))

const { openAuthSession } = jest.requireMock('../../../native/browser') as Record<string, jest.Mock>
const { startNexonLogin, redeemNexonSession } = jest.requireMock(
  '../../../server/nexon-auth',
) as Record<string, jest.Mock>
const { setNexonLogin } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>
const { pruneCoveredApiKeys } = jest.requireMock('../prune-covered-keys') as Record<string, jest.Mock>

const 시작값 = { authorizeUrl: 'https://openid.nexon.com/oauth2/authorize?state=s', redeemKey: '되찾기열쇠' }

function 콜백(url: string): void {
  openAuthSession.mockResolvedValue(url)
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useRealTimers()
  Platform.OS = 'ios'
  startNexonLogin.mockResolvedValue(시작값)
  redeemNexonSession.mockResolvedValue({ status: 'ok', session: '받은세션' })
  setNexonLogin.mockResolvedValue(undefined)
  pruneCoveredApiKeys.mockResolvedValue(undefined)
  콜백('com.mapleroutine.app://oauth/callback?receipt=영수증')
})

describe('정상 흐름', () => {
  it('열쇠 둘로 세션을 받아 저장하고 성공으로 끝난다', async () => {
    await expect(signInWithNexon()).resolves.toEqual({ kind: 'signedIn' })

    expect(redeemNexonSession).toHaveBeenCalledWith({ redeemKey: '되찾기열쇠', receipt: '영수증' })
    expect(setNexonLogin).toHaveBeenCalledWith({ session: '받은세션' })
  })

  it('로그인 뒤에 같은 계정의 키를 거둔다', async () => {
    await signInWithNexon()
    expect(pruneCoveredApiKeys).toHaveBeenCalledTimes(1)
  })

  it('키를 못 거둬도 로그인은 성공이다', async () => {
    pruneCoveredApiKeys.mockRejectedValue(new Error('조회가 죽었다'))

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'signedIn' })
  })

  it('서버가 준 주소를 그대로 열고 돌아올 주소는 등록한 스킴이다', async () => {
    await signInWithNexon()

    const [url, redirect] = openAuthSession.mock.calls[0] as [string, string]
    expect(url).toBe(시작값.authorizeUrl)
    expect(redirect).toBe('com.mapleroutine.app://oauth/callback')
  })

  it('앱이 도는 플랫폼을 서버에 알린다', async () => {
    Platform.OS = 'android'
    await signInWithNexon()
    expect(startNexonLogin).toHaveBeenCalledWith('android')

    Platform.OS = 'ios'
    await signInWithNexon()
    expect(startNexonLogin).toHaveBeenLastCalledWith('ios')
  })
})

describe('콜백이 아직 도는 중이면 되묻는다', () => {
  it('pending 이면 간격을 두고 다시 물어 ok 를 받는다', async () => {
    jest.useFakeTimers()
    redeemNexonSession
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({ status: 'ok', session: '늦은세션' })

    const result = signInWithNexon()
    await jest.advanceTimersByTimeAsync(REDEEM_RETRY_MS * 2)

    await expect(result).resolves.toEqual({ kind: 'signedIn' })
    expect(redeemNexonSession).toHaveBeenCalledTimes(3)
    expect(setNexonLogin).toHaveBeenCalledWith({ session: '늦은세션' })
  })

  it('끝까지 pending 이면 실패다. 무한히 안 묻는다', async () => {
    jest.useFakeTimers()
    redeemNexonSession.mockResolvedValue({ status: 'pending' })

    const result = signInWithNexon()
    await jest.advanceTimersByTimeAsync(REDEEM_RETRY_MS * REDEEM_MAX_TRIES)

    await expect(result).resolves.toEqual({ kind: 'failed' })
    expect(redeemNexonSession).toHaveBeenCalledTimes(REDEEM_MAX_TRIES)
    expect(setNexonLogin).not.toHaveBeenCalled()
  })

  it('gone 이면 바로 실패다', async () => {
    redeemNexonSession.mockResolvedValue({ status: 'gone' })

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'failed' })
    expect(redeemNexonSession).toHaveBeenCalledTimes(1)
  })
})

describe('receipt 가 없으면 서버에 묻지 않는다', () => {
  it('receipt 없이 돌아온 콜백은 실패다', async () => {
    // 서버가 짝을 못 집었거나 넥슨이 동의를 거절로 끝낸 것이다. 스킴 주소만 돌아온다.
    콜백('com.mapleroutine.app://oauth/callback')

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'failed' })
    expect(redeemNexonSession).not.toHaveBeenCalled()
    expect(setNexonLogin).not.toHaveBeenCalled()
  })

  it('빈 receipt 도 거절한다', async () => {
    콜백('com.mapleroutine.app://oauth/callback?receipt=')

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'failed' })
    expect(redeemNexonSession).not.toHaveBeenCalled()
  })
})

describe('취소는 실패가 아니다', () => {
  it('사용자가 창을 닫으면 취소로 끝난다', async () => {
    // 아무 일도 안 일어난 것이다. 실패로 다루면 안내가 뜨고, 사용자는 자기가 닫아 놓고
    // 무엇이 잘못됐나 찾게 된다. 닫힌 종류를 `null` 로 모으는 일은 브라우저 어댑터가 한다.
    openAuthSession.mockResolvedValue(null)

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'cancelled' })
    expect(redeemNexonSession).not.toHaveBeenCalled()
    expect(setNexonLogin).not.toHaveBeenCalled()
  })
})

describe('던지지 않는다', () => {
  it('서버 시작이 던지면 실패로 접는다', async () => {
    startNexonLogin.mockRejectedValue(new Error('서버가 죽었다'))

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'failed' })
  })

  it('저장이 던지면 실패다. 다시 켤 때 로그인 상태가 아니기 때문이다', async () => {
    setNexonLogin.mockRejectedValue(new Error('디스크'))

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'failed' })
  })
})
