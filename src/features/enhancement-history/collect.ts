/**
 * 강화 사용 내역 수집기. 큐브·스타포스·잠재 셋을 **날짜별로** 받는다.
 *
 * 계정 단위 API 라 ocid 축이 없다. 하루가 3콜이고 캐릭터 수를 안 곱한다.
 *
 * 창 채우기와 다른 점이 하나 있다. 창은 캐릭터 × 날짜가 작업이고 여기는 **종류 × 날짜**다.
 * 하루가 1000줄을 넘기면 커서로 콜이 더 나가는데, 콜을 세면 분모가 도는 중에 늘어난다. 커서는
 * 작업 **안쪽** 일이라 밖에서는 1이다.
 */
import { fetchCharacterList } from '../../nexon/character'
import type { EnhancementHistoryRow, EnhancementKind } from '../../nexon/history/client'
import { fetchEnhancementHistory } from '../../nexon/history/client'
import { getAuthConfig } from '../../storage/api-key'
import { saveEventWorldNames } from '../../storage/event-world-names'
import {
  checkKey,
  loadEnhancementChecks,
  loadKnownHistoryIds,
  loadObservedItemLevels,
  markEnhancementChecked,
  saveEnhancementHistory,
} from '../../storage/enhancement-history'
import { enhancementCostOf } from './spending'
import { eventWorldCharacterNames } from '../../lib/enhancement/world'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { mapWithLimit } from '../schedule-window/gate'

/** 세 종류. 순서가 진행 표시에 보이지 않으므로 아무래도 된다. */
export const ENHANCEMENT_KINDS: readonly EnhancementKind[] = ['cube', 'starforce', 'potential']

/**
 * 한 번에 나가는 조회 수. 창(6)보다 낮게 잡는다. 둘이 같은 회차에 돌 수 있어 합이 한도를 친다.
 */
export const HISTORY_CALL_LIMIT = 3

/** 한 날짜에서 따라갈 커서의 최대 쪽수. 무한 루프를 막는 안전핀이지 정책이 아니다. */
const MAX_PAGES = 50

export interface EnhancementHistoryJob {
  kind: EnhancementKind
  dateKey: string
}

/** 진행. **분모는 한 콜도 나가기 전에 확정**되고 도는 중에 안 늘어난다. */
export type HistoryProgress = (done: number, total: number) => void


/**
 * 부를 `(종류, 날짜)` 를 센다. **콜이 한 건도 안 나간다.**
 *
 * 굳은 칸은 뺀다. 그래서 지난 달 두 번째 방문이 0콜이다. 오늘은 굳을 수 없어 언제나 든다.
 *
 * @param todayDateKey KST `YYYY-MM-DD`. 이보다 뒤는 아직 없는 날이라 안 부른다
 */
export async function planEnhancementHistory(
  dateKeys: readonly string[],
  todayDateKey: string,
): Promise<EnhancementHistoryJob[]> {
  const days = dateKeys.filter((dateKey) => dateKey <= todayDateKey)
  if (days.length === 0) return []

  const checks = await loadEnhancementChecks(days)
  const jobs: EnhancementHistoryJob[] = []
  for (const dateKey of days) {
    for (const kind of ENHANCEMENT_KINDS) {
      const check = checks.get(checkKey(kind, dateKey))
      if (dateKey < todayDateKey && check?.settled === true) continue
      jobs.push({ kind, dateKey })
    }
  }
  return jobs
}

/** 회차를 시작하기 전에 원장만 읽어 낸 크기. **콜이 한 건도 안 나간다.** */
export interface HistoryPlanSize {
  /** 이 회차의 작업 수. 그대로 **진행 바의 분모**가 된다 */
  total: number
  /**
   * 오늘이 아닌 날의 작업이 있나. 모달을 띄울지의 근거다.
   *
   * **오늘은 빼고 센다.** 오늘 칸은 굳을 수 없어 어느 회차에나 들고, 세면 이미 받아 둔 달로
   * 돌아올 때도 참이 된다. 오늘 셋만 받는 회차는 3콜이라 눈에 안 띈다.
   */
  hasPast: boolean
}

/**
 * 기간을 옮기기 전에 이 범위의 회차가 얼마짜리인지 잰다. SQLite 한 번이다.
 *
 * 두 가지에 쓴다. **모달을 띄울지**(`hasPast`)와 **진행 바의 분모**(`total`)다. 분모를 여기서
 * 넘겨받지 않으면 바가 모달보다 늦게 뜬다 - 회차 안에서 분모가 정해지는데 그 앞에 저장소 왕복이
 * 셋 있어서, 모달은 이미 서 있는데 카드가 짧게 떴다가 자란다.
 *
 * @param now 오늘이 어느 날인지 KST 로 잰다
 */
export async function measureEnhancementHistory(
  dateKeys: readonly string[],
  now: Date,
): Promise<HistoryPlanSize> {
  const todayDateKey = getCurrentKstDateKey(now)
  const jobs = await planEnhancementHistory(dateKeys, todayDateKey)
  return {
    total: jobs.length,
    hasPast: jobs.some((job) => job.dateKey !== todayDateKey),
  }
}

/**
 * 한 칸을 받는다. 받은 줄 수가 아니라 **끝까지 읽었나**를 돌려준다.
 *
 * 아는 id 를 만나면 멈춘다. 그 아래는 이미 들어 있다. 안 그러면 하루가 1000줄을 넘길 때마다
 * 그 날의 모든 쪽을 매번 다시 받는다.
 */
/**
 * 값을 매길 수 있는 줄만 남긴다. **못 매기는 줄은 버린다**(사용자 지정 2026-09-10).
 *
 * 전에는 다 저장하고 읽을 때 `costMeso: null` 로 두어, 화면이 그 줄을 `값 모름` 으로 세웠다.
 * 금액을 못 적는 줄은 목록에서 자리만 차지하고 합계에도 안 들어간다.
 *
 * 실제로 걸리는 것은 **장비 레벨을 못 푸는 스타포스**뿐이다(응답에 `item_level` 이 없다).
 * 큐브·잠재는 응답이 레벨을 주므로 안 버려진다.
 *
 * @param observedLevels 회차가 시작할 때 한 번 읽은 표. 이 회차에 새로 들어온 레벨은 안 든다
 */
function pricedRows(
  kind: EnhancementKind,
  rows: readonly EnhancementHistoryRow[],
  observedLevels: ReadonlyMap<string, number>,
): EnhancementHistoryRow[] {
  return rows.filter((row) => enhancementCostOf({ ...row, kind }, observedLevels) !== null)
}

async function collectOne(
  apiKey: string,
  job: EnhancementHistoryJob,
  observedLevels: ReadonlyMap<string, number>,
): Promise<string | null> {
  const known = await loadKnownHistoryIds(job.kind, job.dateKey)
  let cursor: string | null = null
  let firstCursor: string | null = null

  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    const query = cursor === null ? { dateKey: job.dateKey } : { cursor }
    const page = await fetchEnhancementHistory(apiKey, job.kind, query)
    if (pageIndex === 0) firstCursor = page.nextCursor

    await saveEnhancementHistory(job.kind, pricedRows(job.kind, page.rows, observedLevels))

    /**
     * **버린 줄도 아는 줄이다.** 커서를 멈추는 판정은 받은 쪽 전체로 한다. 저장된 것만 보면
     * 버려진 줄만 있는 쪽에서 영영 안 멈춰 쪽수를 끝까지 따라간다.
     */
    const reachedKnown = page.rows.some((row: EnhancementHistoryRow) => known.has(row.id))
    if (page.nextCursor === null || reachedKnown) break
    cursor = page.nextCursor
  }

  return firstCursor
}

/**
 * 창의 형제. **던지지 않는다.** 못 채운 칸은 원장에 안 남아 다음 회차가 다시 온다.
 *
 * 계정 목록을 먼저 한 번 받는다. 큐브·잠재 응답에 `world_name` 이 없어 스페셜 캐릭터를 이름으로
 * 가려야 하고, 그 이름을 여기서만 알 수 있다. **못 받으면 그 날짜를 안 굳힌다** - 지출을 가릴 수
 * 없는 채로 굳히면 다시 올 계기가 사라진다. 줄 자체는 받아 둔다. 사실은 사실이다.
 */
export async function collectEnhancementHistory(
  dateKeys: readonly string[],
  now: Date,
  onProgress?: HistoryProgress,
): Promise<void> {
  const authConfig = await getAuthConfig()
  if (authConfig === null) {
    onProgress?.(0, 0)
    return
  }

  const todayDateKey = getCurrentKstDateKey(now)
  const jobs = await planEnhancementHistory(dateKeys, todayDateKey)

  // 분모가 여기서 확정된다. 부를 것이 없어도 한 번은 알린다(화면이 바를 안 그리게).
  onProgress?.(0, jobs.length)
  if (jobs.length === 0) return

  // 목록을 못 받은 것과 스페셜 캐릭터가 없는 것은 다르다. 앞은 null, 뒤는 빈 집합이다.
  const eventNames = await fetchCharacterList(authConfig.apiKey)
    .then(async (accounts) => {
      const names = eventWorldCharacterNames(accounts)
      // 읽는 쪽이 이것을 쓴다. 칸 하나 그릴 때마다 계정 목록을 부를 수는 없다.
      await saveEventWorldNames(names).catch(() => undefined)
      return names
    })
    .catch(() => null)

  /**
   * 이름에서 레벨로. **회차마다 한 번**만 읽는다. 값을 못 매기는 줄을 버리는 판정이 이 표를
   * 본다. 작업마다 읽으면 같은 집계를 수십 번 돌린다.
   *
   * 이 회차에 새로 들어온 레벨은 안 든다. 그래서 처음 켠 사람의 스타포스 줄 중 정적 표
   * (`equipment-items.json`)에도 없는 장비는 버려질 수 있다.
   */
  const observedLevels = await loadObservedItemLevels().catch(() => new Map<string, number>())

  const checkedAt = now.toISOString()
  await mapWithLimit(
    jobs,
    HISTORY_CALL_LIMIT,
    async (job) => {
      const firstCursor = await collectOne(authConfig.apiKey, job, observedLevels)
      const settled = job.dateKey < todayDateKey && eventNames !== null
      await markEnhancementChecked(job.kind, job.dateKey, firstCursor, settled, checkedAt)
    },
    (done) => onProgress?.(done, jobs.length),
  )
}
