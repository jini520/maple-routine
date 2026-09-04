import type { MapleAccount } from '../../../types'
import {
  NexonAuthError,
  NexonBadRequestError,
  NexonNetworkError,
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
  setApiKey: jest.fn(),
  clearAuthConfig: jest.fn(),
  removeApiKey: jest.fn(),
}))
const { getAuthConfig: getAuthConfigMock, setApiKey: setApiKeyMock, clearAuthConfig: clearAuthConfigMock, removeApiKey: removeApiKeyMock } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>

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

import { useAuthStore } from '../store'

function account(accountId: string): MapleAccount {
  return {
    accountId,
    characters: [
      {
        ocid: `ocid-${accountId}`,
        name: `캐릭터-${accountId}`,
        world: '베라',
        jobClass: '렌',
        level: 200,
      },
    ],
  }
}

beforeEach(() => {
  useAuthStore.setState(initialAuthState)
  setApiKeyMock.mockResolvedValue(undefined)
  clearAuthConfigMock.mockResolvedValue(undefined)
  removeApiKeyMock.mockResolvedValue(undefined)
  resolveAfterSignInMock.mockResolvedValue(undefined)
  // 판정이 안 서는 것이 통상 경로다. 서는 경우만 그 테스트가 직접 세운다.
  probeApiKeyStageMock.mockResolvedValue('undetermined')
  getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1' })
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

  it('저장된 키가 있으면 signedIn 이 된다. 네트워크는 안 탄다', async () => {
    getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1' })

    await useAuthStore.getState().restoreFromStorage()

    expect(useAuthStore.getState().status).toBe('signedIn')
    expect(fetchCharacterListMock).not.toHaveBeenCalled()
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
    expect(setApiKeyMock).not.toHaveBeenCalled()
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
    expect(setApiKeyMock).not.toHaveBeenCalled()
    expect(resolveAfterSignInMock).not.toHaveBeenCalled()
  })

  // 전에는 원인과 무관하게 한 문구였다. 바로 아래에서 원인을 계산해 state에
  // 넣으면서도 토스트는 그 값을 쓰지 않았다.
  it.each([
    [new NexonAuthError('invalid'), 'API 키가 유효하지 않습니다'],
    // 토스트는 원인만. 처방은 인라인 자리가 준다.
    [new NexonRateLimitError('rate limited'), '호출 한도를 초과했습니다'],
    [new NexonNetworkError('network fail'), '네트워크 오류가 발생했습니다'],
  ])('목록 조회 실패를 원인별 문구로 알린다 (%o)', async (error, expected) => {
    fetchCharacterListMock.mockRejectedValue(error)

    await useAuthStore.getState().signIn('key-1')

    expect(showErrorMock).toHaveBeenCalledWith(expected)
    expect(showSuccessMock).not.toHaveBeenCalled()
  })

  // 전에는 setApiKey가 try 밖이라 미처리 rejection이었다. 아무 일도 안 일어난
  // 것처럼 보였다. storageWriteFailed 문구가 이 경로로 처음 도달 가능해진다.
  it('키 저장에 실패하면 storageWriteFailed 로 남고 토스트로 알린다', async () => {
    fetchCharacterListMock.mockResolvedValue([{ accountId: 'acc-1', characters: [] }])
    setApiKeyMock.mockRejectedValue(new Error('write failed'))

    await useAuthStore.getState().signIn('key-1')

    const state = useAuthStore.getState()
    expect(state.status).toBe('signedOut')
    expect(state.error).toEqual({ kind: 'storageWriteFailed' })
    expect(showErrorMock).toHaveBeenCalledWith('기기에 저장하지 못했습니다. 다시 시도해주세요')
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
      expect(state.apiKeyNotice).toBe(kind)
      expect(state.status).toBe('signedIn')
    },
  )

  // 알리는 시점에는 아무것도 지우지 않는다. 확인 전에 지우면 사용자가 취소할 수 없는 일이 이미 끝난다.
  it.each(['invalid', 'rateLimited'] as const)(
    '%s. 저장소를 건드리지 않고 토스트도 띄우지 않는다(문구는 모달이 말한다)',
    (kind) => {
      primeSignedIn()

      useAuthStore.getState().noticeApiKeyIssue(kind)

      expect(removeApiKeyMock).not.toHaveBeenCalled()
      expect(clearAuthConfigMock).not.toHaveBeenCalled()
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
    expect(useAuthStore.getState().apiKeyNotice).toBe('rateLimited')
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
    expect(removeApiKeyMock).not.toHaveBeenCalled()
  })

  // 429 로 로스터가 비는 하드 잠금은 **캐릭터 설정 화면**에서 난다. 그 화면도 로그인 상태라
  // 이 문을 지난다. 막으면 출구가 정작 잠긴 사람에게 안 열린다(#176).
  it('캐릭터 설정 중에도 알린다. 그 화면도 signedIn 이다', () => {
    primeSignedIn()

    useAuthStore.getState().noticeApiKeyIssue('rateLimited')

    const state = useAuthStore.getState()
    expect(state.apiKeyNotice).toBe('rateLimited')
    // 알리기만 한다. status를 뒤집는 것은 확인(confirmApiKeyNotice)의 몫이다.
    expect(state.status).toBe('signedIn')
    expect(removeApiKeyMock).not.toHaveBeenCalled()
  })
})

describe('useAuthStore.confirmApiKeyNotice', () => {
  function primeNoticed(kind: 'invalid' | 'rateLimited' = 'invalid'): void {
    useAuthStore.setState({
      status: 'signedIn',
      accounts: [account('acc-1')],
      error: null,
      apiKeyNotice: kind,
      developmentStageBlocked: false,
    })
  }

  // 상태를 뒤집는 것이 곧 이동이다. 화면 목록을 가르는 것은 진입 게이트라 그쪽도 함께 되돌린다.
  it.each(['invalid', 'rateLimited'] as const)(
    '%s. signedOut 으로 되돌리고 진입 게이트도 로그인으로 보낸다(알림도 함께 꺼진다)',
    async (kind) => {
      primeNoticed(kind)

      await useAuthStore.getState().confirmApiKeyNotice()

      expect(useAuthStore.getState()).toMatchObject(initialAuthState)
      expect(entryResetMock).toHaveBeenCalledTimes(1)
    },
  )

  // clearAuthConfig 는 지우는 범위가 넓어 재개를 불가능하게 만든다. 429 도 키를
  // 지운다. 원인별로 갈라 처리하지 않는다.
  it.each(['invalid', 'rateLimited'] as const)(
    '%s. 저장소에서 apiKey만 지운다(연결 해제 경로 clearAuthConfig를 타지 않는다)',
    async (kind) => {
      primeNoticed(kind)

      await useAuthStore.getState().confirmApiKeyNotice()

      expect(removeApiKeyMock).toHaveBeenCalledTimes(1)
      expect(clearAuthConfigMock).not.toHaveBeenCalled()
    },
  )

  // 알림이 없는데 확인이 불릴 일은 없지만, 불려도 저장된 키를 지우지 않아야 한다.
  it('알림이 켜져 있지 않으면 아무 일도 하지 않는다', async () => {
    useAuthStore.setState({ ...initialAuthState, status: 'signedIn' })

    await useAuthStore.getState().confirmApiKeyNotice()

    expect(useAuthStore.getState().status).toBe('signedIn')
    expect(removeApiKeyMock).not.toHaveBeenCalled()
    expect(entryResetMock).not.toHaveBeenCalled()
  })

  // 알려진 열화. 삭제가 실패해도 같은 길을 한 번 더 돌 뿐이라 막다른 길이 아니다. rethrow
  // 하면 호출부가 void 호출이라 미처리 rejection 이 된다.
  it('저장소 삭제가 실패해도 reject하지 않고 화면 이동은 그대로다', async () => {
    primeNoticed()
    removeApiKeyMock.mockRejectedValue(new Error('disk full'))

    await expect(useAuthStore.getState().confirmApiKeyNotice()).resolves.toBeUndefined()

    expect(useAuthStore.getState().status).toBe('signedOut')
  })

  // 회귀 가드: 연결 해제와 무효화는 저장소에 하는 일이 다르다. 섞이면 재개가 조용히 깨진다.
  it('signOut()은 여전히 clearAuthConfig로 넓게 지운다', async () => {
    primeNoticed()

    await useAuthStore.getState().signOut()

    expect(clearAuthConfigMock).toHaveBeenCalledTimes(1)
    expect(removeApiKeyMock).not.toHaveBeenCalled()
  })
})

describe('useAuthStore.signOut', () => {
  it('clearAuthConfig를 호출하고 상태를 initialAuthState로 되돌린다', async () => {
    useAuthStore.setState({
      status: 'signedIn',
      accounts: [account('acc-1')],
      error: null,
      apiKeyNotice: null,
      developmentStageBlocked: false,
    })

    await useAuthStore.getState().signOut()

    expect(clearAuthConfigMock).toHaveBeenCalled()
    const state = useAuthStore.getState()
    expect(state.status).toBe('signedOut')
    expect(state.accounts).toEqual([])
    expect(state.error).toBeNull()
    expect(entryResetMock).toHaveBeenCalledTimes(1)
  })
})

describe('useAuthStore.signIn: 개발 단계 키를 문 앞에서 막는다', () => {
  it('프로브가 개발 단계로 판정하면 키를 저장하지 않는다', async () => {
    fetchCharacterListMock.mockResolvedValue([account('acc-1')])
    probeApiKeyStageMock.mockResolvedValue('developmentStage')

    await useAuthStore.getState().signIn('dev-key')

    expect(useAuthStore.getState().developmentStageBlocked).toBe(true)
    expect(setApiKeyMock).not.toHaveBeenCalled()
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

    expect(removeApiKeyMock).not.toHaveBeenCalled()
    expect(clearAuthConfigMock).not.toHaveBeenCalled()
  })

  // 저장한 뒤 지우는 순서로 두면 그 사이에 앱이 죽었을 때 개발 단계 키가 살아남고, 다음 부팅의
  // 단계 파생이 그 키로 앞 단계를 건너뛴다.
  it('프로브가 `setApiKey` 보다 먼저 돈다', async () => {
    fetchCharacterListMock.mockResolvedValue([account('acc-1')])

    await useAuthStore.getState().signIn('key-1')

    expect(setApiKeyMock).toHaveBeenCalled()
    expect(probeApiKeyStageMock.mock.invocationCallOrder[0]).toBeLessThan(
      setApiKeyMock.mock.invocationCallOrder[0],
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

    expect(probeApiKeyStageMock).toHaveBeenCalledWith('key-2')
  })

  // 판정이 안 서는 자리가 있다(안드로이드의 동시 5건 천장 · 느린 망 · 리미터의 버스트 허용).
  // 그때 벌어지는 일은 이 문이 서기 전과 같아야 한다.
  it('판정이 안 서면 그대로 통과시킨다', async () => {
    fetchCharacterListMock.mockResolvedValue([account('acc-1')])
    probeApiKeyStageMock.mockResolvedValue('undetermined')

    await useAuthStore.getState().signIn('key-1')

    expect(setApiKeyMock).toHaveBeenCalledWith('key-1')
    expect(useAuthStore.getState().error).toBeNull()
  })
})
