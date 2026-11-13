/**
 * 업데이트 전에 기기에 쌓인 드롭을 서버로 올린다. 종류마다 id 차례로 100 건씩 묶어 보낸다.
 *
 * 사용자마다 천여 건이라 한 건씩 보내면 업데이트 직후 서버 요청이 몰린다. 어디까지 보냈는지는 종류마다 마지막 id 하나로
 * Preferences 에 적어, 앱이 중간에 꺼져도 다음 회차가 그 뒤부터 잇는다.
 *
 * 한 묶음은 신원마다 나눠 보낸다. 서버는 기록의 메이플 ID 가 보낸 신원의 넥슨 계정에 있어야 받는다.
 */
import { postBatch, type BatchSendResult } from '../../server/write'
import { getAuthConfig } from '../../storage/api-key'
import { getBackfillState, setBackfillState, type BackfillState } from '../../storage/server-backfill'
import { listRecordIdsAfter, type BackfillKind } from '../../storage/server-sync-sources'
import { serverIdentityOfAccount, type ServerIdentity } from '../auth/server-identity'
import { dropPriceHandler, enqueueDropPrices } from './drop-price-sync'

/** 묶음 한 번의 건수. 서버의 상한과 같다. */
export const BACKFILL_BATCH = 100

/** 올릴 기록 한 건. 값과, 그 값을 보낼 신원의 넥슨 계정이다. */
export interface BackfillItem {
  value: unknown
  /** 기록의 캐릭터가 속한 넥슨 계정 id. 모르면 `null` 이고 메인 계정의 신원으로 보낸다 */
  accountId: string | null
}

/** 한 종류를 올리는 데 필요한 것. 값을 만드는 읽기는 한 건 전송과 같은 함수다. */
export interface BackfillKindSpec {
  kind: BackfillKind
  path: string
  /** 보낼 값이 없는 기록은 `null` 이고 묶음에서 빠진다 */
  read: (recordId: string) => Promise<BackfillItem | null>
  /** 서버가 받지 못한 건을 평소 대기 표에 넣는다. */
  requeue: (recordIds: readonly string[], now: Date) => Promise<void>
}

/**
 * 올리는 종류. 서버로 보내는 기록은 드롭 가격 하나다.
 *
 * 처리 함수는 부를 때 꺼낸다. 모듈을 읽을 때 꺼내면 종류 파일을 일부만 목으로 바꾼 테스트에서 빈 값을 집는다.
 */
export const BACKFILL_KINDS: readonly BackfillKindSpec[] = [
  {
    kind: 'dropPriceOwner',
    path: '/drop-prices',
    read: async (id) => {
      const send = await dropPriceHandler.read(id)
      return send === null ? null : { value: send.payload, accountId: send.accountId }
    },
    requeue: (ids, now) => enqueueDropPrices(ids, now),
  },
]

/** 이 과정이 밖에 맡기는 일. 테스트가 갈아 끼운다. */
export interface BackfillDeps {
  kinds: readonly BackfillKindSpec[]
  list: (kind: BackfillKind, after: string, limit: number) => Promise<string[]>
  post: (headers: Record<string, string>, path: string, items: readonly unknown[]) => Promise<BatchSendResult>
  getState: () => Promise<BackfillState>
  setState: (state: BackfillState) => Promise<void>
  /** 넥슨 계정마다 신원을 고르는 함수. 회차마다 한 번 만들어 저장소를 기록마다 읽지 않는다 */
  identities: () => Promise<(accountId: string | null) => ServerIdentity | null>
}

const DEFAULT_DEPS: BackfillDeps = {
  kinds: BACKFILL_KINDS,
  list: listRecordIdsAfter,
  post: postBatch,
  getState: getBackfillState,
  setState: setBackfillState,
  identities: async () => {
    const config = await getAuthConfig()
    return (accountId) => serverIdentityOfAccount(config, accountId)
  },
}

/**
 * 끝나지 않은 종류를 이어서 올린다. 묶음이 실패하면(응답 없음 · 거절) 그 회차를 멈추고 다음 회차가 같은 자리부터 다시
 * 보낸다. 앞서 보낸 신원의 묶음도 다시 나가지만 서버가 기록 id 로 덮어 줄이 늘지 않는다. 묶음 안에서 서버가 받지 못한 건과
 * 지금 밝힐 수 없는 계정(다른 로그인의 부계정)의 기록은 평소 대기 표로 보낸다.
 *
 * @param now 대기 표에 적는 시각. 테스트가 고정한다
 */
export async function runBackfill(now: Date, deps: BackfillDeps = DEFAULT_DEPS): Promise<void> {
  const state = await deps.getState()
  const identityOf = await deps.identities()
  for (const spec of deps.kinds) {
    let progress = state[spec.kind] ?? { after: '', done: false }
    while (!progress.done) {
      const ids = await deps.list(spec.kind, progress.after, BACKFILL_BATCH)
      const groups = new Map<string, { headers: ServerIdentity; values: unknown[] }>()
      const unsendable: string[] = []
      for (const id of ids) {
        const item = await spec.read(id)
        if (item === null) continue
        const headers = identityOf(item.accountId)
        if (headers === null) {
          unsendable.push(id)
          continue
        }
        const key = JSON.stringify(headers)
        const group = groups.get(key) ?? { headers, values: [] }
        group.values.push(item.value)
        groups.set(key, group)
      }
      for (const group of groups.values()) {
        const result = await deps.post(group.headers, spec.path, group.values)
        if (result.outcome !== 'sent') return
        const failed = result.results.flatMap((one) => (one.ok || one.recordId === null ? [] : [one.recordId]))
        if (failed.length > 0) await spec.requeue(failed, now)
      }
      if (unsendable.length > 0) await spec.requeue(unsendable, now)
      progress = { after: ids.at(-1) ?? progress.after, done: ids.length < BACKFILL_BATCH }
      state[spec.kind] = progress
      await deps.setState(state)
    }
  }
}
