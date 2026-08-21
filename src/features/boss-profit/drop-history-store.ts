import { create } from 'zustand'
import {
  confirmedDropKey,
  filterUnobtainableConfirmedDrops,
  groupDropRecordsByPeriod,
  summarizeValuableDrought,
  type DropHistoryPeriodGroup,
  type DropHistoryRecord,
  type ValuableDroughtSummary,
} from '../../lib/drop-history'
import {
  getAllBossDropRecords,
  getBossDropRecordsRevision,
  type BossDropRecord,
} from '../../storage/boss-drops'
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
  /**
   * 지금 들고 있는 스냅샷이 **어느 시점의 `boss_drop_records` 인가**
   * (`storage/boss-drops` 의 `getBossDropRecordsRevision`).
   *
   * 이 화면이 push 페이지였을 때는 필요 없었다 — 열 때마다 새로 마운트돼 늘 최신을 읽었다.
   * `today` 가 **탭**으로 같은 스토어를 상시 구독하면서 그 성질이 사라졌다([[ADR-145]] 결정 2 —
   * *"탭 화면은 마운트된 채 남아 «진입 시점» 이라는 사건이 앱 실행당 한 번이 된다"*).
   *
   * `-1` 은 «아직 아무것도 안 읽었다» 이고, 실제 리비전(0부터)과 절대 같아지지 않는다.
   */
  loadedRevision: number
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
    // ⚠️ **가격 셋을 빠뜨리면 저장은 됐는데 화면이 영영 「미입력」으로 보인다**([[ADR-124]] 결정 4).
    // `rows.ts` 의 같은 변환이 그 경고를 이미 적어 뒀는데 이 사본이 그것을 안 따라왔다 —
    // 히스토리 화면은 금액을 안 그려서 안 터졌고, today 의 「최고가 아이템」·「가격 미입력」이
    // 처음으로 이 필드를 읽으면서 드러났다(최고가는 `entered` 가 하나도 없어 늘 비고, 미입력은
    // 전부 `undefined` 라 입력해도 건수가 안 준다).
    priceState: record.priceState ?? undefined,
    priceMeso: record.priceMeso ?? undefined,
    priceShare: record.priceShare ?? undefined,
  }
}

export const useDropHistoryStore = create<DropHistoryState>((set) => ({
  status: 'idle',
  groups: [],
  drought: null,
  charactersByOcid: {},
  loadedRevision: -1,

  async load(now = new Date()) {
    set({ status: 'loading' })

    // **읽기 «전»에 찍는다.** 읽는 중에 다른 화면이 기록을 바꾸면 리비전이 더 올라가고, 그러면
    // 이 스냅샷은 낡은 것이 맞다 — 다음 진입이 다시 읽는다. 읽은 «뒤»에 찍으면 그 변경을
    // 이미 본 것으로 표시해 영영 놓친다.
    const revision = getBossDropRecordsRevision()

    const ocids = await getTrackedCharacterOcids()
    if (ocids === null || ocids.length === 0) {
      set({ status: 'ready', groups: [], drought: null, charactersByOcid: {}, loadedRevision: revision })
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
        loadedRevision: revision,
      })
    } catch {
      // 실패에는 리비전을 찍지 않는다 — 스냅샷이 없으므로 «어느 시점» 도 없고, 그대로 두면
      // 다음 진입이 다시 시도한다.
      set({ status: 'failed', groups: [], drought: null, charactersByOcid: {} })
    }
  },
}))
