/**
 * 업데이트 전 기록을 묶음으로 올리는 과정. 여기서 막는 사고는 셋이다. 실패한 묶음 뒤로 자리가 넘어가 그 기록이 영영 안
 * 올라가는 것, 한 종류가 끝나지 않았는데 끝으로 적히는 것, 서버가 받지 못한 건이 그대로 버려지는 것이다.
 */
import { BACKFILL_BATCH, runBackfill, type BackfillDeps, type BackfillKindSpec } from '../backfill'
import type { BackfillState } from '../../../storage/server-backfill'

const HEADERS = { 'x-api-key-hash': 'h' }
const NOW = new Date('2026-10-26T00:00:00.000Z')

const ids = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}-${String(i).padStart(3, '0')}`)

function setup(records: Record<string, string[]>, initial: BackfillState = {}) {
  let state: BackfillState = structuredClone(initial)
  const requeued: Record<string, string[]> = {}
  const kinds: BackfillKindSpec[] = (['bossClear', 'dropPrice', 'cashbookEntry'] as const).map((kind) => ({
    kind,
    path: `/${kind}`,
    read: async (id: string) => (id.endsWith('skip') ? null : { id }),
    requeue: async (failed: readonly string[]) => {
      requeued[kind] = [...(requeued[kind] ?? []), ...failed]
    },
  }))
  const post = jest.fn<ReturnType<BackfillDeps['post']>, Parameters<BackfillDeps['post']>>(async (_h, _p, items) => ({
    outcome: 'sent',
    results: (items as { id: string }[]).map((item) => ({ recordId: item.id, ok: true as const })),
  }))
  const deps: BackfillDeps = {
    kinds,
    list: async (kind, after, limit) => (records[kind] ?? []).filter((id) => id > after).slice(0, limit),
    post,
    getState: async () => structuredClone(state),
    setState: async (next) => {
      state = structuredClone(next)
    },
  }
  return { deps, post, requeued, state: () => state }
}

it('종류마다 id 차례로 100 건씩 보내고, 100 건보다 적게 읽히면 그 종류를 끝으로 적는다', async () => {
  const { deps, post, state } = setup({ bossClear: ids('b', 150), cashbookEntry: ids('c', 3) })

  await runBackfill(HEADERS, NOW, deps)

  expect(post.mock.calls.map(([, path, items]) => [path, items.length])).toEqual([
    ['/bossClear', BACKFILL_BATCH],
    ['/bossClear', 50],
    ['/cashbookEntry', 3],
  ])
  expect(state()).toEqual({
    bossClear: { after: 'b-149', done: true },
    dropPrice: { after: '', done: true },
    cashbookEntry: { after: 'c-002', done: true },
  })
})

it('묶음이 실패하면 그 회차를 멈추고 자리를 넘기지 않아, 다음 회차가 같은 자리부터 다시 보낸다', async () => {
  const { deps, post, state } = setup({ bossClear: ids('b', 150) })
  post.mockResolvedValueOnce({ outcome: 'sent', results: [] }).mockResolvedValueOnce({ outcome: 'no-response' })

  await runBackfill(HEADERS, NOW, deps)
  expect(state()).toEqual({ bossClear: { after: 'b-099', done: false } })

  await runBackfill(HEADERS, NOW, deps)
  expect(post.mock.calls[2]?.[2]).toHaveLength(50)
  expect(state().bossClear).toEqual({ after: 'b-149', done: true })
})

it('서버가 받지 못한 건만 평소 대기 표로 보낸다', async () => {
  const { deps, post, requeued } = setup({ dropPrice: ['d-1', 'd-2', 'd-3'] })
  post.mockResolvedValueOnce({
    outcome: 'sent',
    results: [
      { recordId: 'd-1', ok: true },
      { recordId: 'd-2', ok: false, reason: '모르는 아이템 key 다' },
      { recordId: null, ok: false, reason: '본문이 틀렸다' },
    ],
  })

  await runBackfill(HEADERS, NOW, deps)

  expect(requeued).toEqual({ dropPrice: ['d-2'] })
})

// 끝난 종류는 다시 훑지 않는다. 평소 저장은 한 건 전송이 따로 덮는다.
it('끝난 종류는 건너뛰고, 보낼 값이 없는 기록은 빼고 보내되 자리는 넘긴다', async () => {
  const { deps, post, state } = setup(
    { bossClear: ids('b', 5), dropPrice: ['d-1', 'd-2skip'] },
    { bossClear: { after: 'b-004', done: true } },
  )

  await runBackfill(HEADERS, NOW, deps)

  expect(post.mock.calls.map(([, path, items]) => [path, items])).toEqual([['/dropPrice', [{ id: 'd-1' }]]])
  expect(state().dropPrice).toEqual({ after: 'd-2skip', done: true })
})

// 강화 합계는 옛 원본을 옮기는 부팅 단계가 만든다. 옮기기 전에 훑으면 빈 표를 끝으로 적고, 옮긴 줄을 영영 안 올린다.
it('준비되지 않은 종류는 읽지도 적지도 않고, 준비된 뒤의 회차가 처음부터 올린다', async () => {
  const { deps, post, state } = setup({ cashbookEntry: ids('c', 2) })
  let ready = false
  deps.kinds = deps.kinds.map((spec) => (spec.kind === 'cashbookEntry' ? { ...spec, ready: async () => ready } : spec))

  await runBackfill(HEADERS, NOW, deps)
  expect(state().cashbookEntry).toBeUndefined()
  expect(post).not.toHaveBeenCalled()

  ready = true
  await runBackfill(HEADERS, NOW, deps)
  expect(state().cashbookEntry).toEqual({ after: 'c-001', done: true })
})
