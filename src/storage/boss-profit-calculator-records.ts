/**
 * 주간 보스 수익 계산기의 기록 목록. Preferences 의 JSON 한 칸.
 *
 * 깨진 JSON 은 빈 목록으로 읽고, 모양이 틀린 기록은 그 기록만 버린다. 한 기록 때문에 목록 전체를
 * 잃으면 사용자가 남긴 기록이 한꺼번에 사라진다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isShareValue(value: unknown): boolean {
  return value === null || typeof value === 'number'
}

function isBoss(value: unknown): value is CalculatorBoss {
  return (
    isRecord(value) &&
    typeof value.bossKey === 'string' &&
    typeof value.difficulty === 'string' &&
    typeof value.partySize === 'number' &&
    Number.isInteger(value.partySize) &&
    value.partySize >= 1 &&
    isRecord(value.shares) &&
    isShareValue(value.shares.myShare) &&
    isShareValue(value.shares.sharesTotal) &&
    isShareValue(value.shares.splitFeePercent)
  )
}

function isCharacter(value: unknown): value is BossProfitCalculatorCharacter {
  return isRecord(value) && typeof value.ocid === 'string' && Array.isArray(value.bosses) && value.bosses.every(isBoss)
}

function isCalculatorRecord(value: unknown): value is BossProfitCalculatorRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.savedAt === 'string' &&
    Array.isArray(value.characters) &&
    value.characters.every(isCharacter)
  )
}

export async function getBossProfitCalculatorRecords(): Promise<BossProfitCalculatorRecord[]> {
  const raw = await preferences.get(STORAGE_KEYS.bossProfitCalculatorRecords)
  if (raw === null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isCalculatorRecord) : []
  } catch {
    return []
  }
}

export async function setBossProfitCalculatorRecords(records: readonly BossProfitCalculatorRecord[]): Promise<void> {
  await preferences.set(STORAGE_KEYS.bossProfitCalculatorRecords, JSON.stringify(records))
}
