/**
 * 로그인 화면의 로그인 뒤 받기 한 쪽. 로그인은 추적 목록을 비우므로, 화면을 넘기기 전에 그 사람의 추적 목록과 대표를 서버에서 받는다.
 * 서버는 사람의 줄을 메이플 ID 보다 먼저 한 쪽 500줄 안에 실어 거의 첫 쪽에 온다. 나머지 쪽은 평소의 동기화가 받는다.
 *
 * @see docs/foundation/server-sync.md `다른 사람으로 로그인`
 */
import { getFirstServerSync, type FirstServerSync } from '../../storage/server-sync-first'
import { prepareServerAccounts } from './accounts'
import { holdServerSync } from './kick'
import { pullServerSync, type PullOptions, type PullSummary } from './pull'

/** 로그인 뒤 받기가 밖에 맡기는 일 전부. 테스트가 갈아 끼운다. 처음 동기화의 `pulled` 를 적는 일은 맡지 않는다. */
export interface SignInPullDeps {
  hold(): Promise<() => void>
  prepareAccounts(): Promise<void>
  getFirstSync(): Promise<FirstServerSync | null>
  pull(options: PullOptions): Promise<PullSummary>
}

const DEFAULT_DEPS: SignInPullDeps = {
  hold: holdServerSync,
  prepareAccounts: prepareServerAccounts,
  getFirstSync: getFirstServerSync,
  pull: (options) => pullServerSync(options),
}

/**
 * 계정을 알린 뒤 받기를 한 쪽만 한다. 올리지 않는다. 다른 동기화와 겹치지 않게 동기화를 멈춘 채 한다. **던지지 않는다.** 받지 못하면
 * 추적 목록이 비어 화면이 캐릭터 설정으로 간다.
 *
 * 처음 동기화가 받기를 끝내지 않았으면 넣기를 마친 시각을 넘기지만 `pulled` 는 켜지 않는다. 끝까지 받지 않아, 켜면 다음 동기화가 받지
 * 않은 쪽의 기기 줄을 서버 id 로 바꾸지 않은 채 올린다. 처음 동기화가 아직 넣지 않았으면 받지 않는다. 받은 줄까지 처음 올리기로 넣어
 * 서버로 되돌린다.
 */
export async function pullAfterSignIn(deps: SignInPullDeps = DEFAULT_DEPS): Promise<void> {
  const release = await deps.hold()
  try {
    // 서버는 기록의 메이플 ID 가 신원의 것인지를 알린 목록으로 가린다.
    await deps.prepareAccounts().catch(() => undefined)
    const first = await deps.getFirstSync().catch(() => null)
    if (first === null) return
    await deps.pull({ firstQueuedAt: first.pulled ? undefined : first.queuedAt, maxPages: 1 }).catch(() => undefined)
  } finally {
    release()
  }
}
