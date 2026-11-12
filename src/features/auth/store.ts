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
import { fetchAndRecordCharacterList, fetchUnsavedCharacterList, recordCharacterList } from '../mvp-grade/character-list'
import { probeApiKeyStage } from '../../nexon/key-stage'
import { lastKeySuccessAt } from '../../nexon/key-success'
import {
  clearNexonLogin,
  getAuthConfig,
  removeAllApiKeys,
  removeApiKey,
  setMainApiKey,
  signOutAuth,
} from '../../storage/api-key'
import { useAppEntryStore } from '../app-entry/store'
import { revokeNexonSession } from '../../server/nexon-auth'
import { useToastStore } from '../toast/store'
import { formatAuthError, toAuthError } from './format'
import { apiKeyCredential, credentialOf } from '../../lib/nexon-credential'
import { signInWithNexon } from './nexon-login'
import { pruneCoveredApiKeys } from './prune-covered-keys'
import { currentCredential } from './current-credential'
import { reusableNexonAccountId } from './reentry-account-id'
import { destinationOf, planInvalidSubKey, retireInvalidSubKey, type InvalidKeyDestination } from './key-problem'
import { useAccountManageOpenStore } from '../account-manage/open-request'
import {
  authReducer,
  initialAuthState,
  type ApiKeyNoticeKind,
  type AuthState,
} from './state'
import { clearUnsentServerData, requestAccountDeletion } from '../server-sync/forget'
import { forgetTrackedSelection } from '../character-selection/forget'

export interface AuthStore extends AuthState {
  restoreFromStorage(): Promise<void>
  /** 키를 검증하고 저장한다. 앱으로 넘어갈 수 있으면 `true`(화면이 다음 온보딩 화면을 민다). */
  signIn(apiKey: string): Promise<boolean>
  // 개발 단계 키 모달의 확인. 모달만 닫고 저장소는 건드리지 않는다. 아래 confirmApiKeyNotice 와
  // 갈리는 자리다. 저쪽은 저장된 키가 죽은 것이라 지우지만, 이쪽은 새 키를 안 받은 것뿐이다.
  acknowledgeDevelopmentStageKey(): void
  // 저장된 키로 앞으로 갈 수 없게 됐을 때는 여기로만 들어온다. 원인은 무효 키(400 OPENAPI00005 ·
  // 401/403)와 429 둘이고 사슬은 하나이며 문구만 갈린다. 알리기만 하고 이동·삭제는 아래
  // confirmApiKeyNotice 가 한다.
  noticeApiKeyIssue(kind: ApiKeyNoticeKind, apiKey?: string): void
  // 그 모달의 "확인". 죽은 수단을 지우고, 남은 수단이 없을 때만 로그인 화면으로 보낸다. 429 는 이 길을 타지 않는다.
  // 지금 로그인의 부계정 키는 지우지 않고 무효로 표시한 뒤 계정 관리 목록이나 캐릭터 설정으로 보낸다.
  confirmApiKeyNotice(): Promise<void>
  /** 무효 키 알림의 `확인` 뒤 가는 곳. 모달 본문이 쓴다. 확인과 같은 판정이라 읽은 곳으로 간다 */
  invalidKeyDestination(apiKey: string | null): Promise<InvalidKeyDestination>
  /** 429 모달의 `다시 시도`. 알림만 닫는다. 키는 지우지 않는다. 다시 부르는 것은 화면이 한다 */
  retryRateLimitNotice(): void
  /** 429 를 받은 키가 메인 키인지 부계정 키인지. `다른 키 입력` 이 여는 곳을 가른다. 모르면 `null` */
  rateLimitedKeyRole(apiKey: string | null): Promise<'main' | 'sub' | null>
  /**
   * 429 모달의 `다른 키 입력` 으로 받은 새 키를 메인 키로 바꾼다. 검증과 개발 단계 판정은 로그인과 같다.
   * 앱 안에서 키만 바꾸는 것이라 로그인 상태와 추적 목록은 그대로다. 옛 메인 키는 새 키를 저장할 때 빠진다.
   */
  replaceMainApiKey(apiKey: string): Promise<'replaced' | 'developmentStage' | 'failed'>
  /**
   * 넥슨 로그인 한 번. **끝나면 앱이 열린다.**
   *
   * `signInWithNexon` 은 세션을 적는 데까지다. 여기서 목록을 받아 진입 단계를 다시 판정해야
   * 로그인 화면에 선 사용자가 그 자리를 벗어난다.
   *
   * 앱으로 넘어갈 수 있으면 `true`.
   *
   * @param options 로그인 화면이면 `{ fresh: true }`. 앞 로그인의 추적 목록을 비운다
   */
  signInWithNexonAccount(options?: { fresh?: boolean }): Promise<boolean>
  /** 로그아웃. 넥슨 로그인과 API 키를 모두 뗀다. 앱 데이터와 서버 데이터는 남는다. */
  signOut(): Promise<void>
  /** 계정 삭제를 서버에 예약하고 로그아웃한다. 서버가 받지 못하면 로그아웃하지 않고 `false` 다. */
  deleteAccount(): Promise<boolean>
}

/**
 * 넥슨 로그인이 진행 중인가. 로그인 창은 한 번에 하나만 열 수 있어서, 두 번째 시작은 창을 못 열고 실패 토스트를 낸다.
 * 그사이 첫 로그인은 끝까지 가므로 사용자는 로그인이 됐는데도 실패했다는 말을 듣는다.
 */
let nexonSignInRunning = false

/** 키마다 마지막으로 띄운 429 알림의 차례와 시각. 기기에 남기지 않는다. 앱을 다시 켜면 처음부터 센다 */
const rateLimitNotices = new Map<string, { attempt: number; at: number }>()

/** 같은 키로 연달아 받은 429 의 차례. 앞 알림 뒤에 그 키로 조회가 한 번이라도 성공했으면 처음부터 센다. */
function rateLimitAttemptOf(apiKey: string | null): number {
  const slot = apiKey ?? ''
  const previous = rateLimitNotices.get(slot)
  const succeeded = apiKey === null ? undefined : lastKeySuccessAt(apiKey)
  const attempt =
    previous !== undefined && (succeeded === undefined || succeeded < previous.at) ? previous.attempt + 1 : 1
  rateLimitNotices.set(slot, { attempt, at: Date.now() })
  return attempt
}

export function resetRateLimitNoticesForTest(): void {
  rateLimitNotices.clear()
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  ...initialAuthState,

  // 키 하나만 본다. 뒤 단계의 재개는 `useAppEntryStore` 가 저장된 값에서 따로 파생한다.
  async restoreFromStorage() {
    if (credentialOf(await getAuthConfig()) === null) {
      return
    }

    set((state) => authReducer(state, { type: 'RESTORE_SIGNED_IN' }))
    // 로그인 직후 서버에서 잇지 못해 남은 키를 다시 다룬다. 앱을 여는 일은 기다리지 않는다.
    void pruneCoveredApiKeys().catch(() => undefined)
  },

  async signIn(apiKey: string) {
    set((state) => authReducer(state, { type: 'SUBMIT_API_KEY' }))

    // 소속은 계정 id 를 정한 뒤에 적는다. 먼저 적으면 막힌 키의 캐릭터가 계정 칸이 빈 채로 남는다.
    let accounts: AuthState['accounts']
    try {
      accounts = await fetchUnsavedCharacterList(apiKeyCredential(apiKey))
    } catch (error) {
      const authError = toAuthError(error)
      useToastStore.getState().showError(formatAuthError(authError))
      set((state) => authReducer(state, { type: 'API_KEY_REJECTED', error: authError }))
      return false
    }

    // 검증이 성공한 뒤에만 잰다. 키 오타는 흔한 실패인데 그때마다 판정 건수를 태우면 개발 단계
    // 키의 하루 예산이 오타 몇 번에 녹는다.
    //
    // **저장보다 먼저**여야 한다. 저장한 뒤 지우는 순서면 그 사이에 앱이 죽었을 때 개발 단계
    // 키가 살아남고, 다음 부팅의 단계 파생이 그 키로 앞 단계를 건너뛴다.
    //
    // 알리는 것은 모달 하나다. 토스트를 함께 띄우지 않는 것은 그것이 스스로 사라져 처방(서비스
    // 단계 키를 새로 받는 것)까지 데려가기 때문이다.
    if ((await probeApiKeyStage(apiKeyCredential(apiKey))) === 'developmentStage') {
      set((state) => authReducer(state, { type: 'DEVELOPMENT_STAGE_KEY_BLOCKED' }))
      return false
    }

    // try 밖이면 미처리 rejection 이라 저장이 실패해도 아무 일도 안 일어난 것처럼 보인다.
    try {
      // 로그인 화면에서 들어온 새 로그인이라 캐릭터를 새로 고른다.
      const reusedId = (await reusableNexonAccountId(accounts)) ?? undefined
      await forgetTrackedSelection()
      await setMainApiKey(apiKey, '', reusedId)
      const saved = (await getAuthConfig())?.apiKeys.find((one) => one.value === apiKey)
      recordCharacterList(accounts, saved?.id ?? null)
    } catch {
      const authError = { kind: 'storageWriteFailed' } as const
      useToastStore.getState().showError(formatAuthError(authError))
      set((state) => authReducer(state, { type: 'API_KEY_REJECTED', error: authError }))
      return false
    }

    useToastStore.getState().showSuccess('API 키를 확인했어요')
    set((state) => authReducer(state, { type: 'API_KEY_VERIFIED', accounts }))

    // 추적 목록을 비웠으므로 캐릭터 설정으로 간다. 파생은 부팅과 같은 함수 하나가 한다(setApiKey 뒤라야 authConfig 가
    // 채워져 있다).
    await useAppEntryStore.getState().resolveAfterSignIn(accounts)
    return true
  },

  acknowledgeDevelopmentStageKey() {
    set((state) => authReducer(state, { type: 'DEVELOPMENT_STAGE_KEY_ACKNOWLEDGED' }))
  },

  // 저장된 키로 앞으로 갈 수 없게 되면 알리기만 한다. 화면을 빼앗지 않는다. 이동이 먼저
  // 일어나면 사용자는 이미 바뀐 화면에서 이유를 읽게 되고, 토스트는 스스로 사라져 놓칠 수
  // 있다. 원래 화면 위에 닫을 수 없는 모달이 덮이고 이동은 확인을 눌러야 일어난다. 429 도
  // 이 사슬을 그대로 탄다. 처방이 같아 화면도 같고 갈리는 것은 문구뿐이다.
  noticeApiKeyIssue(kind: ApiKeyNoticeKind, apiKey?: string) {
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
    const notice =
      kind === 'rateLimited'
        ? { kind, apiKey: apiKey ?? null, attempt: rateLimitAttemptOf(apiKey ?? null) }
        : { kind, apiKey: apiKey ?? null }
    set((state) => authReducer(state, { type: 'API_KEY_NOTICED', notice }))
  },

  retryRateLimitNotice() {
    set((state) => authReducer(state, { type: 'NOTICE_ACKNOWLEDGED' }))
  },

  async rateLimitedKeyRole(apiKey) {
    if (apiKey === null) return null
    const config = await getAuthConfig().catch(() => null)
    const key = config?.apiKeys.find((one) => one.value === apiKey)
    if (key === undefined) return null
    // 넥슨 로그인에 귀속된 키가 부계정 키다. 로그인 없이 쓰는 메인 키만 키 입력 폼으로 바꾼다.
    return key.loginId === null && config?.mainKeyId === key.id ? 'main' : 'sub'
  },

  async replaceMainApiKey(apiKey) {
    let accounts: AuthState['accounts']
    try {
      accounts = await fetchUnsavedCharacterList(apiKeyCredential(apiKey))
    } catch (error) {
      useToastStore.getState().showError(formatAuthError(toAuthError(error)))
      return 'failed'
    }
    // 저장보다 먼저다. 이유는 signIn 과 같다. 로그인 상태는 그대로 두고 개발 단계 키 모달만 띄운다.
    if ((await probeApiKeyStage(apiKeyCredential(apiKey))) === 'developmentStage') {
      set({ developmentStageBlocked: true })
      return 'developmentStage'
    }
    try {
      const reusedId = (await reusableNexonAccountId(accounts)) ?? undefined
      await setMainApiKey(apiKey, '', reusedId)
      const saved = (await getAuthConfig())?.apiKeys.find((one) => one.value === apiKey)
      recordCharacterList(accounts, saved?.id ?? null)
    } catch {
      useToastStore.getState().showError(formatAuthError({ kind: 'storageWriteFailed' }))
      return 'failed'
    }
    useToastStore.getState().showSuccess('API 키를 확인했어요')
    set((state) => ({ ...authReducer(state, { type: 'NOTICE_ACKNOWLEDGED' }), accounts }))
    return 'replaced'
  },

  // 모달의 확인. 여기서야 삭제와 이동이 일어난다. **차례가 그 순서인 것이 요점이다.** 남은
  // 수단은 지운 뒤에야 셀 수 있고, 그 수가 로그인 화면으로 보낼지 앱을 세워 둘지를 가른다.
  async invalidKeyDestination(apiKey) {
    return destinationOf(await planInvalidSubKey(apiKey).catch(() => null))
  },

  async confirmApiKeyNotice() {
    const notice = get().apiKeyNotice
    if (notice === null) {
      return
    }

    // 지금 로그인의 부계정 키는 지우지 않는다. 지우면 계정 관리에서 그 계정이 사라져 어느 계정의 키가 문제인지 알 수 없다.
    if (notice.kind === 'invalid') {
      let plan: Awaited<ReturnType<typeof planInvalidSubKey>> = null
      try {
        plan = await planInvalidSubKey(notice.apiKey)
        if (plan !== null) await retireInvalidSubKey(plan)
      } catch {
        // 무엇을 적었는지 모르면 아래 지우기 실패와 같이 로그인 화면으로 보낸다.
        set((state) => authReducer(state, { type: 'SIGNED_OUT' }))
        useAppEntryStore.getState().reset()
        return
      }
      if (plan !== null) {
        set((state) => authReducer(state, { type: 'NOTICE_ACKNOWLEDGED' }))
        // 남은 추적 캐릭터가 없으면 추적 목록을 비운 진입 판정이 캐릭터 설정으로 보낸다.
        if (plan.remaining.length > 0) useAccountManageOpenStore.getState().open({ accountKey: null, openKeySheet: false })
        return
      }
    }

    let 지웠다 = true
    try {
      // 로그인 만료는 로그인 하나만 뗀다. API 키를 함께 지우면 멀쩡한 키를, 여럿이면 다른 넥슨
      // 계정의 키까지 잃는다.
      if (notice.kind === 'signInRequired') await clearNexonLogin()
      // 어느 키가 죽었는지 실패가 실어 보냈으면 **그 키만** 지운다. 안 실렸으면 가릴 방법이
      // 없어 전부 지운다. 키가 여럿인 사용자에게 그것은 다른 넥슨 계정의 키까지 잃는 일이다.
      else if (notice.apiKey === null) await removeAllApiKeys()
      else await removeApiKey(notice.apiKey)
    } catch {
      // 삭제가 실패하면 재시작 시 옛 무효 키가 되살아나지만 그때는 다시 이 경로를 탈 뿐이라
      // 막다른 길이 아니다. rethrow 하면 호출부가 전부 void 호출이라 미처리 rejection 이 된다.
      지웠다 = false
    }

    // 무엇이 남았는지 모르면 로그인 화면으로 보낸다. 앱을 세워 두면 죽은 수단이 그대로 남아
    // 같은 실패를 무한히 다시 만난다. 부계정 키만 남은 것도 남은 수단이 아니다. 다시 로그인할 때까지 부르지 않는다.
    const 남은수단 = 지웠다 ? credentialOf(await getAuthConfig().catch(() => null)) : null
    if (남은수단 !== null) {
      // 남은 수단으로 앱은 계속 선다. 알림만 닫는다. 여기서 로그아웃을 내면 그 수단으로
      // 조회되던 메이플 ID 까지 함께 잃는다.
      set((state) => authReducer(state, { type: 'NOTICE_ACKNOWLEDGED' }))
      return
    }

    // 이동은 상태를 뒤집는 것으로 일어난다. 스토어는 라우터를 모른다. 화면 목록을 가르는 진입
    // 게이트도 함께 되돌린다.
    set((state) => authReducer(state, { type: 'SIGNED_OUT' }))
    useAppEntryStore.getState().reset()
  },

  // 로그인 화면과 today 의 연동 시트가 함께 쓴다. 두 자리가 같은 끝을 내야 한다.
  async signInWithNexonAccount(options) {
    if (nexonSignInRunning) return false
    nexonSignInRunning = true
    try {
      const result = await signInWithNexon({ fresh: options?.fresh === true })
      // 사용자가 창을 닫거나 동의 화면에서 취소한 것이라 아무 일도 안 일어난 것이다. 안내를 띄우면
      // 자기가 그만둬 놓고 무엇이 잘못됐나 찾게 된다.
      if (result.kind === 'cancelled') return false
      if (result.kind === 'failed') {
        useToastStore.getState().showError('넥슨 로그인에 실패했습니다')
        return false
      }

      // 세션은 이미 적혔다. 여기서부터는 **앱을 여는 일**이다.
      const credential = await currentCredential()
      if (credential === null) return false

      let accounts: AuthState['accounts']
      try {
        accounts = await fetchAndRecordCharacterList(credential)
      } catch {
        // 로그인은 끝났다. 목록은 다음 회차가 다시 받는다. 여기서 앱을 열면 캐릭터 없는 화면이
        // 선다. 토스트는 안 띄운다 - 로그인 자체는 성공이라 실패라고 말하면 거짓이다.
        return false
      }

      useToastStore.getState().showSuccess('넥슨 계정을 연결했어요')
      set((state) => authReducer(state, { type: 'API_KEY_VERIFIED', accounts }))
      await useAppEntryStore.getState().resolveAfterSignIn(accounts)
      return true
    } finally {
      nexonSignInRunning = false
    }
  },

  async signOut() {
    // 로그인이 있었으면 서버의 토큰도 거둔다. **기기에서 지우기 전에** 물어야 세션 값을 아직 들고 있다. 실패해도
    // 진행한다. 기기에서 지우는 일이 본론이고, 서버 쪽은 갱신 토큰 수명이 지나면 정리된다.
    const session = (await getAuthConfig().catch(() => null))?.login?.session
    if (session !== undefined) await revokeNexonSession(session)

    await clearUnsentServerData()
    // 넥슨 로그인과 메인 키를 지운다. 부계정 키는 그 로그인에 귀속된 채 남아, 같은 넥슨 ID 로 다시 로그인하면 이어진다.
    await signOutAuth()
    set((state) => authReducer(state, { type: 'SIGNED_OUT' }))
    useAppEntryStore.getState().reset()
  },

  async deleteAccount() {
    // **키를 지우기 전**이어야 한다. 서버가 지울 사람을 찾을 값이 그 키에서 나온다.
    if (!(await requestAccountDeletion())) return false
    await get().signOut()
    return true
  },
}))
