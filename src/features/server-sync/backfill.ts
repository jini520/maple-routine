/**
 * 업데이트 전에 기기에 쌓인 기록을 서버로 올린다. 종류마다 id 차례로 100 건씩 묶어 보낸다.
 *
 * 사용자마다 천여 건이라 한 건씩 보내면 업데이트 직후 서버 요청이 몰린다. 어디까지 보냈는지는 종류마다 마지막 id 하나로
 * Preferences 에 적어, 앱이 중간에 꺼져도 다음 회차가 그 뒤부터 잇는다.
 */
import { postBatch, type BatchSendResult } from '../../server/write'
import { RECORD_PATHS } from '../../server/records'
import { isEnhancementTotalsMoved } from '../../storage/enhancement-totals-moved'
import { getBackfillState, setBackfillState, type BackfillState } from '../../storage/server-backfill'
import { listRecordIdsAfter, type BackfillKind } from '../../storage/server-sync-sources'
import { bossClearHandler, enqueueBossClears } from './boss-clear-sync'
import { cashbookEntryHandler, enqueueCashbookEntries } from './cashbook-entry-sync'
import { dropPriceHandler, enqueueDropPrices } from './drop-price-sync'
import { enhancementTotalHandler, enqueueEnhancementTotals } from './enhancement-total-sync'
import { ensureEnhancementTotals } from '../enhancement-history/legacy-totals'

/** 묶음 한 번의 건수. 서버의 상한과 같다. */
export const BACKFILL_BATCH = 100

/** 한 종류를 올리는 데 필요한 것. 값을 만드는 읽기는 한 건 전송과 같은 함수다. */
export interface BackfillKindSpec {
  kind: BackfillKind
  path: string
  read: (recordId: string) => Promise<unknown>
  /** 서버가 받지 못한 건을 평소 대기 표에 넣는다. */
  requeue: (recordIds: readonly string[], now: Date) => Promise<void>
  /** 거짓이면 이번 회차에 이 종류를 건너뛴다. 진행도 적지 않는다. 표가 다 차기 전에 훑으면 빈 표를 끝으로 적는다 */
  ready?: () => Promise<boolean>
}

/**
 * 처치 · 드롭 · 가계부 · 강화 합계 차례. 드롭이 처치 기간 id 를 가리키므로 처치가 먼저다.
 *
 * 처리 함수는 부를 때 꺼낸다. 모듈을 읽을 때 꺼내면 종류 파일을 일부만 목으로 바꾼 테스트에서 빈 값을 집는다.
 */
export const BACKFILL_KINDS: readonly BackfillKindSpec[] = [
  {
    kind: 'bossClear',
    path: RECORD_PATHS.bossClear,
    read: (id) => bossClearHandler.read(id),
    requeue: (ids, now) => enqueueBossClears(ids, now),
  },
  {
    kind: 'dropPrice',
    path: RECORD_PATHS.dropPrice,
    read: (id) => dropPriceHandler.read(id),
    requeue: (ids, now) => enqueueDropPrices(ids, now),
  },
  {
    kind: 'cashbookEntry',
    path: RECORD_PATHS.cashbookEntry,
    read: (id) => cashbookEntryHandler.read(id),
    requeue: (ids, now) => enqueueCashbookEntries(ids, now),
  },
  {
    kind: 'enhancementTotal',
    path: RECORD_PATHS.enhancementTotal,
    read: (id) => enhancementTotalHandler.read(id),
    requeue: (ids, now) => enqueueEnhancementTotals(ids, now),
    // 옛 원본을 옮기는 부팅 단계가 이 표를 채운다. 앱을 켜자마자 도는 회차는 그보다 먼저 온다.
    ready: async () => {
      await ensureEnhancementTotals()
      return isEnhancementTotalsMoved()
    },
  },
]

/** 이 과정이 밖에 맡기는 일. 테스트가 갈아 끼운다. */
export interface BackfillDeps {
  kinds: readonly BackfillKindSpec[]
  list: (kind: BackfillKind, after: string, limit: number) => Promise<string[]>
  post: (headers: Record<string, string>, path: string, items: readonly unknown[]) => Promise<BatchSendResult>
  getState: () => Promise<BackfillState>
  setState: (state: BackfillState) => Promise<void>
}

const DEFAULT_DEPS: BackfillDeps = {
  kinds: BACKFILL_KINDS,
  list: listRecordIdsAfter,
  post: postBatch,
  getState: getBackfillState,
  setState: setBackfillState,
}

/**
 * 끝나지 않은 종류를 이어서 올린다. 묶음이 실패하면(응답 없음 · 거절) 그 회차를 멈추고 다음 회차가 같은 자리부터 다시
 * 보낸다. 묶음 안에서 서버가 받지 못한 건만 평소 대기 표로 보낸다.
 *
 * @param now 대기 표에 적는 시각. 테스트가 고정한다
 */
export async function runBackfill(
  headers: Record<string, string>,
  now: Date,
  deps: BackfillDeps = DEFAULT_DEPS,
): Promise<void> {
  const state = await deps.getState()
  for (const spec of deps.kinds) {
    if (spec.ready !== undefined && !(await spec.ready())) continue
    let progress = state[spec.kind] ?? { after: '', done: false }
    while (!progress.done) {
      const ids = await deps.list(spec.kind, progress.after, BACKFILL_BATCH)
      const values: unknown[] = []
      for (const id of ids) {
        const value = await spec.read(id)
        if (value !== null) values.push(value)
      }
      if (values.length > 0) {
        const result = await deps.post(headers, spec.path, values)
        if (result.outcome !== 'sent') return
        const failed = result.results.flatMap((one) => (one.ok || one.recordId === null ? [] : [one.recordId]))
        if (failed.length > 0) await spec.requeue(failed, now)
      }
      progress = { after: ids.at(-1) ?? progress.after, done: ids.length < BACKFILL_BATCH }
      state[spec.kind] = progress
      await deps.setState(state)
    }
  }
}
