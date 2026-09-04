/**
 * 로그인. API 키를 검증하고 저장하고, 그 키가 죽었을 때 다시 받는 길을 낸다.
 *
 * 넥슨 프렌즈로 승급되면 키 입력이 OAuth2 로 갈린다. 그때 바뀌는 것이 이 파일과 `SignInScreen`
 * 이고, 진입 단계와 캐릭터 설정은 안 움직인다.
 *
 * **진입 게이트를 부르는 방향은 여기서 저쪽 한쪽이다.** 로그인·로그아웃이 화면을 바꾸는 일이라
 * 그 결과를 `useAppEntryStore` 에 알린다.
 */
import { create } from 'zustand'
import { fetchCharacterList } from '../../nexon/character'
import { probeApiKeyStage } from '../../nexon/key-stage'
import { isInvalidApiKeyError, NexonRateLimitError } from '../../nexon/errors'
import { clearAuthConfig, getAuthConfig, removeApiKey, setApiKey } from '../../storage/api-key'
import { useAppEntryStore } from '../app-entry/store'
import { useToastStore } from '../toast/store'
import { formatAuthError } from './format'
import {
  authReducer,
  initialAuthState,
  type ApiKeyNoticeKind,
  type AuthError,
  type AuthState,
} from './state'

export interface AuthStore extends AuthState {
  restoreFromStorage(): Promise<void>
  signIn(apiKey: string): Promise<void>
  // 개발 단계 키 모달의 확인. 모달만 닫고 저장소는 건드리지 않는다. 아래 confirmApiKeyNotice 와
  // 갈리는 자리다. 저쪽은 저장된 키가 죽은 것이라 지우지만, 이쪽은 새 키를 안 받은 것뿐이다.
  acknowledgeDevelopmentStageKey(): void
  // 저장된 키로 앞으로 갈 수 없게 됐을 때는 여기로만 들어온다. 원인은 무효 키(400 OPENAPI00005 ·
  // 401/403)와 429 둘이고 사슬은 하나이며 문구만 갈린다. 알리기만 하고 이동·삭제는 아래
  // confirmApiKeyNotice 가 한다.
  noticeApiKeyIssue(kind: ApiKeyNoticeKind): void
  // 그 모달의 "확인". 로그인 화면으로 이동하고 저장된 apiKey 를 지운다(원인과 무관하게 같다).
  confirmApiKeyNotice(): Promise<void>
  // 연결 해제. 저장된 인증 정보를 통째로 버린다.
  signOut(): Promise<void>
}

function toAuthError(error: unknown): AuthError {
  // 400 OPENAPI00005 도 무효 키다(판정은 nexon/errors 한 곳). 이 폼에서 키를 잘못 입력했을 때
  // 네트워크 오류라고 말하면 원인이 키인데 네트워크를 가리키게 된다.
  if (isInvalidApiKeyError(error)) {
    return { kind: 'invalidApiKey' }
  }
  if (error instanceof NexonRateLimitError) {
    return { kind: 'rateLimited' }
  }
  return { kind: 'network' }
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  ...initialAuthState,

  // 키 하나만 본다. 뒤 단계의 재개는 `useAppEntryStore` 가 저장된 값에서 따로 파생한다.
  async restoreFromStorage() {
    if ((await getAuthConfig()) === null) {
      return
    }

    set((state) => authReducer(state, { type: 'RESTORE_SIGNED_IN' }))
  },

  async signIn(apiKey: string) {
    set((state) => authReducer(state, { type: 'SUBMIT_API_KEY' }))

    let accounts: AuthState['accounts']
    try {
      accounts = await fetchCharacterList(apiKey)
    } catch (error) {
      const authError = toAuthError(error)
      useToastStore.getState().showError(formatAuthError(authError))
      set((state) => authReducer(state, { type: 'API_KEY_REJECTED', error: authError }))
      return
    }

    // 검증이 성공한 뒤에만 잰다. 키 오타는 흔한 실패인데 그때마다 열 건을 태우면 개발 단계
    // 키의 하루 예산이 오타 몇 번에 녹는다.
    //
    // **저장보다 먼저**여야 한다. 저장한 뒤 지우는 순서면 그 사이에 앱이 죽었을 때 개발 단계
    // 키가 살아남고, 다음 부팅의 단계 파생이 그 키로 앞 단계를 건너뛴다.
    //
    // 알리는 것은 모달 하나다. 토스트를 함께 띄우지 않는 것은 그것이 스스로 사라져 처방(서비스
    // 단계 키를 새로 받는 것)까지 데려가기 때문이다.
    if ((await probeApiKeyStage(apiKey)) === 'developmentStage') {
      set((state) => authReducer(state, { type: 'DEVELOPMENT_STAGE_KEY_BLOCKED' }))
      return
    }

    // try 밖이면 미처리 rejection 이라 저장이 실패해도 아무 일도 안 일어난 것처럼 보인다.
    try {
      await setApiKey(apiKey)
    } catch {
      const authError = { kind: 'storageWriteFailed' } as const
      useToastStore.getState().showError(formatAuthError(authError))
      set((state) => authReducer(state, { type: 'API_KEY_REJECTED', error: authError }))
      return
    }

    useToastStore.getState().showSuccess('API 키를 확인했어요')
    set((state) => authReducer(state, { type: 'API_KEY_VERIFIED', accounts }))

    // 키 재입력이면 뒤 단계를 저장된 값으로 재개한다. 캐릭터를 다시 묻지 않는다. 파생은 부팅과
    // 같은 함수 하나가 하고(setApiKey 뒤라야 authConfig가 채워져 있다), 남의 계정 키로 이전
    // 목록을 쓰게 두지 않는 대조도 저쪽이 진다.
    await useAppEntryStore.getState().resolveAfterSignIn(accounts)
  },

  acknowledgeDevelopmentStageKey() {
    set((state) => authReducer(state, { type: 'DEVELOPMENT_STAGE_KEY_ACKNOWLEDGED' }))
  },

  // 저장된 키로 앞으로 갈 수 없게 되면 알리기만 한다. 화면을 빼앗지 않는다. 이동이 먼저
  // 일어나면 사용자는 이미 바뀐 화면에서 이유를 읽게 되고, 토스트는 스스로 사라져 놓칠 수
  // 있다. 원래 화면 위에 닫을 수 없는 모달이 덮이고 이동은 확인을 눌러야 일어난다. 429 도
  // 이 사슬을 그대로 탄다. 처방이 같아 화면도 같고 갈리는 것은 문구뿐이다.
  noticeApiKeyIssue(kind: ApiKeyNoticeKind) {
    // 멱등 가드. 동기 함수라 이 구간 전체가 원자적이다. 여러 화면·여러 캐릭터에서
    // 동시에 터져도 모달은 하나이고, 원인이 겹치면 **먼저 뜬 것**이 유지된다(리듀서도 같은 규칙).
    if (get().apiKeyNotice !== null) {
      return
    }

    // 로그인 상태가 아니면 이미 로그인 화면에 서 있어 보낼 곳이 없고, 그래서 재이동 루프도
    // 불가능하다. 캐릭터 설정 단계는 로그인 상태라 이 문을 지난다. 429 로 로스터가 비는 잠금이
    // 거기서 일어나므로 그 단계를 막으면 잠긴 사용자를 못 구한다.
    if (get().status !== 'signedIn') {
      return
    }

    // status 는 그대로다. 뒤에 원래 화면이 남아 있어야 사용자가 무엇을 하다 이렇게 됐는지
    // 보면서 이유를 읽는다. 저장소도 아직 건드리지 않는다.
    set((state) => authReducer(state, { type: 'API_KEY_NOTICED', kind }))
  },

  // 모달의 확인. 여기서야 이동과 삭제가 일어난다. 원인별로 갈라 처리하지 않는다. 429 도 키를
  // 지운다. 안 지우면 재시작 때 같은 키로 앱이 열려 또 막히고, 사용자에게는 재시작하면 되는
  // 것처럼 보이다가 안 되는 상태가 된다. 같은 키를 다시 붙여넣는 것은 안 막는다.
  async confirmApiKeyNotice() {
    if (get().apiKeyNotice === null) {
      return
    }

    // 이동은 상태를 뒤집는 것으로 일어난다. 스토어는 라우터를 모른다. 무효화와 연결 해제의
    // 차이는 상태가 아니라 저장소에서 무엇을 지우는가에 있다.
    set((state) => authReducer(state, { type: 'SIGNED_OUT' }))
    useAppEntryStore.getState().reset()

    try {
      await removeApiKey()
    } catch {
      // 삭제가 실패하면 재시작 시 옛 무효 키가 되살아나지만 그때는 다시 이 경로를 탈 뿐이라
      // 막다른 길이 아니다. rethrow 하면 호출부가 전부 void 호출이라 미처리 rejection 이 된다.
    }
  },

  async signOut() {
    await clearAuthConfig()
    set((state) => authReducer(state, { type: 'SIGNED_OUT' }))
    useAppEntryStore.getState().reset()
  },
}))
