/**
 * 보스 수익 한 기간의 스냅샷을 만드는 자리. `bossProfitPeriod(tab, periodKey)` 쿼리의 `queryFn` 이 `buildPeriodSnapshot` 을 부른다.
 *
 * 지금 기간의 행은 스케줄 쿼리 캐시(`schedule(ocid)`)와 회차 결과에서, 지난 기간의 행은 기록에서 만든다. 지금 기간을 캐시에서
 * 만드는 것은 회차가 그 캐시를 채우는 유일한 자리라서다. 전에는 스토어가 동기화 결과를 `latestSyncSnapshot` 에 따로 들었고,
 * 그 사본이 캐시와 어긋나는 자리가 결함이 됐다.
 *
 * 지금 기간의 쓰기(자동 기록 · 리프 중복 · 고아 드롭 정리)는 회차가 한다(`round-record.ts`). 여기서 쓰는 것은 지난 기간의 고아
 * 드롭 정리뿐이다. 과거 기간은 기록이 곧 사실이라 동기화 신선도를 따질 것이 없고, 그 기간을 그리는 자리가 여기뿐이다.
 */
import {
  getCurrentBossProfitPeriod,
  getWeeklyPeriodKeysInMonth,
  isPeriodQueryable,
  resolvePagePeriodState,
  resolvePeriodDataState,
  type PeriodDataState,
  type PeriodQueryOutcome,
} from '../../lib/boss/boss-profit-period'
import { isMonthlyRowInWeek, monthsOfWeek } from '../../lib/boss/monthly-boss-week'
import { compareByName } from '../../lib/character-order'
import { sumDropPayout } from '../../lib/drop/drop-price'
import { getBossDropRecords } from '../../storage/boss-drops'
import {
  getBossProfitRecords,
  getRecordedCharacterOcids,
  getWeeklyPeriodKeysWithRecords,
  type BossProfitRecord,
} from '../../storage/boss-profit'
import { getScheduleProbeLedger } from '../../storage/schedule-probe-ledger'
import { getTrackingMode } from '../../storage/tracking-mode'
import type { RecordedDrop } from '../../types/drops'
import type { BossCycle } from '../../types'
import { resolveDisplayProfiles } from '../character-profile/resolve'
import { readScheduleSnapshot } from '../schedule-sync/read-schedule'
import {
  loadObservedPeriodKeys,
  loadUnqueryablePeriodKeys,
  periodStateKey,
  toPeriodOutcomes,
} from '../schedule-window/records'
import { syncScheduleWindow } from '../schedule-window/sync'
import { getLastWindowFailures } from '../schedule-window/window'
import { loadDropsByRowKey } from './drops-loader'
import { sweepOrphanDrops } from './orphan-drops'
import { canReachPreviousPeriod } from './period-navigation'
import { currentPeriodKeys, readManualCompletedKeys, readManualItems } from './round-record'
import {
  appendRecordOnlyRows,
  buildBossProfitRow,
  buildRowFromRecord,
  dropRowKey,
  filterRowsForTab,
  mergeRecordsIntoRows,
  selectProfitDisplayBosses,
  sortRowsByOcidOrder,
  sumRowsPayout,
  toProfileSnapshot,
  toRecordedDrop,
  type BossProfitRow,
  type CharacterProfileInfo,
  type SortedCharacterInfo,
} from './rows'
import { withSqliteFallback } from './sqlite-guards'

/**
 * 월간 탭 주차 행의 상태. 기간 6상태에 이 화면 고유의 두 상태를 더한다. `inProgress`(지금
 * 진행 중인 주)와 `upcoming`(아직 시작하지 않은 주).
 *
 * `notChecked` 가 따로 있는 것은 조회한 적 없는 주를 `confirmed` 0메소로 위장하지 않기
 * 위해서다.
 */
export type WeeklySubtotalState = PeriodDataState | 'inProgress' | 'upcoming'

export interface BossProfitWeeklySubtotal {
  ocid: string
  characterName: string
  imageUrl: string | null
  periodKey: string
  totalMeso: number
  /**
   * 그 주에 기록된 드롭. `totalMeso` 에 이미 환산돼 들어 있다.
   *
   * 합이 아니라 목록으로 드는 것은 주차 소계 행의 내역 팝오버가 아이템을 낱개로 보여줘야 하기 때문이다.
   */
  drops: RecordedDrop[]
  state: WeeklySubtotalState
}

/** 행 없이 카드만 세우는 데 필요한 것. 이름과 얼굴이 전부다. */
export interface CharacterCardStub {
  ocid: string
  characterName: string
  imageUrl: string | null
}

/** 한 기간에 대해 화면이 읽는 값 전부. */
export interface PeriodSnapshot {
  rows: BossProfitRow[]
  /** 보스 행 키(`dropRowKey`) → 기록된 드롭. 이 기간의 행만 든다. */
  dropsByRowKey: Record<string, RecordedDrop[]>
  /** 월간 탭에서만 찬다. 주간 탭은 `[]`. */
  weeklySubtotals: BossProfitWeeklySubtotal[]
  periodState: PeriodDataState
  /**
   * 이 기간에 **아직 집계 안 된 날**이 있나(`OPENAPI00009`). `periodState` 와 갈라 든다. 그 값은 관측이 하나라도 있으면
   * `confirmedEmpty` 에서 끝나 이 사실이 묻힌다. 화면이 이것으로 기록이 없어도 요약을 그린다.
   */
  periodPendingAggregation: boolean
  /** 한 칸 더 과거로 갈 수 있나. 이전 기간이 조회 가능하거나 기록이 있을 때만 참이다. */
  canGoPreviousPeriod: boolean
  /**
   * 행이 하나도 없지만 카드는 세워야 하는 캐릭터. 조회할 수 없게 된 추적 캐릭터다.
   * **주간 탭의 지금 기간에서만 찬다.** 다른 기간은 기록이 있으면 이미 행으로 서고, 월간 탭은 주차 소계의 추적 게이트가 세운다.
   */
  unqueryableCards: CharacterCardStub[]
}

/**
 * 화면에 그릴 캐릭터. 추적 목록 ∪ 기록을 남긴 캐릭터다. 추적 목록만 보면 캐릭터를 관리 목록에서 뺀 순간 지운 적 없는 과거
 * 수익이 통째로 사라진다. **이 배열을 동기화 · 고아 드롭 정리에 넘기면 안 된다.** 그쪽은 추적 목록이다.
 */
export async function resolveDisplayOcids(trackedOcids: readonly string[]): Promise<string[]> {
  const recorded = await withSqliteFallback(getRecordedCharacterOcids(), [])
  return [...new Set([...trackedOcids, ...recorded])]
}

/**
 * 레벨 내림차순(같으면 이름순)으로 정렬한 캐릭터 정보. 캐시 우선 표시부터 과거 기간까지 전부 이 순서를 따른다.
 * 프로필의 출처는 지워지지 않는 스냅샷이고 조회 불가는 조회 원장에 산다.
 */
export async function getSortedCharacterInfo(ocids: readonly string[], now = new Date()): Promise<SortedCharacterInfo[]> {
  const [profiles, unavailableFlags] = await Promise.all([
    resolveDisplayProfiles(ocids),
    Promise.all(
      ocids.map((ocid) =>
        getScheduleProbeLedger(ocid, now)
          .then((ledger) => ledger.unavailable)
          .catch(() => false),
      ),
    ),
  ])
  return ocids
    .map((ocid, index) => {
      const profile = profiles.get(ocid)
      return {
        ocid,
        level: profile?.level ?? null,
        name: profile?.name ?? '',
        characterName: profile?.name ?? null,
        imageUrl: profile?.imageUrl ?? null,
        world: profile?.world ?? null,
        worldKey: profile?.worldKey ?? null,
        unavailable: unavailableFlags[index] === true,
      }
    })
    .sort((a, b) => {
      if (a.level === null && b.level === null) return compareByName(a.name, b.name)
      if (a.level === null) return 1
      if (b.level === null) return -1
      if (b.level !== a.level) return b.level - a.level
      return compareByName(a.name, b.name)
    })
    .map(({ ocid, imageUrl, world, worldKey, characterName, unavailable }) => ({
      ocid,
      imageUrl,
      world,
      worldKey,
      characterName,
      unavailable,
    }))
}

/** 그 달에서 주간 기록이 있는 주차들. 날짜를 모르는 월간 보스가 설 주를 이것이 고른다. 못 읽으면 빈 배열이다. */
async function loadWeeksWithRecords(ocids: readonly string[], monthKey: string): Promise<string[]> {
  return withSqliteFallback(getWeeklyPeriodKeysWithRecords([...ocids], monthKey), [])
}

/** 이번 주 기간 키의 달. 주차 목록을 읽을 범위다. 달 경계 주의 둘째 달은 읽을 필요가 없다. */
function currentWeekMonthKey(now: Date): string {
  return getCurrentBossProfitPeriod('weekly', now).periodKey.slice(0, 7)
}

/**
 * 월간 탭의 주차별 소계. 지난 주는 기록에서, 아직 안 온 주는 `upcoming`, 진행 중인 주는 이번 달을 볼 때만 `liveRows` 에서 더한다.
 * 한 주가 달 경계를 걸치면(7월 5주차 = 7/30~8/5) 다음 달에서는 그 주도 기록에서 더한다.
 *
 * @param trackedOcids 추적 목록. 여기 없는 캐릭터는 이 달에 기록이 있을 때만 카드를 갖고 앞으로의 주는 조회 불가다
 * @param outcomes 이번 로드에서 그 주를 채운 결과. 키는 `periodStateKey`
 */
export async function buildWeeklySubtotalsForMonth(
  ocids: readonly string[],
  trackedOcids: ReadonlySet<string>,
  monthPeriodKey: string,
  liveRows: readonly BossProfitRow[],
  knownProfiles: Map<string, CharacterProfileInfo>,
  now: Date,
  outcomes?: Map<string, PeriodQueryOutcome | null>,
): Promise<BossProfitWeeklySubtotal[]> {
  if (ocids.length === 0) return []

  const weekKeys = getWeeklyPeriodKeysInMonth(monthPeriodKey)
  const currentWeeklyPeriodKey = getCurrentBossProfitPeriod('weekly', now).periodKey
  const hasLiveSource = monthPeriodKey === getCurrentBossProfitPeriod('monthly', now).periodKey
  const pastWeekKeys = weekKeys.filter((key) => key < currentWeeklyPeriodKey)
  const recordWeekKeys =
    !hasLiveSource && weekKeys.includes(currentWeeklyPeriodKey) ? [...pastWeekKeys, currentWeeklyPeriodKey] : pastWeekKeys
  // 달 키를 함께 읽는 것은 이 캐릭터가 이 달에 뭔가 했나를 월간 보스 기록도 증명하기 때문이다. 금액은 안 담는다.
  const records = await withSqliteFallback(getBossProfitRecords([...ocids], [...recordWeekKeys, monthPeriodKey]), [])

  const [observedKeys, unqueryableKeys] = await Promise.all([
    loadObservedPeriodKeys(ocids, now),
    loadUnqueryablePeriodKeys(ocids, now),
  ])

  // 아이템 수익도 소계에 넣는다. 미완료 보스의 드롭은 돈으로 안 센다(주간 탭과 같은 규칙).
  const weekDrops = await withSqliteFallback(getBossDropRecords([...ocids], [...weekKeys, monthPeriodKey]), [])
  const unpaidRowKeys = new Set(
    liveRows.filter((row) => !row.isComplete).map((row) => dropRowKey(row.ocid, row.bossKey, row.difficulty, row.periodKey)),
  )
  const dropsByOcidWeek = new Map<string, RecordedDrop[]>()
  for (const record of weekDrops) {
    if (unpaidRowKeys.has(dropRowKey(record.ocid, record.bossKey, record.difficulty, record.periodKey))) continue
    // 월간 보스의 드롭은 그 보스 줄이 든다. 조회에는 들어 있는데(`hasMonthData` 가 본다) 여기서 거른다.
    if (record.periodKey === monthPeriodKey) continue
    const key = `${record.ocid}|${record.periodKey}`
    const list = dropsByOcidWeek.get(key) ?? []
    list.push(toRecordedDrop(record))
    dropsByOcidWeek.set(key, list)
  }

  const monthKeys = new Set([...weekKeys, monthPeriodKey])
  const liveOcids = new Set(liveRows.filter((row) => monthKeys.has(row.periodKey)).map((row) => row.ocid))
  const hasMonthData = (ocid: string): boolean =>
    liveOcids.has(ocid) || records.some((record) => record.ocid === ocid) || weekDrops.some((drop) => drop.ocid === ocid)

  const looked = await resolveDisplayProfiles(ocids.filter((ocid) => !knownProfiles.has(ocid)))

  const subtotals: BossProfitWeeklySubtotal[] = []
  for (const ocid of ocids) {
    if (!trackedOcids.has(ocid) && !hasMonthData(ocid)) continue
    const known = knownProfiles.get(ocid)
    const fallback = looked.get(ocid)
    const characterName = known?.characterName ?? fallback?.name ?? null
    const imageUrl = known?.imageUrl ?? fallback?.imageUrl ?? null
    if (characterName === null) continue
    const isTracked = trackedOcids.has(ocid)
    const characterSubtotals: BossProfitWeeklySubtotal[] = []

    for (const weekKey of weekKeys) {
      if (weekKey > currentWeeklyPeriodKey) {
        characterSubtotals.push({
          ocid,
          characterName,
          imageUrl,
          periodKey: weekKey,
          totalMeso: 0,
          drops: [],
          state: isTracked ? 'upcoming' : 'outOfRange',
        })
        continue
      }

      const matchingRecords = records.filter(
        (record) => record.ocid === ocid && record.cycle === 'weekly' && record.periodKey === weekKey,
      )
      const recordedMeso = matchingRecords.reduce((sum, record) => sum + record.payoutMeso, 0)
      const drops = dropsByOcidWeek.get(`${ocid}|${weekKey}`) ?? []

      if (weekKey === currentWeeklyPeriodKey) {
        const crystalMeso = hasLiveSource
          ? sumRowsPayout(
              liveRows.filter((row) => row.ocid === ocid && row.cycle === 'weekly' && row.periodKey === weekKey),
            )
          : recordedMeso
        const totalMeso = crystalMeso + sumDropPayout(drops)
        characterSubtotals.push({
          ocid,
          characterName,
          imageUrl,
          periodKey: weekKey,
          totalMeso,
          drops,
          // 추적을 끊어도 받아 둔 사실은 안 변한다. 금액이 있으면 기록으로 말하고 없을 때만 모른다고 말한다.
          state: isTracked ? 'inProgress' : totalMeso > 0 ? 'recorded' : 'outOfRange',
        })
        continue
      }

      characterSubtotals.push({
        ocid,
        characterName,
        imageUrl,
        periodKey: weekKey,
        totalMeso: recordedMeso + sumDropPayout(drops),
        drops,
        state: resolvePeriodDataState({
          isCurrentPeriod: false,
          hasRecords: matchingRecords.length > 0,
          isObserved: observedKeys.has(periodStateKey(ocid, 'weekly', weekKey)),
          isQueryable: isPeriodQueryable('weekly', weekKey, now),
          isProbedOutOfRange: unqueryableKeys.has(periodStateKey(ocid, 'weekly', weekKey)),
          lastOutcome: outcomes?.get(periodStateKey(ocid, 'weekly', weekKey)) ?? null,
        }),
      })
    }

    // 이전 달에 0 원이면 줄을 통째로 버린다. 카드는 이 줄들에서 생기므로 카드가 함께 사라진다.
    if (!hasLiveSource && characterSubtotals.every((subtotal) => subtotal.totalMeso === 0)) continue
    subtotals.push(...characterSubtotals)
  }
  return subtotals
}

/**
 * 지난 기간의 행을 기록만으로 만든다. 주간 기간이면 그 주가 품은 달의 월간 기록도 함께 읽는다. 월간 보스가 그 주에 서고,
 * 그 기록의 `period_key` 는 달이라 주 키로는 안 걸린다.
 */
async function buildRowsFromRecords(
  ocids: readonly string[],
  cycle: BossCycle,
  periodKey: string,
  now: Date,
  knownProfiles: Map<string, CharacterProfileInfo>,
): Promise<BossProfitRow[]> {
  if (ocids.length === 0) return []

  const monthKeys = cycle === 'weekly' ? monthsOfWeek(periodKey) : []
  const [allRecords, weekLists] = await Promise.all([
    withSqliteFallback(getBossProfitRecords([...ocids], [periodKey, ...monthKeys]), []),
    Promise.all(monthKeys.map((monthKey) => loadWeeksWithRecords(ocids, monthKey))),
  ])
  const weeksWithRecords = weekLists.flat()
  const records = allRecords.filter(
    (record) =>
      record.cycle === cycle ||
      (cycle === 'weekly' &&
        record.cycle === 'monthly' &&
        isMonthlyRowInWeek({
          weeklyPeriodKey: periodKey,
          monthlyPeriodKey: record.periodKey,
          isComplete: true,
          defeatedOn: record.defeatedOn ?? null,
          now,
          weeksWithRecords,
        })),
  )
  if (records.length === 0) return []

  const profileCache = new Map<string, CharacterProfileInfo | null>(knownProfiles)
  const looked = await resolveDisplayProfiles(
    records.filter((record) => !profileCache.has(record.ocid)).map((record) => record.ocid),
  )
  for (const [ocid, profile] of looked) {
    profileCache.set(ocid, { characterName: profile.name, imageUrl: profile.imageUrl, world: profile.world, worldKey: profile.worldKey })
  }

  const rows: BossProfitRow[] = []
  for (const record of records) {
    const profile = profileCache.get(record.ocid) ?? null
    if (profile === null) continue
    rows.push(buildRowFromRecord(record, profile, now))
  }
  return rows
}

/**
 * 행이 0개인 조회 불가 캐릭터를 카드 자리로 만든다. 주간 탭에서만이다. 월간 탭은 주차 소계의 추적 게이트가 세운다.
 * 이름을 모르면 안 세운다. 이름 없는 카드는 사용자에게 아무것도 말하지 않는다.
 */
function buildUnqueryableCards(
  tab: BossCycle,
  strandedOcids: readonly string[],
  rows: readonly BossProfitRow[],
  profiles: Map<string, CharacterProfileInfo>,
): CharacterCardStub[] {
  if (tab !== 'weekly') return []
  const drawn = new Set(rows.map((row) => row.ocid))
  return strandedOcids
    .filter((ocid) => !drawn.has(ocid))
    .map((ocid) => ({
      ocid,
      characterName: profiles.get(ocid)?.characterName ?? '',
      imageUrl: profiles.get(ocid)?.imageUrl ?? null,
    }))
    .filter((card) => card.characterName !== '')
}

export interface CurrentPeriodRows {
  /** 지금 주 · 지금 달의 모든 행. 기록과 합쳤고 기록만 있는 조합도 되살렸다. 정렬은 `sortedOcids` 순서다. */
  rows: BossProfitRow[]
  characterProfiles: Map<string, CharacterProfileInfo>
  /** 동기화가 한 번도 답하지 않았거나 조회 원장이 조회 불가로 아는 추적 캐릭터. */
  strandedOcids: string[]
  /** 이번 주가 품은 달에서 주간 기록이 있는 주차들. */
  weeksWithRecords: string[]
}

/**
 * 지금 기간의 행. 스케줄 캐시에서 완료 · 미완료 보스를 고르고 기록을 합친다.
 *
 * 캐시가 없는 캐릭터는 행이 없다. 기록이 있으면 `appendRecordOnlyRows` 가 그 기록을 행으로 되살린다.
 */
export async function buildCurrentPeriodRows(
  ocids: readonly string[],
  displayOcids: readonly string[],
  sortedCharacterInfo: readonly SortedCharacterInfo[],
  now: Date,
): Promise<CurrentPeriodRows> {
  const snapshot = readScheduleSnapshot()
  const [trackingMode, manualCompletedKeys] = await Promise.all([
    getTrackingMode(),
    readManualCompletedKeys(displayOcids, now),
  ])
  const mode = trackingMode ?? 'auto'
  const manualItemsByOcid = await readManualItems(ocids, mode)

  // 바탕은 지워지지 않는 스냅샷이다. 그 위를 스케줄 캐시의 이름이 덮는다. 이름의 출처가 갈리면 같은 캐릭터가 다르게 불린다.
  const characterProfiles = new Map<string, CharacterProfileInfo>(toProfileSnapshot([...sortedCharacterInfo]))
  const infoByOcid = new Map(sortedCharacterInfo.map((info) => [info.ocid, info]))
  const weeklyPeriodKey = getCurrentBossProfitPeriod('weekly', now).periodKey
  const rows: BossProfitRow[] = []

  for (const ocid of ocids) {
    const entry = snapshot.schedules.get(ocid)
    if (entry === undefined) continue
    const info = infoByOcid.get(ocid)
    const profile: CharacterProfileInfo = {
      characterName: entry.state.characterName,
      imageUrl: info?.imageUrl ?? null,
      world: info?.world ?? null,
      worldKey: info?.worldKey ?? null,
    }
    characterProfiles.set(ocid, profile)
    const bosses = selectProfitDisplayBosses(
      entry.state.bossContents,
      mode,
      manualItemsByOcid.get(ocid) ?? [],
      profile.worldKey,
      manualCompletedKeys.get(ocid),
      { periodKey: weeklyPeriodKey, now },
    )
    for (const boss of bosses) rows.push(buildBossProfitRow(ocid, profile, boss, now))
  }

  // 행에서 나온 기간에 지금 주 · 달을 더한다. 행이 없는 기간의 기록을 조회조차 안 하면 되살릴 재료가 없다.
  const periodKeys = [...new Set([...rows.map((row) => row.periodKey), ...currentPeriodKeys(now)])]
  const records: BossProfitRecord[] = await withSqliteFallback(getBossProfitRecords([...displayOcids], periodKeys), [])
  const sortedOcids = sortedCharacterInfo.map((info) => info.ocid)
  const merged = appendRecordOnlyRows(mergeRecordsIntoRows(rows, records), records, characterProfiles, now)

  const tracked = new Set(ocids)
  const stranded = new Set<string>([
    ...(snapshot.round?.stranded ?? []).map((one) => one.ocid),
    ...sortedCharacterInfo.filter((info) => info.unavailable && tracked.has(info.ocid)).map((info) => info.ocid),
  ])

  return {
    rows: sortRowsByOcidOrder(merged, sortedOcids),
    characterProfiles,
    strandedOcids: [...stranded],
    weeksWithRecords: await loadWeeksWithRecords(sortedOcids, currentWeekMonthKey(now)),
  }
}

/** 창 동기화가 있어야 답이 나오는 기간인가. 조회는 가능한데 관측도 조회 불가 표식도 하나 없을 때다. */
export function periodNeedsWindowSync(
  tab: BossCycle,
  periodKey: string,
  ocids: readonly string[],
  observedKeys: ReadonlySet<string>,
  unqueryableKeys: ReadonlySet<string>,
  now: Date,
): boolean {
  return (
    isPeriodQueryable(tab, periodKey, now) &&
    !ocids.some(
      (ocid) =>
        observedKeys.has(periodStateKey(ocid, tab, periodKey)) || unqueryableKeys.has(periodStateKey(ocid, tab, periodKey)),
    )
  )
}

export interface PeriodBuildInput {
  tab: BossCycle
  periodKey: string
  /** 추적 목록. 동기화 · 고아 정리의 대상이다. 그리는 것은 이보다 넓다(`resolveDisplayOcids`). */
  ocids: readonly string[]
  now: Date
  /** 창 동기화를 시작할 때. 화면이 이것으로 불러오는 중을 그린다. */
  onWindowSyncStart?: () => void
}

/**
 * 한 기간이 화면에 그려질 값 전부를 만든다.
 *
 * 지난 기간은 **여기서 조회하지 않는다.** 창이 진입할 때 이미 채웠다. 관측이 하나도 없는데 조회는 가능한 기간만 여기서
 * 창을 채우고 기다린다. 캐시를 지우고 진입하자마자 이동하면 창이 시작조차 안 한 순간이 있기 때문이다.
 */
export async function buildPeriodSnapshot(input: PeriodBuildInput): Promise<PeriodSnapshot> {
  const { tab, periodKey, ocids, now } = input
  const currentPeriodKey = getCurrentBossProfitPeriod(tab, now).periodKey
  const displayOcids = await resolveDisplayOcids(ocids)
  const sortedCharacterInfo = await getSortedCharacterInfo(displayOcids, now)
  const sortedOcids = sortedCharacterInfo.map((info) => info.ocid)
  const profileSnapshot = toProfileSnapshot(sortedCharacterInfo)

  if (periodKey === currentPeriodKey) {
    const current = await buildCurrentPeriodRows(ocids, displayOcids, sortedCharacterInfo, now)
    const tabRows = filterRowsForTab(current.rows, tab, periodKey, now, current.weeksWithRecords)
    // 캐시가 한 줄도 안 그린 캐릭터는 기록에서 만든다. 추적을 해제해도 이번 주에 이미 잡은 것이 사라지면 안 된다.
    const drawnOcids = new Set(tabRows.map((row) => row.ocid))
    const rows = sortRowsByOcidOrder(
      [
        ...tabRows,
        ...(await buildRowsFromRecords(
          displayOcids.filter((ocid) => !drawnOcids.has(ocid)),
          tab,
          periodKey,
          now,
          current.characterProfiles,
        )),
      ],
      sortedOcids,
    )
    const weeklySubtotals =
      tab === 'monthly'
        ? await buildWeeklySubtotalsForMonth(sortedOcids, new Set(ocids), periodKey, current.rows, current.characterProfiles, now)
        : []
    const [canGoPreviousPeriod, dropsByRowKey] = await Promise.all([
      canReachPreviousPeriod(tab, periodKey, displayOcids),
      loadDropsByRowKey(displayOcids, rows, now),
    ])
    return {
      rows,
      dropsByRowKey,
      weeklySubtotals,
      // 지금 기간은 실시간 동기화가 원천이라 집계를 기다리는 자리가 아니고 상태도 recorded · confirmedEmpty 뿐이다.
      periodPendingAggregation: false,
      periodState: resolvePeriodDataState({
        isCurrentPeriod: true,
        hasRecords: rows.length > 0,
        isObserved: false,
        isQueryable: false,
        isProbedOutOfRange: false,
        lastOutcome: null,
      }),
      canGoPreviousPeriod,
      unqueryableCards: buildUnqueryableCards(tab, current.strandedOcids, rows, current.characterProfiles),
    }
  }

  let observedKeys = await loadObservedPeriodKeys(ocids, now)
  let unqueryableKeys = await loadUnqueryablePeriodKeys(ocids, now)
  if (periodNeedsWindowSync(tab, periodKey, ocids, observedKeys, unqueryableKeys, now)) {
    input.onWindowSyncStart?.()
    await syncScheduleWindow([...ocids], now)
    observedKeys = await loadObservedPeriodKeys(ocids, now)
    unqueryableKeys = await loadUnqueryablePeriodKeys(ocids, now)
  }

  const outcomes = toPeriodOutcomes(getLastWindowFailures())
  const rows = sortRowsByOcidOrder(await buildRowsFromRecords(displayOcids, tab, periodKey, now, profileSnapshot), sortedOcids)
  const weeklySubtotals =
    tab === 'monthly'
      ? await buildWeeklySubtotalsForMonth(sortedOcids, new Set(ocids), periodKey, [], profileSnapshot, now, outcomes)
      : []

  // 지난 기간의 고아 드롭을 지운다. 과거 기간은 기록이 곧 사실이라 동기화 신선도를 따질 것이 없다. 정리 뒤에 읽어야
  // 지운 것이 화면 맵에 안 남는다. 정리에는 동기화 대상만 넘긴다.
  const [canGoPreviousPeriod, dropsByRowKey] = await Promise.all([
    canReachPreviousPeriod(tab, periodKey, displayOcids),
    sweepOrphanDrops({
      ocids: [...ocids],
      rows,
      trustedOcids: new Set(ocids),
      knownPeriodKeys: new Set([periodKey]),
      now,
    }).then(() => loadDropsByRowKey(displayOcids, rows, now)),
  ])

  const recordedOcids = new Set(rows.map((row) => row.ocid))
  const periodState = resolvePagePeriodState(
    ocids.map((ocid) =>
      resolvePeriodDataState({
        isCurrentPeriod: false,
        hasRecords: recordedOcids.has(ocid),
        isObserved: observedKeys.has(periodStateKey(ocid, tab, periodKey)),
        isQueryable: isPeriodQueryable(tab, periodKey, now),
        isProbedOutOfRange: unqueryableKeys.has(periodStateKey(ocid, tab, periodKey)),
        lastOutcome: outcomes.get(periodStateKey(ocid, tab, periodKey)) ?? null,
      }),
    ),
  )

  return {
    rows,
    dropsByRowKey,
    weeklySubtotals,
    periodState,
    periodPendingAggregation: ocids.some(
      (ocid) => outcomes.get(periodStateKey(ocid, tab, periodKey)) === 'notCollected',
    ),
    canGoPreviousPeriod,
    unqueryableCards: [],
  }
}
