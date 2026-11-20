/**
 * 보내는 캐릭터별 마지막 `주간 보스 수입 이전`. 새 기록의 폼에서 보내는 캐릭터를 고르면 그 몫의 받는 캐릭터 · 수수료 · 체크가 선다.
 *
 * 다음 입력의 기본값일 뿐이고 지난 기록에 소급하지 않는다. **모양만** 본다. 받는 캐릭터가 지금 목록에 있는지는 세우는 쪽이 판정한다.
 */
import type { FeePercent } from '../lib/cashbook/item-split'
import { preferences } from './ports'
import { STORAGE_KEYS } from './keys'

export interface LastBossIncomeTransfer {
  receiverOcid: string
  feeAuto: boolean
  /** `자동` 을 끄고 고른 요율. `null` 은 `없음` 이거나 자동이다. */
  feePercent: FeePercent | null
  /** `이번주 보스 수입 옮기기` 체크. */
  fillsWeek: boolean
}

/** 보내는 ocid → 그 캐릭터의 마지막 수입 이전. */
export type LastBossIncomeTransfers = Readonly<Record<string, LastBossIncomeTransfer>>

function transferOf(value: unknown): LastBossIncomeTransfer | null {
  if (typeof value !== 'object' || value === null) return null
  const { receiverOcid, feeAuto, feePercent, fillsWeek } = value as Record<string, unknown>
  if (typeof receiverOcid !== 'string' || receiverOcid === '') return null
  if (typeof feeAuto !== 'boolean' || typeof fillsWeek !== 'boolean') return null
  if (feePercent !== null && feePercent !== 3 && feePercent !== 5) return null
  return { receiverOcid, feeAuto, feePercent, fillsWeek }
}

/** 모양이 틀린 몫은 그 몫만 뺀다. 한 몫 때문에 다른 캐릭터의 기억까지 버리지 않는다. */
function parse(raw: string): Record<string, LastBossIncomeTransfer> {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
    const transfers: Record<string, LastBossIncomeTransfer> = {}
    for (const [ocid, each] of Object.entries(value)) {
      const transfer = transferOf(each)
      if (transfer !== null) transfers[ocid] = transfer
    }
    return transfers
  } catch {
    return {}
  }
}

export async function getLastBossIncomeTransfers(): Promise<LastBossIncomeTransfers> {
  const raw = await preferences.get(STORAGE_KEYS.lastBossIncomeTransfers)
  return raw === null ? {} : parse(raw)
}

export async function setLastBossIncomeTransfer(senderOcid: string, transfer: LastBossIncomeTransfer): Promise<void> {
  const current = await getLastBossIncomeTransfers()
  await preferences.set(STORAGE_KEYS.lastBossIncomeTransfers, JSON.stringify({ ...current, [senderOcid]: transfer }))
}

/**
 * 월드 리프한 캐릭터의 몫과, 다른 몫의 받는 캐릭터를 새 ocid 로 옮기는 함수. 새 캐릭터 몫이 있으면 리프 뒤의 그 몫을 둔다.
 */
export async function moveLastBossIncomeTransfersToOcid(fromOcid: string, toOcid: string): Promise<void> {
  const current = await getLastBossIncomeTransfers()
  let changed = false
  const moved: Record<string, LastBossIncomeTransfer> = {}
  for (const [ocid, transfer] of Object.entries(current)) {
    const receiverOcid = transfer.receiverOcid === fromOcid ? toOcid : transfer.receiverOcid
    if (receiverOcid !== transfer.receiverOcid) changed = true
    if (ocid === fromOcid) {
      changed = true
      if (current[toOcid] !== undefined) continue
      moved[toOcid] = { ...transfer, receiverOcid }
      continue
    }
    moved[ocid] = { ...transfer, receiverOcid }
  }
  if (changed) await preferences.set(STORAGE_KEYS.lastBossIncomeTransfers, JSON.stringify(moved))
}
