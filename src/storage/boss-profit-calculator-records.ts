/**
 * 주간 보스 수익 계산기의 기록 목록. Preferences 의 JSON 한 칸.
 *
 * 저장은 서버 `boss_profit_calculator_record_bosses` 와 같은 칸이다. 보스는 난이도 줄 id, 분배는 분배 설정과 같은 칸 다섯이다.
 * 계산기는 보스 key · 비율 칸을 들어서, 그 사이를 여기서 바꾼다.
 *
 * 깨진 JSON 은 빈 목록으로 읽고, 모양이 틀린 기록은 그 기록만 버린다. 한 기록 때문에 목록 전체를
 * 잃으면 사용자가 남긴 기록이 한꺼번에 사라진다.
 */
import { bossDifficultyIdOf, bossDifficultyOfId } from '../lib/boss/bosses'
import { shareOfColumns, splitColumnsOf } from './boss-periods'
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'
import { whenRecordsReleased } from './record-hold'
import { enqueueChangedPreferenceRecords } from './server-sync-queue'
import type { CalculatorBoss } from '../lib/boss/boss-profit-calculator'

export interface BossProfitCalculatorCharacter {
  ocid: string
  bosses: CalculatorBoss[]
}

/** 기록 하나. 금액은 남기지 않는다. 열 때마다 지금 가격으로 다시 센다 */
export interface BossProfitCalculatorRecord {
  /** uuid(v4) */
  id: string
  /** 저장한 시각(ISO). 기록 제목이 이것이다 */
  savedAt: string
  characters: BossProfitCalculatorCharacter[]
}

/** 저장된 보스 한 줄. 계산기는 `제외` 를 받지 않아 분배 방식은 균등 · 비율뿐이다. */
export interface StoredCalculatorBoss {
  bossDifficultyId: string
  splitType: 'even' | 'ratio'
  partySize: number
  /** 내 몫. % 에 1000 을 곱한 정수. 균등이면 비어 있다 */
  splitShareMillipercent: number | null
  /** 등급을 따르면 비어 있다 */
  splitFeePercent: number | null
  splitFeeFollowsMvpGrade: boolean
}

export interface StoredCalculatorRecord {
  id: string
  savedAt: string
  characters: { ocid: string; bosses: StoredCalculatorBoss[] }[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNumberOrNull(value: unknown): boolean {
  return value === null || typeof value === 'number'
}

function isStoredBoss(value: unknown): value is StoredCalculatorBoss {
  return (
    isRecord(value) &&
    typeof value.bossDifficultyId === 'string' &&
    (value.splitType === 'even' || value.splitType === 'ratio') &&
    typeof value.partySize === 'number' &&
    Number.isInteger(value.partySize) &&
    value.partySize >= 1 &&
    isNumberOrNull(value.splitShareMillipercent) &&
    isNumberOrNull(value.splitFeePercent) &&
    typeof value.splitFeeFollowsMvpGrade === 'boolean'
  )
}

function isStoredCharacter(value: unknown): value is StoredCalculatorRecord['characters'][number] {
  return isRecord(value) && typeof value.ocid === 'string' && Array.isArray(value.bosses) && value.bosses.every(isStoredBoss)
}

function isStoredRecord(value: unknown): value is StoredCalculatorRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.savedAt === 'string' &&
    Array.isArray(value.characters) &&
    value.characters.every(isStoredCharacter)
  )
}

/** 저장된 보스를 계산기가 드는 모양으로. 게임 데이터에 없는 난이도 줄 id 면 `null` 이다. */
function toBoss(stored: StoredCalculatorBoss): CalculatorBoss | null {
  const owner = bossDifficultyOfId(stored.bossDifficultyId)
  const share = shareOfColumns(stored)
  if (owner === null || share === null) return null
  return {
    bossKey: owner.bossKey,
    difficulty: owner.difficulty,
    partySize: share.partySize,
    shares: {
      myShare: share.crystalMyShare,
      sharesTotal: share.crystalSharesTotal,
      splitFeePercent: share.splitFeePercent,
      splitFeeAuto: share.splitFeeAuto,
    },
  }
}

/**
 * 계산기의 보스를 저장하는 모양으로. 분배는 분배 설정과 같은 규칙이다. 게임 데이터에 없는 보스 · 난이도는 적을 수 없어 던진다.
 *
 * @param boss 계산기가 든 보스
 */
export function storedCalculatorBossOf(boss: CalculatorBoss): StoredCalculatorBoss {
  const bossDifficultyId = bossDifficultyIdOf(boss.bossKey, boss.difficulty)
  if (bossDifficultyId === null) throw new Error(`게임 데이터에 없는 보스 난이도다: ${boss.bossKey} ${boss.difficulty}`)
  const columns = splitColumnsOf(
    {
      partySize: boss.partySize,
      crystalMyShare: boss.shares.myShare,
      crystalSharesTotal: boss.shares.sharesTotal,
      splitFeePercent: boss.shares.splitFeePercent,
      splitFeeAuto: boss.shares.splitFeeAuto,
    },
    false,
  )
  return {
    bossDifficultyId,
    splitType: columns.splitType === 'ratio' ? 'ratio' : 'even',
    partySize: boss.partySize,
    splitShareMillipercent: columns.splitShareMillipercent,
    splitFeePercent: columns.splitFeePercent,
    splitFeeFollowsMvpGrade: columns.splitFeeFollowsMvpGrade,
  }
}

export async function getBossProfitCalculatorRecords(): Promise<BossProfitCalculatorRecord[]> {
  await whenRecordsReleased()
  const raw = await preferences.get(STORAGE_KEYS.bossProfitCalculatorRecords)
  if (raw === null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter(isStoredRecord).map((record) => ({
          id: record.id,
          savedAt: record.savedAt,
          characters: record.characters.map((character) => ({
            ocid: character.ocid,
            bosses: character.bosses.flatMap((boss) => toBoss(boss) ?? []),
          })),
        }))
      : []
  } catch {
    return []
  }
}

/** 기록마다 대기 줄 하나. 열쇠는 기록의 id 다. */
function recordsOf(stored: readonly unknown[]): Map<string, unknown> {
  return new Map(stored.flatMap((one) => (isRecord(one) && typeof one.id === 'string' ? [[one.id, one] as const] : [])))
}

/** 저장된 그대로의 목록. 없거나 깨졌으면 빈 목록이다. */
async function readStored(): Promise<unknown[]> {
  const raw = await preferences.get(STORAGE_KEYS.bossProfitCalculatorRecords)
  if (raw === null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** 더하거나 고치거나 지운 기록을 대기 표에 넣는다. */
export async function setBossProfitCalculatorRecords(records: readonly BossProfitCalculatorRecord[]): Promise<void> {
  await whenRecordsReleased()
  const before = await readStored()
  const stored: StoredCalculatorRecord[] = records.map((record) => ({
    id: record.id,
    savedAt: record.savedAt,
    characters: record.characters.map((character) => ({
      ocid: character.ocid,
      bosses: character.bosses.map(storedCalculatorBossOf),
    })),
  }))
  await preferences.set(STORAGE_KEYS.bossProfitCalculatorRecords, JSON.stringify(stored))
  await enqueueChangedPreferenceRecords('bossProfitCalculatorRecords', recordsOf(before), recordsOf(stored))
}

/**
 * 월드 리프한 캐릭터를 기록 속에서 새 ocid 로 바꾸는 함수. 새 캐릭터가 이미 든 기록에서는 옛 캐릭터 항목을 지운다. 기록을 열면
 * 추적 중인 캐릭터만 보이는데 목록 금액은 기록의 캐릭터를 모두 더해, 남겨 두면 두 금액이 갈린다.
 *
 * @param keepBoss 새 캐릭터로 넘길 보스 줄을 고르는 함수. 새 캐릭터가 잡을 수 없는 보스를 거른다
 */
export async function moveBossProfitCalculatorRecordsToOcid(
  fromOcid: string,
  toOcid: string,
  keepBoss: (boss: CalculatorBoss) => boolean,
): Promise<void> {
  const records = await getBossProfitCalculatorRecords()
  let changed = false
  const next = records.map((record) => {
    const ocids = record.characters.map((character) => character.ocid)
    if (!ocids.includes(fromOcid)) return record
    changed = true
    return {
      ...record,
      characters: ocids.includes(toOcid)
        ? record.characters.filter((character) => character.ocid !== fromOcid)
        : record.characters.map((character) =>
            character.ocid === fromOcid ? { ocid: toOcid, bosses: character.bosses.filter(keepBoss) } : character,
          ),
    }
  })
  if (changed) await setBossProfitCalculatorRecords(next)
}
