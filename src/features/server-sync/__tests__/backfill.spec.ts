/**
 * 업데이트 전 드롭을 묶음으로 올리는 과정. 여기서 막는 사고는 셋이다. 실패한 묶음 뒤로 자리가 넘어가 그 기록이 영영 안
 * 올라가는 것, 끝나지 않았는데 끝으로 적히는 것, 서버가 받지 못한 건이 그대로 버려지는 것이다.
 */
import { BACKFILL_BATCH, runBackfill, type BackfillDeps, type BackfillKindSpec } from '../backfill'
import type { BackfillState } from '../../../storage/server-backfill'

const HEADERS = { Authorization: 'Bearer S' }
const SUB_HEADERS = { 'x-api-key-hash': 'h' }
const NOW = new Date('2026-10-26T00:00:00.000Z')

const ids = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}-${String(i).padStart(3, '0')}`)

function setup(records: string[], initial: BackfillState = {}) {
  let state: BackfillState = structuredClone(initial)
  const requeued: string[] = []
  const kinds: BackfillKindSpec[] = [
    {
      kind: 'dropPriceOwner',
      path: '/drop-prices',
      // 이름에 `sub` 가 들면 부계정 캐릭터, `gone` 이면 지금 밝힐 수 없는 계정의 드롭이다.
      read: async (id: string) =>
        id.endsWith('skip') ? null : { value: { id }, accountId: id.includes('sub') ? 'acc-sub' : id.includes('gone') ? 'acc-gone' : null },
      requeue: async (failed: readonly string[]) => {
        requeued.push(...failed)
      },
    },
  ]
  const post = jest.fn<ReturnType<BackfillDeps['post']>, Parameters<BackfillDeps['post']>>(async (_h, _p, items) => ({
    outcome: 'sent',
    results: (items as { id: string }[]).map((item) => ({ recordId: item.id, ok: true as const })),
  }))
  const deps: BackfillDeps = {
    kinds,
    list: async (_kind, after, limit) => records.filter((id) => id > after).slice(0, limit),
    post,
    getState: async () => structuredClone(state),
    setState: async (next) => {
      state = structuredClone(next)
    },
    identities: async () => (accountId) => (accountId === 'acc-sub' ? SUB_HEADERS : accountId === 'acc-gone' ? null : HEADERS),
  }
  return { deps, post, requeued, state: () => state }
}

it('id 차례로 100 건씩 보내고, 100 건보다 적게 읽히면 끝으로 적는다', async () => {
  const { deps, post, state } = setup(ids('d', 150))

  await runBackfill(NOW, deps)

  expect(post.mock.calls.map(([, path, items]) => [path, items.length])).toEqual([
    ['/drop-prices', BACKFILL_BATCH],
    ['/drop-prices', 50],
  ])
  expect(state()).toEqual({ dropPriceOwner: { after: 'd-149', done: true } })
})

it('묶음이 실패하면 그 회차를 멈추고 자리를 넘기지 않아, 다음 회차가 같은 자리부터 다시 보낸다', async () => {
  const { deps, post, state } = setup(ids('d', 150))
  post.mockResolvedValueOnce({ outcome: 'sent', results: [] }).mockResolvedValueOnce({ outcome: 'no-response' })

  await runBackfill(NOW, deps)
  expect(state()).toEqual({ dropPriceOwner: { after: 'd-099', done: false } })

  await runBackfill(NOW, deps)
  expect(post.mock.calls[2]?.[2]).toHaveLength(50)
  expect(state().dropPriceOwner).toEqual({ after: 'd-149', done: true })
})

it('서버가 받지 못한 건만 평소 대기 표로 보낸다', async () => {
  const { deps, post, requeued } = setup(['d-1', 'd-2', 'd-3'])
  post.mockResolvedValueOnce({
    outcome: 'sent',
    results: [
      { recordId: 'd-1', ok: true },
      { recordId: 'd-2', ok: false, reason: '모르는 아이템 key 다' },
      { recordId: null, ok: false, reason: '본문이 틀렸다' },
    ],
  })

  await runBackfill(NOW, deps)

  expect(requeued).toEqual(['d-2'])
})

// 끝난 뒤에는 다시 훑지 않는다. 평소 저장은 한 건 전송이 따로 덮는다.
it('끝난 뒤에는 다시 훑지 않는다', async () => {
  const { deps, post } = setup(ids('d', 5), { dropPriceOwner: { after: 'd-004', done: true } })

  await runBackfill(NOW, deps)

  expect(post).not.toHaveBeenCalled()
})

it('보낼 값이 없는 기록은 빼고 보내되 자리는 넘긴다', async () => {
  const { deps, post, state } = setup(['d-1', 'd-2skip'])

  await runBackfill(NOW, deps)

  expect(post.mock.calls.map(([, path, items]) => [path, items])).toEqual([['/drop-prices', [{ id: 'd-1' }]]])
  expect(state().dropPriceOwner).toEqual({ after: 'd-2skip', done: true })
})

// 서버는 기록의 메이플 ID 가 보낸 신원의 계정에 있어야 받는다. 한 묶음을 세션 하나로 보내면 부계정 드롭이 모두 거절된다.
it('한 묶음을 신원마다 나눠 보낸다', async () => {
  const { deps, post } = setup(['d-1', 'd-2sub', 'd-3'])

  await runBackfill(NOW, deps)

  expect(post.mock.calls.map(([headers, , items]) => [headers, items])).toEqual([
    [HEADERS, [{ id: 'd-1' }, { id: 'd-3' }]],
    [SUB_HEADERS, [{ id: 'd-2sub' }]],
  ])
})

it('지금 밝힐 수 없는 계정의 드롭은 보내지 않고 평소 대기 표로 보낸다', async () => {
  const { deps, post, requeued } = setup(['d-1', 'd-2gone'])

  await runBackfill(NOW, deps)

  expect(post.mock.calls.map(([, , items]) => items)).toEqual([[{ id: 'd-1' }]])
  expect(requeued).toEqual(['d-2gone'])
})
