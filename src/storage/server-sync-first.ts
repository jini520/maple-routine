/**
 * 처음 동기화가 기기의 기록을 모두 대기 표에 넣는 자리와 그 표시(Preferences `firstServerSync`).
 *
 * 기기 변환이 옮긴 줄은 트리거를 거치지 않아 대기 표에 없다. 대기 표는 앱이 꺼져도 남아서, 어디까지 올렸는지는 적지 않고 넣기를
 * 마친 시각과 받기를 끝냈는지만 적는다.
 *
 * @see docs/foundation/server-sync.md `처음 동기화`
 */
import { bossProfitCalculatorSyncRecordIds } from './boss-profit-calculator-records'
import { subPageOrderSyncRecordIds } from './bar-order'
import { trackedCharacterSyncRecordIds } from './character-selection'
import { figureMotionSyncRecordIds } from './figure-motions'
import { STORAGE_KEYS } from './keys'
import { manualTrackedSyncRecordIds } from './manual-tracked-content'
import { mapleIdNameSyncRecordIds } from './maple-id-names'
import { partyAppointmentSyncRecordIds } from './party-appointments'
import { preferences } from './ports'
import { enqueueServerSyncRecords, preferenceRecordIdOf, type ServerSyncTable } from './server-sync-queue'
import { storedSettingColumns } from './server-sync-records'
import { sharedProgressSyncRecordIds } from './shared-progress-cache'
import { getBossProfitDb } from './sqlite/db'
import { enqueueAllRecordRows } from './sqlite/server-sync-triggers'
import { inTransaction } from './sqlite/transaction'

export interface FirstServerSync {
  /** 넣기를 마친 시각(ISO). 이 시각까지 대기 표에 들어간 줄이 처음 올리기다 */
  queuedAt: string
  /** 넣은 뒤 `hasMore` 가 꺼질 때까지 받았나. 받기 전에 올리면 유일 기준이 같은 기기 줄이 서버 id 로 바뀌지 않은 채 올라간다 */
  pulled: boolean
}

/**
 * 깨진 표시는 마친 것으로 읽는다. 다시 넣으면 받은 기록까지 서버로 되돌아가고, 마친 것으로 읽으면 처음 올리기의 거절이 알려질 뿐이다.
 */
const BROKEN: FirstServerSync = { queuedAt: '', pulled: true }

/** 처음 동기화의 표시. 아직 넣지 않았으면 `null` 이다. */
export async function getFirstServerSync(): Promise<FirstServerSync | null> {
  const raw = await preferences.get(STORAGE_KEYS.firstServerSync)
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw) as { queuedAt?: unknown; pulled?: unknown }
    return typeof parsed.queuedAt === 'string' && typeof parsed.pulled === 'boolean'
      ? { queuedAt: parsed.queuedAt, pulled: parsed.pulled }
      : BROKEN
  } catch {
    return BROKEN
  }
}

async function setFirstServerSync(first: FirstServerSync): Promise<void> {
  await preferences.set(STORAGE_KEYS.firstServerSync, JSON.stringify(first))
}

/** Preferences 기록의 대기 줄. 저장 함수가 넣는 항목과 같다. */
async function preferenceRecords(): Promise<{ table: ServerSyncTable; recordId: string }[]> {
  const listers: [ServerSyncTable, () => Promise<string[]>][] = [
    ['partyAppointments', partyAppointmentSyncRecordIds],
    ['bossProfitCalculatorRecords', bossProfitCalculatorSyncRecordIds],
    ['manualTrackedItems', manualTrackedSyncRecordIds],
    ['sharedContentProgress', sharedProgressSyncRecordIds],
    ['mapleIdNames', mapleIdNameSyncRecordIds],
    ['trackedCharacters', trackedCharacterSyncRecordIds],
    ['representativeCharacterMotions', figureMotionSyncRecordIds],
    ['accountSettings', async () => (await storedSettingColumns()).map((column) => preferenceRecordIdOf('accountSettings', [column]))],
    ['bottomBarSubPageOrders', subPageOrderSyncRecordIds],
  ]
  const records: { table: ServerSyncTable; recordId: string }[] = []
  for (const [table, list] of listers) for (const recordId of await list()) records.push({ table, recordId })
  return records
}

/**
 * 기기의 기록을 모두 대기 표에 넣고 표시를 적는다. 이미 대기 줄이 있는 기록은 그 줄을 둔다. 넣는 동안 앱이 꺼지면 표시가 없어 다음
 * 동기화가 다시 넣고, 같은 결과가 된다.
 *
 * @returns 적은 표시. 받기는 아직 끝내지 않았다
 */
export async function enqueueAllServerSyncRecords(): Promise<FirstServerSync> {
  // Preferences 를 트랜잭션 밖에서 읽는다. 트랜잭션을 길게 쥐면 같은 연결의 다른 쓰기가 그 안에 섞인다.
  const records = await preferenceRecords()
  const queuedAt = new Date().toISOString()
  const db = await getBossProfitDb()
  await inTransaction(db, async () => {
    await enqueueAllRecordRows(db, queuedAt)
    await enqueueServerSyncRecords(db, records, queuedAt)
  })
  const first: FirstServerSync = { queuedAt, pulled: false }
  await setFirstServerSync(first)
  return first
}

/** 처음 동기화의 받기를 끝냈다. 그 뒤의 동기화는 평소처럼 올린 뒤 받는다. */
export async function markFirstServerSyncPulled(first: FirstServerSync): Promise<void> {
  await setFirstServerSync({ ...first, pulled: true })
}
