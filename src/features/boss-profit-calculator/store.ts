/**
 * 주간 보스 수익 계산기의 상태. 캐릭터마다 고른 보스와 기록 목록을 든다.
 *
 * 보스 관리 값으로 시작하지만 여기서 고친 값은 보스 관리에 쓰지 않는다. 따져 보려고 만진 값이 실제 기록의 파티 설정을
 * 흔들면 안 되기 때문이다.
 */
import { create } from 'zustand'

import { keepTopByPayout, sortByReferenceOrder, type CalculatorBoss } from '../../lib/boss/boss-profit-calculator'
import { randomUuid } from '../../native/uuid'
import {
  getBossProfitCalculatorRecords,
  setBossProfitCalculatorRecords,
  type BossProfitCalculatorRecord,
} from '../../storage/boss-profit-calculator-records'
import { displayedBosses } from '../boss-scheduler/displayed-bosses'
import { partySizeKey, useBossSchedulerStore } from '../boss-scheduler/store'
import { useTrackingModeStore } from '../tracking-mode/store'

/** 저장 버튼의 두 갈래. 연 기록이 없으면 늘 `new` 다 */
export type CalculatorSaveMode = 'overwrite' | 'new'

interface BossProfitCalculatorState {
  /** 저장소를 한 번이라도 읽었나. 읽기 전의 빈 값을 `보스 없음` 으로 그리지 않게 */
  loaded: boolean
  /** 저장 시각이 늦은 것부터 */
  records: BossProfitCalculatorRecord[]
  /** 지금 계산기에 띄운 기록. 저장할 때 덮을지 물을지 가른다 */
  openedId: string | null
  bossesByOcid: Record<string, CalculatorBoss[]>
  /** 계산기를 열 때. 가장 최근 기록으로 채우고, 기록이 없으면 보스 관리 값이다 */
  open: (now: Date) => Promise<void>
  openRecord: (id: string, now: Date) => void
  deleteRecord: (id: string) => Promise<void>
  save: (mode: CalculatorSaveMode, now: Date) => Promise<void>
  importFromBossManage: (ocid: string, now: Date) => void
  clearCharacter: (ocid: string) => void
  /** 보스 선택의 `적용`. 고른 순서와 상관없이 보스 표 순서로 놓는다 */
  setBosses: (ocid: string, bosses: readonly CalculatorBoss[]) => void
  updateBoss: (ocid: string, bossKey: string, patch: Partial<Omit<CalculatorBoss, 'bossKey'>>) => void
}

/** 보스 관리에 등록된 이 캐릭터의 주간 보스 · 난이도 · 파티 설정. 12개가 넘으면 몫이 큰 12개만 남긴다 */
function bossesFromBossManage(ocid: string, now: Date): CalculatorBoss[] {
  const scheduler = useBossSchedulerStore.getState()
  const character = scheduler.characters.find((one) => one.ocid === ocid)
  if (character === undefined) return []
  const { mode } = useTrackingModeStore.getState()
  const seen = new Set<string>()
  const bosses: CalculatorBoss[] = []
  for (const boss of displayedBosses(character, 'weekly', mode, scheduler.manualTrackedByOcid, null, now)) {
    // 계산기는 보스 하나에 난이도 하나다. 자동 모드는 등록 난이도가 없으면 처치한 난이도를 여럿 보일 수 있다.
    if (boss.bossKey === null || seen.has(boss.bossKey)) continue
    seen.add(boss.bossKey)
    const key = partySizeKey(ocid, boss.bossKey, boss.difficulty)
    const columns = scheduler.partyShares[key]
    bosses.push({
      bossKey: boss.bossKey,
      difficulty: boss.difficulty,
      partySize: scheduler.partySizes[key] ?? 1,
      shares: {
        myShare: columns?.crystalMyShare ?? null,
        sharesTotal: columns?.crystalSharesTotal ?? null,
        splitFeePercent: columns?.splitFeePercent ?? null,
      },
    })
  }
  return keepTopByPayout(bosses, now)
}

/** 기록에 있는 캐릭터는 기록 값, 기록 뒤에 추적을 시작한 캐릭터는 보스 관리 값 */
function bossesOfRecord(record: BossProfitCalculatorRecord | undefined, now: Date): Record<string, CalculatorBoss[]> {
  const byOcid: Record<string, CalculatorBoss[]> = {}
  for (const character of useBossSchedulerStore.getState().characters) {
    const saved = record?.characters.find((one) => one.ocid === character.ocid)
    byOcid[character.ocid] = saved === undefined ? bossesFromBossManage(character.ocid, now) : saved.bosses
  }
  return byOcid
}

function newestFirst(records: readonly BossProfitCalculatorRecord[]): BossProfitCalculatorRecord[] {
  return [...records].sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export const useBossProfitCalculatorStore = create<BossProfitCalculatorState>()((set, get) => ({
  loaded: false,
  records: [],
  openedId: null,
  bossesByOcid: {},

  async open(now) {
    const records = newestFirst(await getBossProfitCalculatorRecords())
    const latest = records[0]
    set({ loaded: true, records, openedId: latest?.id ?? null, bossesByOcid: bossesOfRecord(latest, now) })
  },

  openRecord(id, now) {
    const record = get().records.find((one) => one.id === id)
    if (record === undefined) return
    set({ openedId: id, bossesByOcid: bossesOfRecord(record, now) })
  },

  async deleteRecord(id) {
    const records = get().records.filter((one) => one.id !== id)
    // 저장이 먼저다. 저장이 실패했는데 목록만 바뀌면 다시 열었을 때 지운 기록이 돌아온다.
    await setBossProfitCalculatorRecords(records)
    set((state) => ({ records, openedId: state.openedId === id ? null : state.openedId }))
  },

  async save(mode, now) {
    const { openedId, records, bossesByOcid } = get()
    const id = mode === 'overwrite' && openedId !== null ? openedId : randomUuid()
    const record: BossProfitCalculatorRecord = {
      id,
      savedAt: now.toISOString(),
      characters: Object.entries(bossesByOcid).map(([ocid, bosses]) => ({ ocid, bosses })),
    }
    const next = newestFirst([record, ...records.filter((one) => one.id !== id)])
    await setBossProfitCalculatorRecords(next)
    set({ records: next, openedId: id })
  },

  importFromBossManage(ocid, now) {
    set((state) => ({ bossesByOcid: { ...state.bossesByOcid, [ocid]: bossesFromBossManage(ocid, now) } }))
  },

  clearCharacter(ocid) {
    set((state) => ({ bossesByOcid: { ...state.bossesByOcid, [ocid]: [] } }))
  },

  setBosses(ocid, bosses) {
    set((state) => ({ bossesByOcid: { ...state.bossesByOcid, [ocid]: sortByReferenceOrder(bosses) } }))
  },

  updateBoss(ocid, bossKey, patch) {
    set((state) => ({
      bossesByOcid: {
        ...state.bossesByOcid,
        [ocid]: (state.bossesByOcid[ocid] ?? []).map((one) => (one.bossKey === bossKey ? { ...one, ...patch } : one)),
      },
    }))
  },
}))
