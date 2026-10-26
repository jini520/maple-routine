/**
 * 강화 사용 내역 수집기. 큐브·스타포스·잠재·소울 잠재 넷을 **날짜별로** 받는다.
 *
 * 계정 단위 API 라 ocid 축이 없다. 하루가 4콜이고 캐릭터 수를 안 곱한다.
 *
 * 창 채우기와 다른 점이 하나 있다. 창은 캐릭터 × 날짜가 작업이고 여기는 **종류 × 날짜**다.
 * 하루가 1000줄을 넘기면 커서로 콜이 더 나가는데, 콜을 세면 분모가 도는 중에 늘어난다. 커서는
 * 작업 **안쪽** 일이라 밖에서는 1이다.
 */
import { currentCredential } from '../auth/current-credential'
import { fillLegacyAccountIds } from '../auth/legacy-account-ids'
import { ensureEnhancementTotals } from './legacy-totals'
import type { NexonCredential } from '../../types/auth'
import { fetchAndRecordCharacterList } from '../mvp-grade/character-list'
import type { EnhancementHistoryRow, EnhancementKind } from '../../nexon/history/client'
import { equipmentItemKeyOfApiName } from '../../lib/equipment/equipment-items'
import { fetchEnhancementHistory } from '../../nexon/history/client'
import { saveEventWorldNames } from '../../storage/event-world-names'
import { checkKey, loadEnhancementChecks, markEnhancementChecked } from '../../storage/enhancement-history'
import { replaceEnhancementTotals } from '../../storage/enhancement-totals'
import { reportEnhancementTotals } from '../server-sync/report'
import { summarizeEnhancement } from './spending'
import { eventWorldCharacterNames } from '../../lib/enhancement/world'
import { SOUL_POTENTIAL_FROM } from '../../lib/enhancement/cost'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { mapWithLimit } from '../schedule-window/gate'

/** 네 종류. 순서가 진행 표시에 보이지 않으므로 아무래도 된다. */
export const ENHANCEMENT_KINDS: readonly EnhancementKind[] = ['cube', 'starforce', 'potential', 'soul_potential']

/** 그 날짜에 있을 수 있는 종류. 소울은 패치 전 날짜에 빈 응답만 오므로 안 부른다. */
function kindsOn(dateKey: string): readonly EnhancementKind[] {
  return dateKey < SOUL_POTENTIAL_FROM ? ENHANCEMENT_KINDS.filter((kind) => kind !== 'soul_potential') : ENHANCEMENT_KINDS
}

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
 * 조회 기록은 넥슨 계정마다 따로다. 계정 칸이 생기기 전의 기록을 메인 계정으로 채운 뒤에 읽는다.
 *
 * @param nexonAccountId 부를 자격의 넥슨 계정 id
 * @param todayDateKey KST `YYYY-MM-DD`. 이보다 뒤는 아직 없는 날이라 안 부른다
 */
export async function planEnhancementHistory(
  nexonAccountId: string,
  dateKeys: readonly string[],
  todayDateKey: string,
): Promise<EnhancementHistoryJob[]> {
  const days = dateKeys.filter((dateKey) => dateKey <= todayDateKey)
  if (days.length === 0) return []

  await fillLegacyAccountIds()
  await ensureEnhancementTotals()
  const checks = await loadEnhancementChecks(nexonAccountId, days)
  const jobs: EnhancementHistoryJob[] = []
  for (const dateKey of days) {
    for (const kind of kindsOn(dateKey)) {
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
  const accountId = (await currentCredential())?.accountId ?? null
  if (accountId === null) return { total: 0, hasPast: false }
  const todayDateKey = getCurrentKstDateKey(now)
  const jobs = await planEnhancementHistory(accountId, dateKeys, todayDateKey)
  return {
    total: jobs.length,
    hasPast: jobs.some((job) => job.dateKey !== todayDateKey),
  }
}

/**
 * 한 칸(종류 · 날짜)의 모든 쪽을 받는다. 1 쪽의 커서와 받은 줄 전부를 돌려준다.
 *
 * 합계에는 응답 줄의 id 가 없어 이미 받은 줄을 가릴 수 없다. 그래서 그 날을 통째로 받아 합계를 다시 만든다. 하루 기록은
 * 보통 한 쪽(1000 줄) 안이다.
 */
async function fetchDay(
  credential: NexonCredential,
  job: EnhancementHistoryJob,
): Promise<{ firstCursor: string | null; rows: EnhancementHistoryRow[] }> {
  const rows: EnhancementHistoryRow[] = []
  let cursor: string | null = null
  let firstCursor: string | null = null
  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    const query = cursor === null ? { dateKey: job.dateKey } : { cursor }
    const page = await fetchEnhancementHistory(credential, job.kind, equipmentItemKeyOfApiName, query)
    if (pageIndex === 0) firstCursor = page.nextCursor
    rows.push(...page.rows)
    if (page.nextCursor === null) break
    cursor = page.nextCursor
  }
  return { firstCursor, rows }
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
  const credential = await currentCredential()
  const accountId = credential?.accountId ?? null
  if (credential === null || accountId === null) {
    onProgress?.(0, 0)
    return
  }

  const todayDateKey = getCurrentKstDateKey(now)
  const jobs = await planEnhancementHistory(accountId, dateKeys, todayDateKey)

  // 분모가 여기서 확정된다. 부를 것이 없어도 한 번은 알린다(화면이 바를 안 그리게).
  onProgress?.(0, jobs.length)
  if (jobs.length === 0) return

  // 목록을 못 받은 것과 스페셜 캐릭터가 없는 것은 다르다. 앞은 null, 뒤는 빈 집합이다.
  const eventNames = await fetchAndRecordCharacterList(credential)
    .then(async (accounts) => {
      const names = eventWorldCharacterNames(accounts)
      // 읽는 쪽이 이것을 쓴다. 칸 하나 그릴 때마다 계정 목록을 부를 수는 없다.
      await saveEventWorldNames(names).catch(() => undefined)
      return names
    })
    .catch(() => null)

  const checkedAt = now.toISOString()
  await mapWithLimit(
    jobs,
    HISTORY_CALL_LIMIT,
    async (job) => {
      const { firstCursor, rows } = await fetchDay(credential, job)
      const totals = summarizeEnhancement(
        rows.map((row) => ({ ...row, kind: job.kind })),
        eventNames,
      )
      const { writtenIds, removedIds } = await replaceEnhancementTotals(accountId, job.kind, job.dateKey, totals, now)
      await reportEnhancementTotals([...writtenIds, ...removedIds], now)
      // 목록을 못 받은 회차는 이벤트 월드를 가리지 못한 줄이 있어 굳히지 않는다. 다음 회차가 다시 받아 판정을 채운다.
      const settled = job.dateKey < todayDateKey && eventNames !== null
      await markEnhancementChecked(accountId, job.kind, job.dateKey, firstCursor, settled, checkedAt)
    },
    (done) => onProgress?.(done, jobs.length),
  )
}
