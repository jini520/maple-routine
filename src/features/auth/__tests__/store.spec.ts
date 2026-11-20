import type { MapleAccount } from '../../../types'
import {
  NexonAuthError,
  NexonBadRequestError,
  NexonNetworkError,
  NexonMaintenanceError,
  NexonRateLimitError,
} from '../../../nexon/errors'
import { initialAuthState } from '../state'

jest.mock('../../../nexon/character', () => ({
  fetchCharacterList: jest.fn(),
}))
const { fetchCharacterList: fetchCharacterListMock } = jest.requireMock('../../../nexon/character') as Record<string, jest.Mock>

jest.mock('../../../nexon/key-stage', () => ({
  probeApiKeyStage: jest.fn(),
}))
const { probeApiKeyStage: probeApiKeyStageMock } = jest.requireMock('../../../nexon/key-stage') as Record<string, jest.Mock>

jest.mock('../../../storage/api-key', () => ({
  getAuthConfig: jest.fn(),
  setMainApiKey: jest.fn(),
  signOutAuth: jest.fn(),
  removeApiKey: jest.fn(),
  removeAllApiKeys: jest.fn(),
  clearNexonLogin: jest.fn(),
}))
const {
  getAuthConfig: getAuthConfigMock,
  setMainApiKey: setMainApiKeyMock,
  signOutAuth: signOutAuthMock,
  removeApiKey: removeApiKeyMock,
  removeAllApiKeys: removeAllApiKeysMock,
  clearNexonLogin: clearNexonLoginMock,
} = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>

jest.mock('../../../server/nexon-auth', () => ({ revokeNexonSession: jest.fn() }))
jest.mock('../../server-sync/forget', () => ({ requestAccountDeletion: jest.fn(), clearUnsentServerData: jest.fn() }))
jest.mock('../nexon-login', () => ({ signInWithNexon: jest.fn() }))
jest.mock('../current-credential', () => ({ currentCredential: jest.fn() }))
jest.mock('../reentry-account-id', () => ({ reusableNexonAccountId: jest.fn() }))
jest.mock('../prune-covered-keys', () => ({ pruneCoveredApiKeys: jest.fn() }))
jest.mock('../../character-selection/forget', () => ({ forgetTrackedSelection: jest.fn() }))
jest.mock('../../../storage/character-accounts', () => ({ recordCharacterAccounts: jest.fn() }))
jest.mock('../key-problem', () => ({ planInvalidSubKey: jest.fn(), retireInvalidSubKey: jest.fn(), destinationOf: jest.fn() }))
const { planInvalidSubKey: planInvalidSubKeyMock, retireInvalidSubKey: retireInvalidSubKeyMock } = jest.requireMock(
  '../key-problem',
) as Record<string, jest.Mock>
const { forgetTrackedSelection: forgetTrackedSelectionMock } = jest.requireMock('../../character-selection/forget') as Record<
  string,
  jest.Mock
>
const { recordCharacterAccounts: recordCharacterAccountsMock } = jest.requireMock('../../../storage/character-accounts') as Record<
  string,
  jest.Mock
>
const { pruneCoveredApiKeys: pruneCoveredApiKeysMock } = jest.requireMock('../prune-covered-keys') as Record<string, jest.Mock>
const { signInWithNexon: signInWithNexonMock } = jest.requireMock('../nexon-login') as Record<string, jest.Mock>
const { currentCredential: currentCredentialMock } = jest.requireMock('../current-credential') as Record<string, jest.Mock>
const { revokeNexonSession: revokeNexonSessionMock } = jest.requireMock('../../../server/nexon-auth') as Record<string, jest.Mock>

jest.mock('../../toast/store', () => {
  const showSuccess = jest.fn()
  const showError = jest.fn()
  return { useToastStore: { getState: () => ({ showSuccess, showError }) } }
})
const showSuccessMock = jest.requireMock('../../toast/store').useToastStore.getState().showSuccess as jest.Mock
const showErrorMock = jest.requireMock('../../toast/store').useToastStore.getState().showError as jest.Mock

// 진입 게이트는 여기서 **부르는 대상**이지 검사 대상이 아니다. 그쪽 규칙은
// `features/app-entry/__tests__/store.spec.ts` 가 본다.
jest.mock('../../app-entry/store', () => {
  const resolveAfterSignIn = jest.fn()
  const reset = jest.fn()
  return { useAppEntryStore: { getState: () => ({ resolveAfterSignIn, reset }) } }
})
const resolveAfterSignInMock = jest.requireMock('../../app-entry/store').useAppEntryStore.getState().resolveAfterSignIn as jest.Mock
const entryResetMock = jest.requireMock('../../app-entry/store').useAppEntryStore.getState().reset as jest.Mock

import { recordKeySuccess, resetKeySuccessForTest } from '../../../nexon/key-success'
import { useAccountManageOpenStore } from '../../account-manage/open-request'
import { resetRateLimitNoticesForTest, useAuthStore } from '../store'
import { readCachedCharacterList } from '../../mvp-grade/character-list'
import type { NexonCredential } from '../../../types/auth'

/** 넥슨에 넘기는 자격. 지금은 API 키 한 종류뿐이다. */
const 자격 = (value: string): NexonCredential => ({ type: 'key', value, accountId: null })

function account(accountId: string): MapleAccount {
  return {
    accountId,
    characters: [
      {
        ocid: `ocid-${accountId}`,
        name: `캐릭터-${accountId}`,
        world: '베라',
        worldKey: 'bera',
        jobClass: '렌',
        level: 200,
      },
    ],
  }
}

const { reusableNexonAccountId } = jest.requireMock('../reentry-account-id') as Record<string, jest.Mock>

beforeEach(() => {
  useAuthStore.setState(initialAuthState)
  resetRateLimitNoticesForTest()
  resetKeySuccessForTest()
  reusableNexonAccountId.mockReset().mockResolvedValue(null)
  setMainApiKeyMock.mockResolvedValue(undefined)
  signOutAuthMock.mockResolvedValue(undefined)
  removeApiKeyMock.mockResolvedValue(undefined)
  removeAllApiKeysMock.mockResolvedValue(undefined)
  clearNexonLoginMock.mockResolvedValue(undefined)
  resolveAfterSignInMock.mockResolvedValue(undefined)
  pruneCoveredApiKeysMock.mockResolvedValue(undefined)
  forgetTrackedSelectionMock.mockResolvedValue(undefined)
  recordCharacterAccountsMock.mockResolvedValue(undefined)
  planInvalidSubKeyMock.mockResolvedValue(null)
  retireInvalidSubKeyMock.mockResolvedValue(undefined)
  useAccountManageOpenStore.getState().clear()
  // 판정이 안 서는 것이 통상 경로다. 서는 경우만 그 테스트가 직접 세운다.
  probeApiKeyStageMock.mockResolvedValue('undetermined')
  getAuthConfigMock.mockResolvedValue({ login: null, mainKeyId: 'account-key', apiKeys: [{ type: 'key', id: 'account-key', label: '', value: 'key-1', loginId: null }] })
})

afterEach(() => {
  jest.resetAllMocks()
})

// 인증이 부팅에서 보는 것은 **키 하나**다. 뒤 단계 재개는 진입 게이트가 저장된 값에서 따로
// 파생한다. 여기서 둘을 함께 보면 축을 가른 의미가 없어진다.
describe('useAuthStore.restoreFromStorage', () => {
  it('저장된 키가 없으면 상태 변화가 없다', async () => {
    getAuthConfigMock.mockResolvedValue(null)

    await useAuthStore.getState().restoreFromStorage()

    expect(useAuthStore.getState()).toMatchObject(initialAuthState)
    expect(fetchCharacterListMock).not.toHaveBeenCalled()
  })

  it('로그인이 없고 부계정 키만 남았으면 로그인 상태가 아니다', async () => {
    getAuthConfigMock.mockResolvedValue({
      login: null,
      mainKeyId: null,
      apiKeys: [{ type: 'key', id: 'account-부', label: '', value: '부-키', loginId: 'account-login' }],
    })

    await useAuthStore.getState().restoreFromStorage()

    expect(useAuthStore.getState()).toMatchObject(initialAuthState)
  })

  it('저장된 키가 있으면 signedIn 이 된다. 네트워크는 안 탄다', async () => {
    getAuthConfigMock.mockResolvedValue({ login: null, mainKeyId: 'account-key', apiKeys: [{ type: 'key', id: 'account-key', label: '', value: 'key-1', loginId: null }] })

    await useAuthStore.getState().restoreFromStorage()

    expect(useAuthStore.getState().status).toBe('signedIn')
    expect(fetchCharacterListMock).not.toHaveBeenCalled()
  })

  // 로그인 직후 서버에서 잇지 못해 남은 키가 있을 수 있다. 다음 로그인까지 미루면 그동안 키가 평문으로 남는다.
  it('로그인한 채 앱을 켜면 키 거두기를 다시 한다', async () => {
    getAuthConfigMock.mockResolvedValue({
      login: { type: 'login', id: 'login-id', session: '세션' },
      mainKeyId: null,
      apiKeys: [{ type: 'key', id: 'account-key', label: '', value: 'key-1', loginId: 'login-id' }],
    })

    await useAuthStore.getState().restoreFromStorage()

    expect(pruneCoveredApiKeysMock).toHaveBeenCalledTimes(1)
  })

  it('키 거두기가 실패해도 앱은 열린다', async () => {
    pruneCoveredApiKeysMock.mockRejectedValue(new Error('조회가 죽었다'))

    await expect(useAuthStore.getState().restoreFromStorage()).resolves.toBeUndefined()

    expect(useAuthStore.getState().status).toBe('signedIn')
  })
})

describe('useAuthStore.signIn: 무효 키(400 OPENAPI00005)', () => {
  // 넥슨은 무효 키에 401 이 아니라 400 OPENAPI00005 를 준다.
  // 전에는 이 경로가 "모르는 400"이라 network 로 degrade 돼, 키를 잘못 입력한 사용자에게
  // 화면이 "네트워크 오류가 발생했습니다"라고 말했다. 원인이 키인데 네트워크를 가리켰다.
  it('400 OPENAPI00005 면 invalidApiKey 로 알린다(network 가 아니다)', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonBadRequestError('x', 'OPENAPI00005'))

    await useAuthStore.getState().signIn('bad-key')

    const state = useAuthStore.getState()
    expect(state.status).toBe('signedOut')
    expect(state.error).toEqual({ kind: 'invalidApiKey' })
    expect(showErrorMock).toHaveBeenCalledWith('API 키가 유효하지 않습니다')
    expect(setMainApiKeyMock).not.toHaveBeenCalled()
  })

  // 회귀 가드: 키와 무관한 400 까지 무효 키로 삼으면 캐릭터·날짜 문제가 키 문제로 둔갑한다.
  it('키와 무관한 400(OPENAPI00003)은 그대로 network 다', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonBadRequestError('x', 'OPENAPI00003'))

    await useAuthStore.getState().signIn('key-1')

    expect(useAuthStore.getState().error).toEqual({ kind: 'network' })
  })
})

describe('useAuthStore.signIn', () => {
  it('목록 조회에 성공하면 성공 토스트를 띄우고 signedIn 이 된다', async () => {
    fetchCharacterListMock.mockResolvedValue([account('acc-1')])

    await useAuthStore.getState().signIn('key-1')

    expect(showSuccessMock).toHaveBeenCalledWith('API 키를 확인했어요')
    expect(showErrorMock).not.toHaveBeenCalled()
    expect(useAuthStore.getState().status).toBe('signedIn')
  })

  // 검증 응답을 그대로 넘긴다. 저장된 추적 목록이 이 키의 것인지 대조하는 데 그 응답이 쓰이고,
  // 다시 부르지 않는 것이 요점이다.
  it('성공하면 검증 응답을 그대로 진입 게이트에 넘긴다', async () => {
    const accounts = [account('acc-1'), account('acc-2')]
    fetchCharacterListMock.mockResolvedValue(accounts)

    await useAuthStore.getState().signIn('key-1')

    expect(resolveAfterSignInMock).toHaveBeenCalledWith(accounts)
    expect(fetchCharacterListMock).toHaveBeenCalledTimes(1)
  })

  it('NexonAuthError를 만나면 invalidApiKey 로 남고 진입 게이트를 안 부른다', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonAuthError('invalid'))

    await useAuthStore.getState().signIn('key-1')

    const state = useAuthStore.getState()
    expect(state.status).toBe('signedOut')
    expect(state.error).toEqual({ kind: 'invalidApiKey' })
    expect(setMainApiKeyMock).not.toHaveBeenCalled()
    expect(resolveAfterSignInMock).not.toHaveBeenCalled()
  })

  // 전에는 원인과 무관하게 한 문구였다. 바로 아래에서 원인을 계산해 state에
  // 넣으면서도 토스트는 그 값을 쓰지 않았다.
  it.each([
    [new NexonAuthError('invalid'), 'API 키가 유효하지 않습니다'],
    // 토스트는 원인만. 처방은 인라인 자리가 준다.
    [new NexonRateLimitError('rate limited'), '호출 한도를 초과했습니다'],
    [new NexonNetworkError('network fail'), '네트워크 오류가 발생했습니다'],
    // 키 입력 화면에는 점검 배너를 세울 자리가 없어 토스트로 알린다.
    [new NexonMaintenanceError('점검', 'game'), '메이플스토리 API 점검 중입니다'],
    [new NexonMaintenanceError('점검', 'api'), '넥슨 Open API 점검 중입니다'],
  ])('목록 조회 실패를 원인별 문구로 알린다 (%o)', async (error, expected) => {
    fetchCharacterListMock.mockRejectedValue(error)

    await useAuthStore.getState().signIn('key-1')

    expect(showErrorMock).toHaveBeenCalledWith(expected)
    expect(showSuccessMock).not.toHaveBeenCalled()
  })

  // 전에는 키 저장이 try 밖이라 미처리 rejection이었다. 아무 일도 안 일어난
  // 것처럼 보였다. storageWriteFailed 문구가 이 경로로 처음 도달 가능해진다.
  it('키 저장에 실패하면 storageWriteFailed 로 남고 토스트로 알린다', async () => {
    fetchCharacterListMock.mockResolvedValue([{ accountId: 'acc-1', characters: [] }])
    setMainApiKeyMock.mockRejectedValue(new Error('write failed'))

    await useAuthStore.getState().signIn('key-1')

    const state = useAuthStore.getState()
    expect(state.status).toBe('signedOut')
    expect(state.error).toEqual({ kind: 'storageWriteFailed' })
    expect(showErrorMock).toHaveBeenCalledWith('기기에 저장하지 못했습니다')
    expect(resolveAfterSignInMock).not.toHaveBeenCalled()
  })

  it('NexonRateLimitError를 만나면 rateLimited 로 남는다', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonRateLimitError('rate limited'))

    await useAuthStore.getState().signIn('key-1')

    const state = useAuthStore.getState()
    expect(state.status).toBe('signedOut')
    expect(state.error).toEqual({ kind: 'rateLimited' })
  })

  it('그 외 에러(NexonNetworkError 포함)를 만나면 network 로 남는다', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonNetworkError('network fail'))

    await useAuthStore.getState().signIn('key-1')

    const state = useAuthStore.getState()
    expect(state.status).toBe('signedOut')
    expect(state.error).toEqual({ kind: 'network' })
  })
})

// 저장된 키로 앞으로 갈 수 없게 됐을 때 부르는 진입점은 이것뿐이다. 원인은 둘(무효 키 400
// OPENAPI00005·401/403 · 429)이고 사슬은 하나다. 처방이 같아 화면도 같다.
//
// 알리기만 하고 이동·삭제는 사용자가 확인을 눌러야(confirmApiKeyNotice) 일어난다. 이유를
// 읽기 전에 화면이 바뀌면 원인과 결과가 안 이어진다.
describe('useAuthStore.noticeApiKeyIssue', () => {
  function primeSignedIn(): void {
    useAuthStore.setState({
      status: 'signedIn',
      accounts: [account('acc-1')],
      error: null,
      apiKeyNotice: null,
      developmentStageBlocked: false,
    })
  }

  // 뒤에 원래 화면이 남아 있어야 사용자가 무엇을 하다 이렇게 됐는지 보면서 읽는다.
  it.each(['invalid', 'rateLimited'] as const)(
    '원인(%s)만 담고 status는 그대로다. 화면을 빼앗지 않는다',
    (kind) => {
      primeSignedIn()

      useAuthStore.getState().noticeApiKeyIssue(kind)

      const state = useAuthStore.getState()
      expect(state.apiKeyNotice).toEqual(kind === 'rateLimited' ? { kind, apiKey: null, attempt: 1 } : { kind, apiKey: null })
      expect(state.status).toBe('signedIn')
    },
  )

  // 알리는 시점에는 아무것도 지우지 않는다. 확인 전에 지우면 사용자가 취소할 수 없는 일이 이미 끝난다.
  it.each(['invalid', 'rateLimited'] as const)(
    '%s. 저장소를 건드리지 않고 토스트도 띄우지 않는다(문구는 모달이 말한다)',
    (kind) => {
      primeSignedIn()

      useAuthStore.getState().noticeApiKeyIssue(kind)

      expect(removeAllApiKeysMock).not.toHaveBeenCalled()
      expect(signOutAuthMock).not.toHaveBeenCalled()
      expect(showErrorMock).not.toHaveBeenCalled()
    },
  )

  // 동기 함수라 이 구간이 원자적이다. 동시 실패가 모달 하나로 접힌다.
  // 원인이 겹치면 **먼저 뜬 것**을 유지한다. 읽던 문구가 눈앞에서 바뀌면 안 된다.
  it('연달아 불러도 알림은 한 번뿐이고 먼저 뜬 원인이 유지된다', () => {
    primeSignedIn()

    useAuthStore.getState().noticeApiKeyIssue('rateLimited')
    const afterFirst = useAuthStore.getState()
    useAuthStore.getState().noticeApiKeyIssue('invalid')

    expect(useAuthStore.getState()).toBe(afterFirst)
    expect(useAuthStore.getState().apiKeyNotice).toEqual({ kind: 'rateLimited', apiKey: null, attempt: 1 })
  })

  // 가드는 "이미 로그인 화면인가"만 본다. 그 두 상태가 곧 그 화면이라 보낼 곳이 없고,
  // 그래서 재이동 루프도 불가능하다. 폼 실패는 폼 토스트가 맡는다.
  it.each(['signedOut', 'verifying'] as const)('로그인 화면(%s)에서는 알리지 않는다', (status) => {
    useAuthStore.setState({
      status,
      accounts: [account('acc-1')],
      error: null,
      apiKeyNotice: null,
      developmentStageBlocked: false,
    })

    useAuthStore.getState().noticeApiKeyIssue('rateLimited')

    const state = useAuthStore.getState()
    expect(state.apiKeyNotice).toBeNull()
    expect(state.status).toBe(status)
    expect(removeAllApiKeysMock).not.toHaveBeenCalled()
  })

  // 429 로 로스터가 비는 하드 잠금은 **캐릭터 설정 화면**에서 난다. 그 화면도 로그인 상태라
  // 이 문을 지난다. 막으면 출구가 정작 잠긴 사람에게 안 열린다(#176).
  it('캐릭터 설정 중에도 알린다. 그 화면도 signedIn 이다', () => {
    primeSignedIn()

    useAuthStore.getState().noticeApiKeyIssue('rateLimited')

    const state = useAuthStore.getState()
    expect(state.apiKeyNotice).toEqual({ kind: 'rateLimited', apiKey: null, attempt: 1 })
    // 알리기만 한다. status를 뒤집는 것은 확인(confirmApiKeyNotice)의 몫이다.
    expect(state.status).toBe('signedIn')
    expect(removeAllApiKeysMock).not.toHaveBeenCalled()
  })
})

describe('useAuthStore.confirmApiKeyNotice', () => {
  function primeNoticed(
    kind: 'invalid' | 'rateLimited' | 'signInRequired' = 'invalid',
    apiKey: string | null = null,
  ): void {
    useAuthStore.setState({
      status: 'signedIn',
      accounts: [account('acc-1')],
      error: null,
      apiKeyNotice: { kind, apiKey },
      developmentStageBlocked: false,
    })
  }

  /** 지운 뒤 남은 수단. `null` 이면 하나도 안 남았다. */
  function 지운뒤남는것(config: { login: unknown; apiKeys: unknown[]; mainKeyId: string | null } | null): void {
    getAuthConfigMock.mockResolvedValue(config)
  }

  // 수단이 하나도 안 남으면 로그인 화면이다. 이 앱은 수단 없이 할 수 있는 것이 거의 없다.
  // 상태를 뒤집는 것이 곧 이동이고, 화면 목록을 가르는 진입 게이트도 함께 되돌린다.
  it.each(['invalid', 'signInRequired'] as const)(
    '%s. 남은 수단이 없으면 signedOut 으로 되돌리고 진입 게이트도 로그인으로 보낸다',
    async (kind) => {
      primeNoticed(kind)
      지운뒤남는것(null)

      await useAuthStore.getState().confirmApiKeyNotice()

      expect(useAuthStore.getState()).toMatchObject(initialAuthState)
      expect(entryResetMock).toHaveBeenCalledTimes(1)
    },
  )

  // 남은 수단으로 조회되던 메이플 ID 를 같이 잃으면 안 된다. 앱 전체가 멈출 이유가 없다.
  it.each(['invalid', 'signInRequired'] as const)(
    '%s. 수단이 남아 있으면 알림만 닫고 앱은 그대로 선다',
    async (kind) => {
      primeNoticed(kind)
      지운뒤남는것({ login: null, mainKeyId: 'account-key', apiKeys: [{ type: 'key', id: 'account-key', label: '', value: '살아있는키', loginId: null }] })

      await useAuthStore.getState().confirmApiKeyNotice()

      const state = useAuthStore.getState()
      expect(state.apiKeyNotice).toBeNull()
      expect(state.status).toBe('signedIn')
      expect(state.accounts).toHaveLength(1)
      expect(entryResetMock).not.toHaveBeenCalled()
    },
  )

  // 부계정 키는 메인 계정이 되지 않는다. 다시 로그인할 때까지 남겨 두고 부르지 않는다.
  it('signInRequired 로 로그인을 뗀 뒤 부계정 키만 남으면 키를 지우지 않고 로그인 화면으로 간다', async () => {
    primeNoticed('signInRequired')
    지운뒤남는것({ login: null, mainKeyId: null, apiKeys: [{ type: 'key', id: 'account-부', label: '', value: '부-키', loginId: 'account-login' }] })

    await useAuthStore.getState().confirmApiKeyNotice()

    expect(useAuthStore.getState()).toMatchObject(initialAuthState)
    expect(entryResetMock).toHaveBeenCalledTimes(1)
    expect(removeApiKeyMock).not.toHaveBeenCalled()
    expect(removeAllApiKeysMock).not.toHaveBeenCalled()
  })

  // 로그인이 만료됐는데 API 키를 지우면 멀쩡한 키를, 여럿이면 다른 넥슨 계정의 키까지 잃는다.
  it('signInRequired 는 로그인만 뗀다. API 키는 안 건드린다', async () => {
    primeNoticed('signInRequired')
    지운뒤남는것({ login: null, mainKeyId: 'account-key', apiKeys: [{ type: 'key', id: 'account-key', label: '', value: '키', loginId: null }] })

    await useAuthStore.getState().confirmApiKeyNotice()

    expect(clearNexonLoginMock).toHaveBeenCalledTimes(1)
    expect(removeApiKeyMock).not.toHaveBeenCalled()
    expect(removeAllApiKeysMock).not.toHaveBeenCalled()
    expect(signOutAuthMock).not.toHaveBeenCalled()
  })

  // 로그아웃(signOutAuth)은 로그인과 메인 키를 함께 떼어 재개를 불가능하게 만든다.
  it.each(['invalid'] as const)(
    '%s. 저장소에서 apiKey만 지운다(로그아웃 경로 signOutAuth를 타지 않는다)',
    async (kind) => {
      primeNoticed(kind)
      지운뒤남는것(null)

      await useAuthStore.getState().confirmApiKeyNotice()

      // 알림이 키를 안 실어 왔다. 어느 키인지 못 가려 전부 지운다.
      expect(removeAllApiKeysMock).toHaveBeenCalledTimes(1)
      expect(signOutAuthMock).not.toHaveBeenCalled()
      expect(clearNexonLoginMock).not.toHaveBeenCalled()
    },
  )

  // 실패가 키를 실어 왔으면 그 키만 지운다. 키가 여럿인 사용자에게 전부 지우는 것은
  // 다른 넥슨 계정의 키까지 잃는 일이다.
  it('실린 키가 있으면 그 키만 지운다', async () => {
    primeNoticed('invalid', '죽은키')
    지운뒤남는것({ login: null, mainKeyId: 'account-key', apiKeys: [{ type: 'key', id: 'account-key', label: '', value: '산키', loginId: null }] })

    await useAuthStore.getState().confirmApiKeyNotice()

    expect(removeApiKeyMock).toHaveBeenCalledWith('죽은키')
    expect(removeAllApiKeysMock).not.toHaveBeenCalled()
  })

  // 알림이 없는데 확인이 불릴 일은 없지만, 불려도 저장된 키를 지우지 않아야 한다.
  it('알림이 켜져 있지 않으면 아무 일도 하지 않는다', async () => {
    useAuthStore.setState({ ...initialAuthState, status: 'signedIn' })

    await useAuthStore.getState().confirmApiKeyNotice()

    expect(useAuthStore.getState().status).toBe('signedIn')
    expect(removeAllApiKeysMock).not.toHaveBeenCalled()
    expect(entryResetMock).not.toHaveBeenCalled()
  })

  // 알려진 열화. 삭제가 실패해도 같은 길을 한 번 더 돌 뿐이라 막다른 길이 아니다. rethrow
  // 하면 호출부가 void 호출이라 미처리 rejection 이 된다.
  it('저장소 삭제가 실패해도 reject하지 않고 화면 이동은 그대로다', async () => {
    primeNoticed('invalid', '죽은키')
    removeApiKeyMock.mockRejectedValue(new Error('disk full'))

    await expect(useAuthStore.getState().confirmApiKeyNotice()).resolves.toBeUndefined()

    // 무엇이 남았는지 모른다. 세지 않고 로그인 화면으로 보낸다. 앱을 세워 두면 같은 실패를
    // 무한히 다시 만난다.
    expect(useAuthStore.getState().status).toBe('signedOut')
  })

  // 남은 것을 세는 읽기도 실패할 수 있다. 같은 이유로 로그인 화면이다.
  it('남은 수단을 읽지 못하면 로그인 화면으로 보낸다', async () => {
    primeNoticed('invalid', '죽은키')
    getAuthConfigMock.mockRejectedValue(new Error('read failed'))

    await useAuthStore.getState().confirmApiKeyNotice()

    expect(useAuthStore.getState().status).toBe('signedOut')
  })

  describe('지금 로그인의 부계정 키', () => {
    const plan = { apiKey: '부-키', untrack: ['o-sub'], remaining: ['o-main'] }

    // 지우면 기기마다 따로 관리하는 계정 관리 목록에서 그 계정이 사라져, 어느 계정의 키가 문제인지 알 수 없다.
    it('키를 지우지 않고 무효로 표시하고, 남은 추적 캐릭터가 있으면 계정 관리 목록만 연다', async () => {
      primeNoticed('invalid', '부-키')
      planInvalidSubKeyMock.mockResolvedValue(plan)

      await useAuthStore.getState().confirmApiKeyNotice()

      expect(planInvalidSubKeyMock).toHaveBeenCalledWith('부-키')
      expect(retireInvalidSubKeyMock).toHaveBeenCalledWith(plan)
      expect(removeApiKeyMock).not.toHaveBeenCalled()
      expect(removeAllApiKeysMock).not.toHaveBeenCalled()
      expect(useAuthStore.getState()).toMatchObject({ apiKeyNotice: null, status: 'signedIn' })
      expect(useAccountManageOpenStore.getState().request).toEqual({ accountKey: null, openKeySheet: false })
      expect(entryResetMock).not.toHaveBeenCalled()
    })

    // 추적 캐릭터가 없으면 앱을 쓸 수 없다. 추적 목록을 비운 진입 판정이 캐릭터 설정으로 보낸다.
    it('남은 추적 캐릭터가 없으면 계정 관리를 열지 않는다', async () => {
      primeNoticed('invalid', '부-키')
      planInvalidSubKeyMock.mockResolvedValue({ ...plan, remaining: [] })

      await useAuthStore.getState().confirmApiKeyNotice()

      expect(retireInvalidSubKeyMock).toHaveBeenCalled()
      expect(useAuthStore.getState().apiKeyNotice).toBeNull()
      expect(useAccountManageOpenStore.getState().request).toBeNull()
    })

    it('무효로 적지 못하면 무엇이 남았는지 모르니 로그인 화면으로 보낸다', async () => {
      primeNoticed('invalid', '부-키')
      planInvalidSubKeyMock.mockResolvedValue(plan)
      retireInvalidSubKeyMock.mockRejectedValue(new Error('disk full'))

      await useAuthStore.getState().confirmApiKeyNotice()

      expect(useAuthStore.getState().status).toBe('signedOut')
    })
  })

  // 회귀 가드: 로그아웃과 무효화는 저장소에 하는 일이 다르다. 섞이면 재개가 조용히 깨진다.
  it('signOut()은 무효화가 아니라 로그아웃 저장 함수로 지운다', async () => {
    primeNoticed()

    await useAuthStore.getState().signOut()

    expect(signOutAuthMock).toHaveBeenCalledTimes(1)
    expect(removeAllApiKeysMock).not.toHaveBeenCalled()
  })
})

// 429 는 키를 지우지 않고 다시 시도 모달로 알린다. 주 버튼은 같은 키로 연달아 받은 429 의 횟수로 정한다.
describe('useAuthStore: 429 다시 시도 모달', () => {
  function primeSignedIn(): void {
    useAuthStore.setState({ ...initialAuthState, status: 'signedIn', accounts: [account('acc-1')] })
  }

  it('다시 시도해도 같은 키로 또 429 면 두 번째다', () => {
    primeSignedIn()

    useAuthStore.getState().noticeApiKeyIssue('rateLimited', 'key-1')
    expect(useAuthStore.getState().apiKeyNotice).toEqual({ kind: 'rateLimited', apiKey: 'key-1', attempt: 1 })

    useAuthStore.getState().retryRateLimitNotice()
    expect(useAuthStore.getState().apiKeyNotice).toBeNull()
    useAuthStore.getState().noticeApiKeyIssue('rateLimited', 'key-1')
    expect(useAuthStore.getState().apiKeyNotice?.attempt).toBe(2)
  })

  it('그 키로 조회가 한 번이라도 성공하면 처음부터 센다', () => {
    primeSignedIn()
    useAuthStore.getState().noticeApiKeyIssue('rateLimited', 'key-1')
    useAuthStore.getState().retryRateLimitNotice()

    recordKeySuccess('key-1')
    useAuthStore.getState().noticeApiKeyIssue('rateLimited', 'key-1')

    expect(useAuthStore.getState().apiKeyNotice?.attempt).toBe(1)
  })

  it('키마다 따로 센다', () => {
    primeSignedIn()
    useAuthStore.getState().noticeApiKeyIssue('rateLimited', 'key-1')
    useAuthStore.getState().retryRateLimitNotice()

    useAuthStore.getState().noticeApiKeyIssue('rateLimited', 'key-2')

    expect(useAuthStore.getState().apiKeyNotice?.attempt).toBe(1)
  })

  // 서비스 단계 키도 여러 기기 · 다른 도구에서 함께 쓰면 잠깐 한도에 닿는다. 한 번의 429 로 멀쩡한 키를 지우지 않는다.
  it('다시 시도는 알림만 닫고 키를 지우지 않는다', () => {
    primeSignedIn()
    useAuthStore.getState().noticeApiKeyIssue('rateLimited', 'key-1')

    useAuthStore.getState().retryRateLimitNotice()

    expect(removeApiKeyMock).not.toHaveBeenCalled()
    expect(removeAllApiKeysMock).not.toHaveBeenCalled()
    expect(useAuthStore.getState().status).toBe('signedIn')
  })

  it('알림의 키가 메인 키인지 부계정 키인지 가른다', async () => {
    getAuthConfigMock.mockResolvedValue({
      login: null,
      mainKeyId: 'main-id',
      apiKeys: [
        { type: 'key', id: 'main-id', label: '', value: 'main-key', loginId: null },
        { type: 'key', id: 'sub-id', label: '', value: 'sub-key', loginId: 'login-id' },
      ],
    })

    await expect(useAuthStore.getState().rateLimitedKeyRole('main-key')).resolves.toBe('main')
    await expect(useAuthStore.getState().rateLimitedKeyRole('sub-key')).resolves.toBe('sub')
    await expect(useAuthStore.getState().rateLimitedKeyRole(null)).resolves.toBeNull()
  })

  describe('replaceMainApiKey', () => {
    beforeEach(() => {
      primeSignedIn()
      fetchCharacterListMock.mockResolvedValue([account('acc-2')])
    })

    // 앱 안에서 키만 바꾸는 것이라 로그인 화면의 새 로그인과 다르다. 추적 캐릭터를 비우지 않고 화면도 그대로다.
    it('새 키를 검증해 메인 키로 저장하고, 추적 목록을 비우지 않고 로그인 상태도 그대로다', async () => {
      await expect(useAuthStore.getState().replaceMainApiKey('new-key')).resolves.toBe('replaced')

      expect(setMainApiKeyMock).toHaveBeenCalledWith('new-key', '', undefined)
      expect(forgetTrackedSelectionMock).not.toHaveBeenCalled()
      expect(useAuthStore.getState().status).toBe('signedIn')
    })

    it('개발 단계 키면 저장하지 않고 developmentStage 이며, 로그인 상태는 그대로다', async () => {
      probeApiKeyStageMock.mockResolvedValue('developmentStage')

      await expect(useAuthStore.getState().replaceMainApiKey('dev-key')).resolves.toBe('developmentStage')

      expect(setMainApiKeyMock).not.toHaveBeenCalled()
      expect(useAuthStore.getState().status).toBe('signedIn')
      expect(useAuthStore.getState().developmentStageBlocked).toBe(true)
    })

    it('무효 키면 원인에 맞는 토스트를 띄우고 저장하지 않는다', async () => {
      fetchCharacterListMock.mockRejectedValue(new NexonBadRequestError('x', 'OPENAPI00005'))

      await expect(useAuthStore.getState().replaceMainApiKey('bad-key')).resolves.toBe('failed')

      expect(showErrorMock).toHaveBeenCalledWith('API 키가 유효하지 않습니다')
      expect(setMainApiKeyMock).not.toHaveBeenCalled()
    })
  })
})

describe('useAuthStore.signOut', () => {
  const forget = jest.requireMock('../../server-sync/forget') as Record<string, jest.Mock>

  // 로그아웃은 로그인만 푼다. 서버 데이터를 남기기로 했다.
  it('서버에 계정 삭제를 보내지 않는다', async () => {
    await useAuthStore.getState().signOut()

    expect(forget.requestAccountDeletion).not.toHaveBeenCalled()
  })

  // 넥슨 로그인만 떼는 로그아웃을 합쳤다. 메인 수단이 남으면 다른 넥슨 계정으로 앱이 계속 선다. 부계정 키는 저장 함수가 남긴다.
  it('넥슨 로그인과 메인 키를 함께 떼는 로그아웃 저장 함수를 부른다', async () => {
    getAuthConfigMock.mockResolvedValue({
      login: { type: 'login', id: 'account-login', session: '세션값' },
      mainKeyId: null,
      apiKeys: [{ type: 'key', id: 'account-key', label: '', value: '키', loginId: 'account-login' }],
    })

    await useAuthStore.getState().signOut()

    expect(signOutAuthMock).toHaveBeenCalledTimes(1)
  })

  it('서버 세션과 못 보낸 것을 거둔 뒤에 기기를 지운다', async () => {
    getAuthConfigMock.mockResolvedValue({
      login: { type: 'login', id: 'account-login', session: '세션값' },
      mainKeyId: null,
      apiKeys: [],
    })
    const 순서: string[] = []
    revokeNexonSessionMock.mockImplementation(async () => {
      순서.push('세션')
    })
    forget.clearUnsentServerData.mockImplementation(async () => {
      순서.push('못 보낸 것')
    })
    signOutAuthMock.mockImplementation(async () => {
      순서.push('기기')
    })

    await useAuthStore.getState().signOut()

    expect(revokeNexonSessionMock).toHaveBeenCalledWith('세션값')
    expect(순서).toEqual(['세션', '못 보낸 것', '기기'])
  })

  it('상태를 initialAuthState로 되돌리고 진입 단계를 처음으로 돌린다', async () => {
    useAuthStore.setState({
      status: 'signedIn',
      accounts: [account('acc-1')],
      error: null,
      apiKeyNotice: null,
      developmentStageBlocked: false,
    })

    await useAuthStore.getState().signOut()

    const state = useAuthStore.getState()
    expect(state.status).toBe('signedOut')
    expect(state.accounts).toEqual([])
    expect(entryResetMock).toHaveBeenCalledTimes(1)
  })
})

describe('useAuthStore.deleteAccount', () => {
  const forget = jest.requireMock('../../server-sync/forget') as Record<string, jest.Mock>

  // 키를 먼저 지우면 서버가 지울 사람을 찾을 값이 사라진다.
  it('서버에 예약한 뒤 로그아웃한다', async () => {
    const 순서: string[] = []
    forget.requestAccountDeletion.mockImplementation(async () => {
      순서.push('예약')
      return true
    })
    signOutAuthMock.mockImplementation(async () => {
      순서.push('기기')
    })

    await expect(useAuthStore.getState().deleteAccount()).resolves.toBe(true)

    expect(순서).toEqual(['예약', '기기'])
    expect(useAuthStore.getState().status).toBe('signedOut')
  })

  // 실패한 채 로그아웃하면 사용자는 지워질 줄 알지만 서버에는 예약이 없고, 키도 사라져 다시 할 수 없다.
  it('서버가 예약하지 못하면 로그아웃하지 않는다', async () => {
    useAuthStore.setState({ ...initialAuthState, status: 'signedIn' })
    forget.requestAccountDeletion.mockResolvedValue(false)

    await expect(useAuthStore.getState().deleteAccount()).resolves.toBe(false)

    expect(signOutAuthMock).not.toHaveBeenCalled()
    expect(useAuthStore.getState().status).toBe('signedIn')
  })
})

describe('useAuthStore.signIn: 개발 단계 키를 문 앞에서 막는다', () => {
  it('프로브가 개발 단계로 판정하면 키를 저장하지 않는다', async () => {
    fetchCharacterListMock.mockResolvedValue([account('acc-1')])
    probeApiKeyStageMock.mockResolvedValue('developmentStage')

    await useAuthStore.getState().signIn('dev-key')

    expect(useAuthStore.getState().developmentStageBlocked).toBe(true)
    expect(setMainApiKeyMock).not.toHaveBeenCalled()
    expect(showSuccessMock).not.toHaveBeenCalled()
    // 로그인이 안 됐으므로 진입 게이트도 안 움직인다.
    expect(resolveAfterSignInMock).not.toHaveBeenCalled()
  })

  // 알리는 것은 모달 하나다. 토스트는 스스로 사라져서 처방(서비스 단계 키를 새로 받는 것)이 함께
  // 사라지고, `error` 로 두면 그 값이 곧 토스트 문구라 같은 말이 두 번 나간다.
  it('토스트를 안 띄우고 `error` 도 안 세운다', async () => {
    fetchCharacterListMock.mockResolvedValue([account('acc-1')])
    probeApiKeyStageMock.mockResolvedValue('developmentStage')

    await useAuthStore.getState().signIn('dev-key')

    expect(showErrorMock).not.toHaveBeenCalled()
    expect(useAuthStore.getState().error).toBeNull()
  })

  // 모달 뒤에 폼이 살아 있어야 확인을 누르는 순간 바로 다시 입력할 수 있다. `verifying` 으로
  // 남으면 그 폼의 제출 버튼이 스피너로 굳는다.
  it('폼이 선 상태로 되돌아간다', async () => {
    fetchCharacterListMock.mockResolvedValue([account('acc-1')])
    probeApiKeyStageMock.mockResolvedValue('developmentStage')

    await useAuthStore.getState().signIn('dev-key')

    expect(useAuthStore.getState().status).toBe('signedOut')
  })

  it('확인을 누르면 모달만 닫힌다', async () => {
    fetchCharacterListMock.mockResolvedValue([account('acc-1')])
    probeApiKeyStageMock.mockResolvedValue('developmentStage')
    await useAuthStore.getState().signIn('dev-key')

    useAuthStore.getState().acknowledgeDevelopmentStageKey()

    const state = useAuthStore.getState()
    expect(state.developmentStageBlocked).toBe(false)
    expect(state.status).toBe('signedOut')
  })

  // 저장된 키를 지우지 않는다. 이 실패는 저장된 키가 죽은 것이 아니라 **새로 넣은 키를 안 받은**
  // 것이라, 쓰던 키가 있으면 그것이 살아 있어야 한다.
  it('저장소를 건드리지 않는다', async () => {
    fetchCharacterListMock.mockResolvedValue([account('acc-1')])
    probeApiKeyStageMock.mockResolvedValue('developmentStage')

    await useAuthStore.getState().signIn('dev-key')
    useAuthStore.getState().acknowledgeDevelopmentStageKey()

    expect(removeAllApiKeysMock).not.toHaveBeenCalled()
    expect(signOutAuthMock).not.toHaveBeenCalled()
  })

  // 저장한 뒤 지우는 순서로 두면 그 사이에 앱이 죽었을 때 개발 단계 키가 살아남고, 다음 부팅의
  // 단계 파생이 그 키로 앞 단계를 건너뛴다.
  it('프로브가 키 저장(`setMainApiKey`)보다 먼저 돈다', async () => {
    fetchCharacterListMock.mockResolvedValue([account('acc-1')])

    await useAuthStore.getState().signIn('key-1')

    expect(setMainApiKeyMock).toHaveBeenCalled()
    expect(probeApiKeyStageMock.mock.invocationCallOrder[0]).toBeLessThan(
      setMainApiKeyMock.mock.invocationCallOrder[0],
    )
  })

  // 키 오타는 흔한 실패다. 그때마다 열 건을 태우면 개발 단계 키 하루 예산이 오타 몇 번에 녹는다.
  it('검증이 실패하면 프로브를 안 돌린다', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonBadRequestError('x', 'OPENAPI00005'))

    await useAuthStore.getState().signIn('bad-key')

    expect(probeApiKeyStageMock).not.toHaveBeenCalled()
  })

  it('검증에 쓴 키를 그대로 잰다', async () => {
    fetchCharacterListMock.mockResolvedValue([account('acc-1')])

    await useAuthStore.getState().signIn('key-2')

    expect(probeApiKeyStageMock).toHaveBeenCalledWith(자격('key-2'))
  })

  // 판정이 안 서는 자리가 있다(안드로이드의 동시 5건 천장 · 느린 망 · 리미터의 버스트 허용).
  // 그때 벌어지는 일은 이 문이 서기 전과 같아야 한다.
  it('판정이 안 서면 그대로 통과시킨다', async () => {
    fetchCharacterListMock.mockResolvedValue([account('acc-1')])
    probeApiKeyStageMock.mockResolvedValue('undetermined')

    await useAuthStore.getState().signIn('key-1')

    expect(setMainApiKeyMock).toHaveBeenCalledWith('key-1', '', undefined)
    expect(useAuthStore.getState().error).toBeNull()
  })
})

// 키를 다시 받아 넣으면 그 키의 메이플 ID 가 속했던 옛 넥슨 계정을 잇는다. 그래야 그 계정의 기록이 이어진다.
describe('useAuthStore.signIn: 다시 받은 키가 옛 계정을 잇는다', () => {
  it('목록으로 찾은 옛 계정 id 로 키를 저장한다', async () => {
    fetchCharacterListMock.mockResolvedValue([account('acc-1')])
    probeApiKeyStageMock.mockResolvedValue('undetermined')
    reusableNexonAccountId.mockResolvedValue('account-old')

    await useAuthStore.getState().signIn('key-1')

    expect(reusableNexonAccountId).toHaveBeenCalledWith([account('acc-1')])
    expect(setMainApiKeyMock).toHaveBeenCalledWith('key-1', '', 'account-old')
  })
})

// 로그인 화면에서 들어오는 것은 새 로그인이라 캐릭터를 반드시 새로 고른다. 로그인 만료는 로그아웃을 거치지 않으므로 로그아웃
// 때 비우면 만료 뒤 다른 넥슨 ID 로 들어올 때 앞 목록이 남는다.
describe('useAuthStore.signIn: 새 로그인은 추적 목록을 비운다', () => {
  beforeEach(() => {
    fetchCharacterListMock.mockResolvedValue([account('acc-1')])
  })

  it('키를 저장하기 전에 추적 목록을 비운다', async () => {
    const order: string[] = []
    forgetTrackedSelectionMock.mockImplementation(async () => {
      order.push('forget')
    })
    setMainApiKeyMock.mockImplementation(async () => {
      order.push('save')
    })

    await useAuthStore.getState().signIn('key-1')

    expect(order).toEqual(['forget', 'save'])
  })

  it.each([
    ['키가 무효면', () => fetchCharacterListMock.mockRejectedValue(new NexonAuthError('401'))],
    ['개발 단계 키면', () => probeApiKeyStageMock.mockResolvedValue('developmentStage')],
  ])('%s 비우지 않는다', async (_label, arrange) => {
    arrange()

    await useAuthStore.getState().signIn('key-1')

    expect(forgetTrackedSelectionMock).not.toHaveBeenCalled()
  })
})

// 먼저 적으면 막힌 키의 캐릭터가 계정 칸이 빈 채로 남는다.
describe('useAuthStore.signIn: 소속은 키를 저장한 뒤에 적는다', () => {
  beforeEach(() => {
    fetchCharacterListMock.mockResolvedValue([account('acc-1')])
  })

  it('저장된 키의 계정 id 로 적는다', async () => {
    getAuthConfigMock.mockResolvedValue({ login: null, mainKeyId: '새-계정', apiKeys: [{ type: 'key', id: '새-계정', label: '', value: 'key-1', loginId: null }] })

    await useAuthStore.getState().signIn('key-1')

    expect(recordCharacterAccountsMock).toHaveBeenCalledWith([account('acc-1')], expect.any(String), '새-계정')
  })

  it('개발 단계 키로 막히면 적지 않는다', async () => {
    probeApiKeyStageMock.mockResolvedValue('developmentStage')

    await useAuthStore.getState().signIn('key-1')

    expect(recordCharacterAccountsMock).not.toHaveBeenCalled()
  })
})

// 연결 해제와 가른다. 둘 다 내부 데이터를 안 건드리고, **인증에서 지우는 범위**가 다르다.
// 로그아웃이 생기면서 로그인 화면에도 버튼이 선다. 그 화면에서 성공하면 **앱이 열려야 한다** -
// 진입 단계를 다시 판정하지 않으면 사용자는 로그인하고도 같은 화면에 남는다.
describe('useAuthStore.signInWithNexonAccount', () => {
  beforeEach(() => {
    signInWithNexonMock.mockResolvedValue({ kind: 'signedIn', accounts: [account('acc-1')] })
    currentCredentialMock.mockResolvedValue({ type: 'login', value: '토큰', accountId: 'login-id' })
  })

  it('성공하면 로그인이 저장 전에 받은 목록으로 진입 단계를 다시 판정하고, 목록을 다시 받지 않는다', async () => {
    const ok = await useAuthStore.getState().signInWithNexonAccount()

    expect(ok).toBe(true)
    expect(useAuthStore.getState().status).toBe('signedIn')
    expect(resolveAfterSignInMock).toHaveBeenCalledWith([account('acc-1')])
    expect(fetchCharacterListMock).not.toHaveBeenCalled()
  })

  it('받은 목록을 그 로그인의 캐시에 넣는다. 갈아끼운 로그인은 앞 로그인의 계정 id 를 이어받아 빈 목록이 남아 있을 수 있다', async () => {
    await useAuthStore.getState().signInWithNexonAccount()

    expect(readCachedCharacterList({ type: 'login', value: '토큰', accountId: 'login-id' })).toEqual([account('acc-1')])
  })

  it('메이플 ID 가 없는 넥슨 ID 면 그렇다고 말하고 앱을 열지 않는다', async () => {
    signInWithNexonMock.mockResolvedValue({ kind: 'noMapleId' })

    expect(await useAuthStore.getState().signInWithNexonAccount()).toBe(false)
    expect(showErrorMock).toHaveBeenCalledWith('이 넥슨 ID 에 연결된 메이플 ID 를 찾지 못했어요')
    expect(showSuccessMock).not.toHaveBeenCalled()
    expect(resolveAfterSignInMock).not.toHaveBeenCalled()
    expect(useAuthStore.getState().status).toBe('signedOut')
  })

  // today 의 `넥슨 ID 연동하기` 는 키로 쓰던 사람이 로그인을 붙이는 것이라 새 로그인이 아니다.
  it.each([
    ['로그인 화면이면 새 로그인으로', { fresh: true }, { fresh: true }],
    ['today 의 연동이면 새 로그인이 아닌 것으로', undefined, { fresh: false }],
  ])('%s 넥슨 로그인을 연다', async (_label, options, expected) => {
    await useAuthStore.getState().signInWithNexonAccount(options)

    expect(signInWithNexonMock).toHaveBeenCalledWith(expected)
  })

  it('취소는 아무 일도 안 일어난다', async () => {
    // 사용자가 창을 닫은 것이다. 안내를 띄우면 자기가 닫아 놓고 무엇이 잘못됐나 찾게 된다.
    signInWithNexonMock.mockResolvedValue({ kind: 'cancelled' })

    expect(await useAuthStore.getState().signInWithNexonAccount()).toBe(false)
    expect(showErrorMock).not.toHaveBeenCalled()
    expect(showSuccessMock).not.toHaveBeenCalled()
    expect(resolveAfterSignInMock).not.toHaveBeenCalled()
  })

  it('실패하면 말한다', async () => {
    signInWithNexonMock.mockResolvedValue({ kind: 'failed' })

    expect(await useAuthStore.getState().signInWithNexonAccount()).toBe(false)
    expect(showErrorMock).toHaveBeenCalledWith('넥슨 로그인에 실패했습니다')
  })

  it('진행 중에 다시 부르면 새로 시작하지 않는다', async () => {
    // 로그인 창은 하나만 열 수 있다. 두 번째 시작은 창을 못 열고 실패 토스트를 내는데, 그사이 첫 로그인은 성공한다.
    let finish: (result: { kind: 'signedIn'; accounts: MapleAccount[] }) => void = () => undefined
    signInWithNexonMock.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )

    const first = useAuthStore.getState().signInWithNexonAccount()
    const second = await useAuthStore.getState().signInWithNexonAccount()
    finish({ kind: 'signedIn', accounts: [account('acc-1')] })

    expect(second).toBe(false)
    expect(await first).toBe(true)
    expect(signInWithNexonMock).toHaveBeenCalledTimes(1)
    expect(showErrorMock).not.toHaveBeenCalled()

    // 끝나면 다시 누를 수 있다.
    await useAuthStore.getState().signInWithNexonAccount()
    expect(signInWithNexonMock).toHaveBeenCalledTimes(2)
  })
})

// 메이플 ID 가 없는 넥슨 로그인이 이미 저장된 기기의 출구. 조회는 로그인이 있으면 늘 로그인으로 가서, 로그인을 떼지 않으면 빈 화면에서 못 나온다.
describe('useAuthStore.leaveEmptyNexonLogin', () => {
  const 빈로그인 = { type: 'login', id: 'login-id', session: '빈세션' }
  const 키 = { type: 'key', id: 'account-key', label: '', value: 'key-1', loginId: null }
  const 부계정키 = { type: 'key', id: 'sub-key', label: '', value: 'key-2', loginId: 'login-id' }

  beforeEach(() => {
    useAuthStore.setState({ ...initialAuthState, status: 'signedIn' })
  })

  it('서버 세션을 거두고 넥슨 로그인만 뗀다. API 키는 지우지 않는다', async () => {
    getAuthConfigMock.mockResolvedValueOnce({ login: 빈로그인, mainKeyId: 'account-key', apiKeys: [키] }).mockResolvedValue({ login: null, mainKeyId: 'account-key', apiKeys: [키] })

    await useAuthStore.getState().leaveEmptyNexonLogin()

    expect(revokeNexonSessionMock).toHaveBeenCalledWith('빈세션')
    expect(clearNexonLoginMock).toHaveBeenCalled()
    expect(removeAllApiKeysMock).not.toHaveBeenCalled()
    expect(removeApiKeyMock).not.toHaveBeenCalled()
  })

  it('API 키가 남으면 로그인 상태로 두고 true 다. 화면이 그 키로 목록을 다시 받는다', async () => {
    getAuthConfigMock.mockResolvedValueOnce({ login: 빈로그인, mainKeyId: 'account-key', apiKeys: [키] }).mockResolvedValue({ login: null, mainKeyId: 'account-key', apiKeys: [키] })

    await expect(useAuthStore.getState().leaveEmptyNexonLogin()).resolves.toBe(true)
    expect(useAuthStore.getState().status).toBe('signedIn')
    expect(entryResetMock).not.toHaveBeenCalled()
  })

  it('남은 수단이 없으면 로그인 화면으로 보내고 false 다', async () => {
    getAuthConfigMock.mockResolvedValueOnce({ login: 빈로그인, mainKeyId: null, apiKeys: [] }).mockResolvedValue(null)

    await expect(useAuthStore.getState().leaveEmptyNexonLogin()).resolves.toBe(false)
    expect(useAuthStore.getState().status).toBe('signedOut')
    expect(entryResetMock).toHaveBeenCalled()
  })

  it('로그인에 귀속된 부계정 키만 남으면 남은 수단이 아니다. 로그인 화면으로 보낸다', async () => {
    getAuthConfigMock
      .mockResolvedValueOnce({ login: 빈로그인, mainKeyId: null, apiKeys: [부계정키] })
      .mockResolvedValue({ login: null, mainKeyId: null, apiKeys: [부계정키] })

    await expect(useAuthStore.getState().leaveEmptyNexonLogin()).resolves.toBe(false)
    expect(removeApiKeyMock).not.toHaveBeenCalled()
    expect(entryResetMock).toHaveBeenCalled()
  })

  it('로그인을 떼다 실패하면 무엇이 남았는지 모르므로 로그인 화면으로 보낸다', async () => {
    getAuthConfigMock.mockResolvedValue({ login: 빈로그인, mainKeyId: 'account-key', apiKeys: [키] })
    clearNexonLoginMock.mockRejectedValue(new Error('디스크'))

    await expect(useAuthStore.getState().leaveEmptyNexonLogin()).resolves.toBe(false)
    expect(useAuthStore.getState().status).toBe('signedOut')
    expect(entryResetMock).toHaveBeenCalled()
  })
})
