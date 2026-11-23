/**
 * 한 번의 동기화. 서버가 이 기기의 넥슨 계정을 알게 한 뒤 대기 표를 올리고 다른 기기가 올린 기록을 받는다.
 *
 * 1.0.15 로 올린 기기의 처음 동기화는 기기의 기록을 모두 대기 표에 넣고 받기를 먼저 끝낸다. 다른 기기가 먼저 올린 줄을 받아 유일
 * 기준이 같은 기기 줄을 서버 id 로 바꾼 뒤에 올려야, 그 줄이 `duplicate_record` 로 지워지며 드롭까지 사라지지 않는다.
 *
 * **첫 화면을 막지 않는다.** 부르는 쪽이 `void` 로 띄우고 결과를 안 기다린다.
 *
 * @see docs/foundation/server-sync.md `처음 동기화`
 */
import {
  enqueueAllServerSyncRecords,
  getFirstServerSync,
  markFirstServerSyncPulled,
  type FirstServerSync,
} from '../../storage/server-sync-first'
import { serverIdentityHeaders } from '../auth/server-identity'
import { checkServerMaintenance, useServerMaintenanceStore } from '../server-maintenance/store'
import { prepareServerAccounts } from './accounts'
import { pullServerSync, type PullSummary } from './pull'
import { pushServerSync, type PushOptions } from './push'

/** 한 번의 동기화가 밖에 맡기는 일 전부. 테스트가 갈아 끼운다. */
export interface RunDeps {
  prepareAccounts(): Promise<void>
  push(options: PushOptions): Promise<unknown>
  pull(): Promise<PullSummary>
  identity(): Promise<Record<string, string> | null>
  /** 지금 점검 중인가. 부팅의 점검 확인은 답을 기다리지 않아 다시 묻는다 */
  underMaintenance(): Promise<boolean>
  getFirstSync(): Promise<FirstServerSync | null>
  enqueueAll(): Promise<FirstServerSync>
  markPulled(first: FirstServerSync): Promise<void>
}

const DEFAULT_DEPS: RunDeps = {
  prepareAccounts: prepareServerAccounts,
  push: (options) => pushServerSync(options),
  pull: () => pullServerSync(),
  identity: serverIdentityHeaders,
  underMaintenance: async () => {
    await checkServerMaintenance()
    return useServerMaintenanceStore.getState().locked
  },
  getFirstSync: getFirstServerSync,
  enqueueAll: enqueueAllServerSyncRecords,
  markPulled: markFirstServerSyncPulled,
}

/**
 * 처음 동기화의 표시. 없으면 기기의 기록을 모두 대기 표에 넣고 적는다. 신원이 없거나 점검 중이면 시작하지 않고 `null` 이다. 신원이
 * 없으면 받기를 끝낼 수 없고, 점검 중에는 새 서버가 아직 없다.
 */
async function firstSyncOf(deps: RunDeps): Promise<FirstServerSync | null> {
  const stored = await deps.getFirstSync()
  if (stored !== null) return stored
  if ((await deps.identity()) === null || (await deps.underMaintenance())) return null
  return deps.enqueueAll()
}

/**
 * 계정을 알리고 올린 뒤 받는다. 처음 동기화는 받기를 끝낸 뒤에 올린다. **던지지 않는다.**
 *
 * 부팅 곁가지라 실패해도 앱은 떠야 한다. 저장소가 안 열리거나 서버가 답하지 않으면 그 단계를 건너뛰고 다음 동기화에 다시 한다.
 * 올리기를 먼저 해야 아직 못 올린 기기 값이 받은 값에 덮이지 않고, 올리기의 거절로 지운 줄의 서버 값이 같은 동기화에 들어온다.
 * 올리기가 멈춰도 받는다. 남은 대기 줄의 기록은 받기가 건너뛴다.
 */
export async function runServerSync(deps: RunDeps = DEFAULT_DEPS): Promise<void> {
  // 기록보다 먼저다. 서버는 기록의 메이플 ID 가 보낸 신원의 것이 아니면 거절한다. 알리기가 실패해도 기록은 보내고, 거절된 건은 대기
  // 표가 다시 보낸다.
  await deps.prepareAccounts().catch(() => undefined)
  // 처음 동기화를 시작하지 못하면 받기를 먼저 끝낼 수 없어 올리지도 않는다.
  const first = await firstSyncOf(deps).catch(() => null)
  if (first === null) return
  if (!first.pulled) {
    const pulled = await deps.pull().catch(() => null)
    if (pulled === null || !pulled.finished) return
    await deps.markPulled(first).catch(() => undefined)
  }
  await deps.push({ firstQueuedAt: first.queuedAt }).catch(() => undefined)
  await deps.pull().catch(() => undefined)
}
