// 넥슨 Open ID 로그인 흐름. 여기서 막는 사고는 열쇠 하나로 세션을 받는 것과, 콜백이 도는 중인데
// 실패로 접는 것이다. 돌아오는 길에 실린 receipt 와 앱이 든 redeemKey 를 둘 다 서버에 내야 세션이 온다.
import { Platform } from 'react-native'

import { REDEEM_MAX_TRIES, REDEEM_RETRY_MS, signInWithNexon } from '../nexon-login'

jest.mock('../../../native/browser', () => ({ openAuthSession: jest.fn() }))
jest.mock('../../../server/nexon-auth', () => ({
  startNexonLogin: jest.fn(),
  redeemNexonSession: jest.fn(),
  revokeNexonSession: jest.fn(),
}))
jest.mock('../prune-covered-keys', () => ({ saveNexonLogin: jest.fn() }))
jest.mock('../../character-selection/forget', () => ({ forgetTrackedSelection: jest.fn() }))
jest.mock('../../mvp-grade/character-list', () => ({ fetchUnsavedCharacterList: jest.fn() }))

const { openAuthSession } = jest.requireMock('../../../native/browser') as Record<string, jest.Mock>
const { startNexonLogin, redeemNexonSession, revokeNexonSession } = jest.requireMock(
  '../../../server/nexon-auth',
) as Record<string, jest.Mock>
const { saveNexonLogin } = jest.requireMock('../prune-covered-keys') as Record<string, jest.Mock>
const { forgetTrackedSelection } = jest.requireMock('../../character-selection/forget') as Record<string, jest.Mock>
const { fetchUnsavedCharacterList } = jest.requireMock('../../mvp-grade/character-list') as Record<string, jest.Mock>

const 시작값 = { authorizeUrl: 'https://openid.nexon.com/oauth2/authorize?state=s', redeemKey: '되찾기열쇠' }
const 메이플ID목록 = [{ accountId: '메이플ID', characters: [] }]

function 콜백(url: string): void {
  openAuthSession.mockResolvedValue(url)
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useRealTimers()
  Platform.OS = 'ios'
  startNexonLogin.mockResolvedValue(시작값)
  redeemNexonSession.mockResolvedValue({ status: 'ok', session: '받은세션' })
  saveNexonLogin.mockResolvedValue(undefined)
  forgetTrackedSelection.mockResolvedValue(undefined)
  revokeNexonSession.mockResolvedValue(undefined)
  fetchUnsavedCharacterList.mockResolvedValue(메이플ID목록)
  콜백('com.mapleroutine.app://oauth/callback?receipt=영수증')
})

describe('정상 흐름', () => {
  it('열쇠 둘로 세션을 받아 저장하고 성공으로 끝난다', async () => {
    await expect(signInWithNexon()).resolves.toEqual({ kind: 'signedIn', accounts: 메이플ID목록 })

    expect(redeemNexonSession).toHaveBeenCalledWith({ redeemKey: '되찾기열쇠', receipt: '영수증' })
    expect(saveNexonLogin).toHaveBeenCalledWith('받은세션', { fresh: false })
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

// 메이플 ID 가 없는 로그인을 저장하면 조회가 늘 그 로그인으로 가서, API 키로도 다른 넥슨 ID 로도 빠져나올 수 없었다.
describe('메이플 ID 가 없는 넥슨 ID 는 저장하지 않는다', () => {
  it('받은 세션으로 목록을 먼저 받고, 메이플 ID 가 있으면 그 뒤에 저장한다', async () => {
    const 차례: string[] = []
    fetchUnsavedCharacterList.mockImplementation(async () => {
      차례.push('목록')
      return 메이플ID목록
    })
    saveNexonLogin.mockImplementation(async () => {
      차례.push('저장')
    })

    await signInWithNexon()

    expect(fetchUnsavedCharacterList).toHaveBeenCalledWith({ type: 'login', value: '받은세션', accountId: null })
    expect(차례).toEqual(['목록', '저장'])
  })

  it('목록이 비면 저장하지 않고 서버 세션을 거둔 뒤 noMapleId 로 끝난다', async () => {
    fetchUnsavedCharacterList.mockResolvedValue([])

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'noMapleId' })

    expect(saveNexonLogin).not.toHaveBeenCalled()
    expect(revokeNexonSession).toHaveBeenCalledWith('받은세션')
  })

  it('새 로그인이어도 메이플 ID 가 없으면 앞 로그인의 추적 목록을 비우지 않는다. 기기에 아무것도 바뀌지 않는다', async () => {
    fetchUnsavedCharacterList.mockResolvedValue([])

    await signInWithNexon({ fresh: true })

    expect(forgetTrackedSelection).not.toHaveBeenCalled()
  })

  it('목록을 못 받으면 저장하지 않고 실패다. 메이플 ID 가 있는지 모르는 로그인이다', async () => {
    fetchUnsavedCharacterList.mockRejectedValue(new Error('503'))

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'failed' })

    expect(saveNexonLogin).not.toHaveBeenCalled()
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

    await expect(result).resolves.toMatchObject({ kind: 'signedIn' })
    expect(redeemNexonSession).toHaveBeenCalledTimes(3)
    expect(saveNexonLogin).toHaveBeenCalledWith('늦은세션', { fresh: false })
  })

  it('끝까지 pending 이면 실패다. 무한히 안 묻는다', async () => {
    jest.useFakeTimers()
    redeemNexonSession.mockResolvedValue({ status: 'pending' })

    const result = signInWithNexon()
    await jest.advanceTimersByTimeAsync(REDEEM_RETRY_MS * REDEEM_MAX_TRIES)

    await expect(result).resolves.toEqual({ kind: 'failed' })
    expect(redeemNexonSession).toHaveBeenCalledTimes(REDEEM_MAX_TRIES)
    expect(saveNexonLogin).not.toHaveBeenCalled()
  })

  it('gone 이면 바로 실패다', async () => {
    redeemNexonSession.mockResolvedValue({ status: 'gone' })

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'failed' })
    expect(redeemNexonSession).toHaveBeenCalledTimes(1)
  })
})

describe('receipt 가 없으면 서버에 묻지 않는다', () => {
  it('receipt 없이 돌아온 콜백은 실패다', async () => {
    // 서버가 짝을 못 집었거나 교환이 실패한 것이다. 스킴 주소만 돌아온다.
    콜백('com.mapleroutine.app://oauth/callback')

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'failed' })
    expect(redeemNexonSession).not.toHaveBeenCalled()
    expect(saveNexonLogin).not.toHaveBeenCalled()
  })

  it('빈 receipt 도 거절한다', async () => {
    콜백('com.mapleroutine.app://oauth/callback?receipt=')

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'failed' })
    expect(redeemNexonSession).not.toHaveBeenCalled()
  })

  it('동의 취소가 아닌 error_name 은 실패다', async () => {
    콜백('com.mapleroutine.app://oauth/callback?error_name=server_error')

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
    expect(saveNexonLogin).not.toHaveBeenCalled()
  })

  it('넥슨 동의 화면에서 취소해도 취소로 끝난다', async () => {
    // 넥슨은 state 없이 error_name 만 보내고, 서버가 그 값을 스킴 주소에 실어 돌려보낸다.
    콜백('com.mapleroutine.app://oauth/callback?error_name=user_cancel_consent')

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'cancelled' })
    expect(redeemNexonSession).not.toHaveBeenCalled()
    expect(saveNexonLogin).not.toHaveBeenCalled()
  })
})

describe('던지지 않는다', () => {
  it('서버 시작이 던지면 실패로 접는다', async () => {
    startNexonLogin.mockRejectedValue(new Error('서버가 죽었다'))

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'failed' })
  })

  it('저장이 던지면 실패다. 다시 켤 때 로그인 상태가 아니기 때문이다', async () => {
    saveNexonLogin.mockRejectedValue(new Error('디스크'))

    await expect(signInWithNexon()).resolves.toEqual({ kind: 'failed' })
  })
})

// 로그인 화면의 새 로그인은 캐릭터를 새로 고르게 한다. 세션을 받기 전에 비우면 취소하거나 실패한 로그인이 목록을 지운다.
describe('새 로그인의 추적 목록 비우기', () => {
  it('세션을 받은 뒤, 저장하기 전에 비운다', async () => {
    const order: string[] = []
    forgetTrackedSelection.mockImplementation(async () => {
      order.push('forget')
    })
    saveNexonLogin.mockImplementation(async () => {
      order.push('save')
    })

    await signInWithNexon({ fresh: true })

    expect(order).toEqual(['forget', 'save'])
  })

  it('today 의 연동처럼 새 로그인이 아니면 비우지 않는다', async () => {
    await signInWithNexon({ fresh: false })

    expect(forgetTrackedSelection).not.toHaveBeenCalled()
  })

  // 새 로그인이면 저장이 앞 메인 키를 버리고, 연동이면 그 키를 부계정으로 둔다.
  it('새 로그인인지를 저장에 넘긴다', async () => {
    await signInWithNexon({ fresh: true })
    expect(saveNexonLogin).toHaveBeenLastCalledWith('받은세션', { fresh: true })

    await signInWithNexon({ fresh: false })
    expect(saveNexonLogin).toHaveBeenLastCalledWith('받은세션', { fresh: false })
  })

  it.each([
    ['창을 닫으면', () => openAuthSession.mockResolvedValue(null)],
    ['세션을 받지 못하면', () => redeemNexonSession.mockResolvedValue({ status: 'gone' })],
  ])('%s 비우지 않는다', async (_label, arrange) => {
    arrange()

    await signInWithNexon({ fresh: true })

    expect(forgetTrackedSelection).not.toHaveBeenCalled()
  })
})
