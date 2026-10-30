/**
 * 드롭 획득 히스토리(전 기간)를 드는 쿼리. 히스토리 화면과 today 의 드롭 위젯이 같은 열쇠를 본다. 읽기 전용이다.
 * 삭제 · 수정은 드롭 입력 시트만 하고 여기서는 DB 에 쓰지 않는다.
 *
 * 드롭 기록과 보스 기록의 판이 오르면 무효화된다. 전에는 today 가 포커스마다 판을 견줘 다시 읽었다.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'

import {
  confirmedDropKey,
  filterUnobtainableConfirmedDrops,
  groupDropRecordsByPeriod,
  summarizeValuableDrought,
  type DropHistoryPeriodGroup,
  type DropHistoryRecord,
  type ValuableDroughtSummary,
} from '../../lib/drop/drop-history'
import { getAllBossDropRecords, type BossDropRecord } from '../../storage/boss-drops'
import { getAllBossProfitRecordKeys, getRecordedCharacterOcids } from '../../storage/boss-profit'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { resolveDisplayProfiles } from '../character-profile/resolve'
import { queryKeys } from '../query/keys'
import { withSqliteTimeout } from './sqlite-guards'

export interface DropHistoryCharacter {
  ocid: string
  characterName: string
  imageUrl: string | null
}

export interface DropHistoryData {
  groups: DropHistoryPeriodGroup[]
  drought: ValuableDroughtSummary | null
  charactersByOcid: Record<string, DropHistoryCharacter>
}

const EMPTY: DropHistoryData = { groups: [], drought: null, charactersByOcid: {} }

// 저장 계층은 부재를 null 로, `RecordedDrop` 은 optional(undefined)로 표현한다. 여기서 한 번 정규화한다.
// `recordedAt` 은 옮기지 않는다. 히스토리가 이 값을 쓸 수 없으므로 타입에서 뺀다.
function toHistoryRecord(record: BossDropRecord): DropHistoryRecord {
  return {
    ocid: record.ocid,
    bossKey: record.bossKey,
    boss: record.boss,
    difficulty: record.difficulty,
    periodKey: record.periodKey,
    category: record.category,
    itemKey: record.itemKey,
    itemName: record.itemName,
    boxOriginKey: record.boxOriginKey ?? undefined,
    boxOrigin: record.boxOrigin ?? undefined,
    ringLevel: record.ringLevel ?? undefined,
    dropRecordId: record.dropRecordId,
    quantity: record.quantity,
    // 가격 셋을 빠뜨리면 저장은 됐는데 화면이 영영 미입력으로 보인다. 히스토리 화면은 금액을 안 그려 안 터지고,
    // today 의 최고가 아이템 · 가격 미입력이 이 필드를 처음 읽으면서 드러난다.
    priceState: record.priceState ?? undefined,
    priceMeso: record.priceMeso ?? undefined,
    priceSplitMode: record.priceSplitMode ?? undefined,
    pricePartySize: record.pricePartySize ?? undefined,
    priceShare: record.priceShare ?? undefined,
    priceMyShare: record.priceMyShare ?? undefined,
    saleFeePercent: record.saleFeePercent ?? undefined,
    splitFeePercent: record.splitFeePercent ?? undefined,
    saleFeeAuto: record.saleFeeAuto || undefined,
    splitFeeAuto: record.splitFeeAuto || undefined,
  }
}

/**
 * 전 기간을 읽는다. **실패는 던진다.** 빈 배열로 바꾸면 기록이 없습니다 라는 거짓 빈 상태가 된다. 그래서 보스 수익 화면의
 * `withSqliteFallback` 이 아니라 던지는 `withSqliteTimeout` 을 쓴다.
 */
export async function loadDropHistory(now = new Date()): Promise<DropHistoryData> {
  // 추적 목록으로 범위를 정하면 캐릭터를 관리 목록에서 뺀 순간 그 캐릭터가 먹은 것이 전부 사라진다. 기록을 남긴 캐릭터를
  // 함께 든다.
  const tracked = (await getTrackedCharacterOcids()) ?? []
  const recorded = await getRecordedCharacterOcids().catch(() => [])
  const ocids = [...new Set([...tracked, ...recorded])]
  if (ocids.length === 0) return EMPTY

  // 드롭 기록과 처치 난이도가 확정된 조합의 키를 함께 읽는다. 후자는 획득 불가 기록을 거를 범위를 정하는 데만 쓴다.
  const [dropRecords, profitKeys] = await Promise.all([
    withSqliteTimeout(getAllBossDropRecords(ocids)),
    withSqliteTimeout(getAllBossProfitRecordKeys(ocids)),
  ])
  const confirmedKeys = new Set(
    profitKeys.map((key) => confirmedDropKey(key.ocid, key.bossKey, key.difficulty, key.periodKey)),
  )
  const records = filterUnobtainableConfirmedDrops(dropRecords.map(toHistoryRecord), confirmedKeys)

  // 캐릭터명 · 아바타는 지워지지 않는 스냅샷이 출처다. 이름이 없으면 ocid 를 대신 쓰지 않는다. 화면이 부재를 판단하도록
  // 항목을 만들지 않는다.
  const profiles = await resolveDisplayProfiles(records.map((record) => record.ocid))
  const charactersByOcid: Record<string, DropHistoryCharacter> = {}
  for (const [ocid, profile] of profiles) {
    charactersByOcid[ocid] = { ocid, characterName: profile.name, imageUrl: profile.imageUrl }
  }

  return {
    groups: groupDropRecordsByPeriod(records),
    drought: summarizeValuableDrought(records, now),
    charactersByOcid,
  }
}

export const dropHistoryOptions = queryOptions<DropHistoryData>({
  queryKey: queryKeys.dropHistory(),
  queryFn: () => loadDropHistory(),
  staleTime: Number.POSITIVE_INFINITY,
  meta: { tables: ['boss_drop_records', 'boss_profit_records'] },
})

export type DropHistoryStatus = 'loading' | 'ready' | 'failed'

export interface DropHistory extends DropHistoryData {
  /** `loading` 은 아직 한 번도 못 읽었다 다. 다시 읽는 동안은 든 값이 그대로 `ready` 다. */
  status: DropHistoryStatus
  /** 신선해도 다시 읽는다. 실패 화면의 다시 시도가 부른다. */
  reload: () => Promise<void>
}

export function useDropHistory(): DropHistory {
  const query = useQuery(dropHistoryOptions)
  const status: DropHistoryStatus = query.status === 'error' ? 'failed' : query.status === 'success' ? 'ready' : 'loading'
  return {
    ...(query.data ?? EMPTY),
    status,
    reload: async () => {
      await query.refetch()
    },
  }
}
