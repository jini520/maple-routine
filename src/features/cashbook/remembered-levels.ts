/**
 * 심볼 · 헥사 코어의 강화 레벨 기억. 심볼 강화 · 헥사 스킬 폼의 강화 전 칸이 이 값으로 선다.
 *
 * 처음 값은 추적을 시작할 때 넥슨에서 받는다. 그 뒤로는 사용자가 저장한 기록이 옮기고, 넥슨 값으로 덮지 않는다.
 * 사용자가 친 값을 믿기 때문이다. 화면은 `nexon/` 도 `storage/` 도 직접 안 부른다.
 */
import { hexaLevelsOf } from '../../lib/cashbook/hexa-matrix'
import { symbolLevelsOf } from '../../lib/cashbook/symbol-costs'
import { fetchHexaMatrix } from '../../nexon/hexamatrix'
import { fetchSymbolEquipment } from '../../nexon/symbol-levels'
import {
  getRememberedLevels,
  hasRememberedLevels,
  rememberLevels,
  type RememberedLevelKind,
} from '../../storage/remembered-levels'
import { getLatestSpendFor, type SpendRecord } from '../../storage/spend'
import { currentCredential } from '../auth/current-credential'

/** 넥슨에서 그 갈래의 레벨을 받는다. 키가 없거나 실패하면 `null` 이고 던지지 않는다. */
async function fetchLevels(ocid: string, kind: RememberedLevelKind): Promise<Record<string, number> | null> {
  const credential = await currentCredential()
  // 키가 없으면 부르지도 않는다. 401 을 만들면 그 사슬이 저장된 키를 지운다.
  if (credential === null) return null
  try {
    return kind === 'symbol'
      ? symbolLevelsOf(await fetchSymbolEquipment(credential, ocid))
      : hexaLevelsOf(await fetchHexaMatrix(credential, ocid))
  } catch {
    return null
  }
}

async function fill(ocid: string, kind: RememberedLevelKind): Promise<void> {
  const levels = await fetchLevels(ocid, kind)
  if (levels !== null) await rememberLevels(ocid, kind, levels, 'fill')
}

/**
 * 추적을 시작한 캐릭터의 처음 레벨. 기억이 하나라도 있는 캐릭터는 건너뛴다. 추적을 해제했다 다시 고른 캐릭터의
 * 기억은 사용자가 쌓은 값이라서다. 추적 저장의 곁가지라 던지지 않는다.
 */
export async function seedRememberedLevels(ocids: readonly string[]): Promise<void> {
  await Promise.all(
    ocids.map(async (ocid) => {
      try {
        if (await hasRememberedLevels(ocid)) return
        await Promise.all([fill(ocid, 'symbol'), fill(ocid, 'hexa')])
      } catch {
        // 다음에 폼을 열 때 비어 있으면 그때 채운다.
      }
    }),
  )
}

/**
 * 폼이 쓰는 기억. 폼에서는 넥슨을 부르지 않는다. 예외는 그 갈래의 기억이 비어 있을 때 하나이고, 그때 한 번 받아 채운다.
 * 추적을 시작할 때 받기가 실패했거나 이 기능 전부터 추적하던 캐릭터가 그렇다.
 */
export async function loadRememberedLevels(ocid: string, kind: RememberedLevelKind): Promise<Record<string, number>> {
  try {
    const remembered = await getRememberedLevels(ocid, kind)
    if (Object.keys(remembered).length > 0) return remembered
    await fill(ocid, kind)
    return await getRememberedLevels(ocid, kind)
  } catch {
    return {}
  }
}

/** 기억을 옮기는 기록인가. 캐릭터가 있는 심볼 강화와 헥사 스킬이다. 헥사 스탯은 레벨이 없다. */
function targetOf(record: SpendRecord): { ocid: string; kind: RememberedLevelKind; itemKey: string } | null {
  if (record.ocid === null || record.itemKey === null || record.levelFrom === null || record.levelTo === null) return null
  if (record.category === 'symbol') return { ocid: record.ocid, kind: 'symbol', itemKey: record.itemKey }
  if (record.category === 'hexa_matrix' && record.hexa?.activation == null) {
    return { ocid: record.ocid, kind: 'hexa', itemKey: record.itemKey.trim() }
  }
  return null
}

async function overwrite(record: SpendRecord, level: 'levelFrom' | 'levelTo'): Promise<void> {
  const target = targetOf(record)
  const value = record[level]
  if (target === null || value === null) return
  await rememberLevels(target.ocid, target.kind, { [target.itemKey]: value }, 'overwrite')
}

/** 저장한 기록의 강화 후 레벨이 기억이 된다. */
export async function rememberAfterSave(record: SpendRecord): Promise<void> {
  await overwrite(record, 'levelTo')
}

/** 그 대상의 가장 최근 기록 id. 지우기 전에 읽어 두고 `rememberAfterRemove` 에 넘긴다. */
export async function latestLevelRecordId(record: SpendRecord): Promise<string | null> {
  const target = targetOf(record)
  if (target === null) return null
  return (await getLatestSpendFor(target.ocid, record.category, record.itemKey!))?.id ?? null
}

/** 고친 기록이 그 대상의 가장 최근 기록이면 기억이 고친 강화 후 레벨로 바뀐다. 더 옛 기록이면 그대로다. */
export async function rememberAfterEdit(record: SpendRecord): Promise<void> {
  if ((await latestLevelRecordId(record)) === record.id) await overwrite(record, 'levelTo')
}

/**
 * 지운 기록이 가장 최근 기록이었으면 기억이 그 기록의 강화 전 레벨로 돌아간다. 더 옛 기록이면 그 뒤 기록이 이미
 * 레벨을 옮겨서 그대로 둔다.
 *
 * @param latestIdBeforeRemove 지우기 전에 `latestLevelRecordId` 로 읽은 값
 */
export async function rememberAfterRemove(record: SpendRecord, latestIdBeforeRemove: string | null): Promise<void> {
  if (latestIdBeforeRemove === record.id) await overwrite(record, 'levelFrom')
}
