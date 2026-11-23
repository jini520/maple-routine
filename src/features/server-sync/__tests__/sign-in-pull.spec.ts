/**
 * 로그인 화면의 로그인 뒤 받기 한 쪽. 화면을 넘기기 전에 그 사람의 추적 목록과 대표를 받는다.
 *
 * 여기서 막는 사고는 둘이다. 한 쪽만 받고 처음 동기화의 받기를 끝낸 것으로 적어 받지 않은 줄의 기기 줄이 서버 id 로 바뀌지 않은 채
 * 올라가는 것과, 받기보다 올리기가 먼저 나가는 것이다.
 */
import type { FirstServerSync } from '../../../storage/server-sync-first'
import type { PullSummary } from '../pull'
import { pullAfterSignIn, type SignInPullDeps } from '../sign-in-pull'

function setup(first: FirstServerSync | null, pullFails = false) {
  const order: string[] = []
  const deps: SignInPullDeps = {
    hold: jest.fn(async () => {
      order.push('hold')
      return () => order.push('release')
    }),
    prepareAccounts: jest.fn(async () => {
      order.push('accounts')
    }),
    getFirstSync: jest.fn(async () => first),
    pull: jest.fn(async (options): Promise<PullSummary> => {
      order.push(`pull ${options.firstQueuedAt ?? '-'} ${options.maxPages}`)
      if (pullFails) throw new Error('저장소가 안 열렸다')
      return { pages: 1, applied: 1, skipped: 0, stopped: false, finished: true }
    }),
  }
  return { deps, order }
}

it('동기화를 멈춘 채 계정을 알린 뒤 한 쪽만 받는다. 올리지 않는다', async () => {
  const { deps, order } = setup({ queuedAt: 'Q', pulled: true })

  await pullAfterSignIn(deps)

  expect(order).toEqual(['hold', 'accounts', 'pull - 1', 'release'])
})

// 받기를 끝냈다는 표시(`pulled`)는 적지 않는다. 끝까지 받지 않아, 켜면 다음 동기화가 받기를 끝내지 않은 채 올린다. 적는 일을 맡지
// 않아 이 받기는 그 표시를 켤 수 없다.
it('처음 동기화가 받기를 끝내지 않았으면 넣기를 마친 시각을 넘긴다', async () => {
  const { deps, order } = setup({ queuedAt: 'Q', pulled: false })

  await pullAfterSignIn(deps)

  expect(order).toEqual(['hold', 'accounts', 'pull Q 1', 'release'])
})

// 넣기 전에 받으면 받은 줄까지 처음 올리기로 넣어 서버로 되돌린다.
it('처음 동기화가 기록을 넣지 않았으면 받지 않는다', async () => {
  const { deps, order } = setup(null)

  await pullAfterSignIn(deps)

  expect(order).toEqual(['hold', 'accounts', 'release'])
})

it('받기가 던져도 던지지 않고 멈춤을 푼다. 화면은 캐릭터 설정으로 간다', async () => {
  const { deps, order } = setup({ queuedAt: 'Q', pulled: true }, true)

  await expect(pullAfterSignIn(deps)).resolves.toBeUndefined()

  expect(order.at(-1)).toBe('release')
})
