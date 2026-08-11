import { create } from 'zustand'
import {
  confirmedDropKey,
  filterUnobtainableConfirmedDrops,
  groupDropRecordsByPeriod,
  summarizeValuableDrought,
  type DropHistoryPeriodGroup,
  type DropHistoryRecord,
  type ValuableDroughtSummary,
} from '@core/lib/drop-history'
import { getAllBossDropRecords, type BossDropRecord } from '../../storage/boss-drops'
import { getAllBossProfitRecordKeys } from '../../storage/boss-profit'
import { getCachedCharacterBasic } from '../../storage/character-basic-cache'
import { getTrackedCharacterOcids } from '../../storage/character-selection'

// 드롭 획득 히스토리(전 기간) 상태([[ADR-071]], 이슈 #54). **읽기 전용이다** — 삭제·수정은 드롭 입력
// 시트(보스 수익 화면)만 하고 여기서는 DB에 쓰지 않는다.

export interface DropHistoryCharacter {
  ocid: string
  characterName: string
  imageUrl: string | null
}

interface DropHistoryState {
  status: 'idle' | 'loading' | 'ready' | 'failed'
  groups: DropHistoryPeriodGroup[]
  drought: ValuableDroughtSummary | null
  charactersByOcid: Record<string, DropHistoryCharacter>
  load: (now?: Date) => Promise<void>
}

// 보스 수익 화면의 withSqliteFallback(타임아웃을 fallback으로 삼킴)을 쓰지 않는다 — 여기서 실패를
// 빈 배열로 바꾸면 "기록이 없습니다"라는 **거짓 빈 상태**가 된다. 실패는 실패로 알린다([[ADR-062]]).
const SQLITE_QUERY_TIMEOUT_MS = 5000

function withSqliteTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('SQLite 응답 시간 초과')), SQLITE_QUERY_TIMEOUT_MS),
    ),
  ])
}

// 저장 계층은 부재를 null 로, `RecordedDrop` 은 optional(undefined)로 표현한다 — 여기서 한 번
// 정규화한다(`loadDropsByRowKey` 가 하는 것과 같은 변환). `recordedAt` 은 옮기지 않는다([[ADR-071]]
// 결정 2 — 히스토리가 이 값을 쓸 수 없으므로 타입에서 아예 뺀다).
function toHistoryRecord(record: BossDropRecord): DropHistoryRecord {
  return {
    ocid: record.ocid,
    boss: record.boss,
    difficulty: record.difficulty,
    periodKey: record.periodKey,
    category: record.category,
    itemName: record.itemName,
    slot: record.slot ?? undefined,
    boxOrigin: record.boxOrigin ?? undefined,
    ringLevel: record.ringLevel ?? undefined,
    quantity: record.quantity,
  }
}

export const useDropHistoryStore = create<DropHistoryState>((set) => ({
  status: 'idle',
  groups: [],
  drought: null,
  charactersByOcid: {},

  async load(now = new Date()) {
    set({ status: 'loading' })

    const ocids = await getTrackedCharacterOcids()
    if (ocids === null || ocids.length === 0) {
      set({ status: 'ready', groups: [], drought: null, charactersByOcid: {} })
      return
    }

    try {
      // 드롭 기록과 "처치 난이도가 확정된 조합" 키를 함께 읽는다 — 후자는 획득 불가 기록을 거를
      // 범위를 정하는 데만 쓴다([[ADR-071]] 결정 6).
      const [dropRecords, profitKeys] = await Promise.all([
        withSqliteTimeout(getAllBossDropRecords(ocids)),
        withSqliteTimeout(getAllBossProfitRecordKeys(ocids)),
      ])

      const confirmedKeys = new Set(
        profitKeys.map((key) => confirmedDropKey(key.ocid, key.boss, key.difficulty, key.periodKey)),
      )
      const records = filterUnobtainableConfirmedDrops(dropRecords.map(toHistoryRecord), confirmedKeys)

      // 캐릭터명·아바타는 character-basic-cache가 출처다(보스 수익 store의 캐시 우선 표시 경로와 동일).
      // 이름이 없으면 ocid를 대신 쓰지 않는다 — 화면이 부재를 판단하도록 항목을 만들지 않는다.
      const charactersByOcid: Record<string, DropHistoryCharacter> = {}
      for (const ocid of new Set(records.map((record) => record.ocid))) {
        const cached = await getCachedCharacterBasic(ocid)
        if (cached === null) continue
        charactersByOcid[ocid] = {
          ocid,
          characterName: cached.profile.name,
          imageUrl: cached.profile.imageUrl ?? null,
        }
      }

      set({
        status: 'ready',
        groups: groupDropRecordsByPeriod(records),
        drought: summarizeValuableDrought(records, now),
        charactersByOcid,
      })
    } catch {
      set({ status: 'failed', groups: [], drought: null, charactersByOcid: {} })
    }
  },
}))
