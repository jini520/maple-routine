/**
 * 수동 트래킹 모드의 캐릭터별 추적 항목. Preferences 의 JSON 한 칸(`manualTrackedContent:{ocid}`).
 *
 * 저장은 서버 `manual_tracked_items` 와 같은 칸(`type` · `targetId`)이다. 대상은 줄 id 이고, 일간 · 주간은 컨텐츠 줄, 보스는 난이도
 * 줄이다. 화면과 병합은 컨텐츠 key · 보스 key 를 들어서, 그 사이를 여기서 바꾼다.
 */
import { bossDifficultyIdOf, bossDifficultyOfId } from '../lib/boss/bosses'
import { contentIdOf, contentKeyOfId } from '../lib/scheduler/contents'
import { preferences } from './ports'
import { manualTrackedContentKey } from './keys'
import { whenRecordsReleased } from './record-hold'
import type { ManualTrackedItem } from '../types/scheduler'

// 타입 선언은 `src/types/scheduler` 에 있다(병합 순수 함수들이 core 에 있어서다. 그쪽 주석 참고).
// 이 모듈에서 계속 export 하므로 `storage/manual-tracked-content` 를 쓰던 import 는 그대로다.
export type { ManualTrackedItem }

/** 저장된 항목 하나. */
export interface StoredManualTrackedItem {
  type: ManualTrackedItem['kind']
  targetId: string
}

/** 저장된 항목을 화면이 드는 모양으로. 게임 데이터에 없는 줄 id 면 `null` 이고 그 항목은 빠진다. */
function toItem(stored: StoredManualTrackedItem): ManualTrackedItem | null {
  if (stored.type === 'boss') {
    const boss = bossDifficultyOfId(stored.targetId)
    return boss === null ? null : { kind: 'boss', bossKey: boss.bossKey, difficulty: boss.difficulty }
  }
  if (stored.type !== 'daily' && stored.type !== 'weekly') return null
  const contentKey = contentKeyOfId(stored.targetId)
  return contentKey === null ? null : { contentKey, kind: stored.type }
}

/** 항목이 가리키는 줄 id. 일간 · 주간은 컨텐츠 줄, 보스는 난이도 줄이다. 게임 데이터에 없으면 `null` 이다. */
export function manualTrackedTargetIdOf(item: ManualTrackedItem): string | null {
  return item.kind === 'boss' ? bossDifficultyIdOf(item.bossKey, item.difficulty) : contentIdOf(item.contentKey)
}

/** 항목을 저장하는 모양으로. 게임 데이터에 없는 key 면 던진다. 대상 칸을 비울 수 없다. */
function storedManualTrackedItemOf(item: ManualTrackedItem): StoredManualTrackedItem {
  const targetId = manualTrackedTargetIdOf(item)
  if (targetId === null) {
    throw new Error(`게임 데이터에 없는 추적 항목이다: ${item.kind === 'boss' ? `${item.bossKey} ${item.difficulty}` : item.contentKey}`)
  }
  return { type: item.kind, targetId }
}

function isStoredItem(value: unknown): value is StoredManualTrackedItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as StoredManualTrackedItem).type === 'string' &&
    typeof (value as StoredManualTrackedItem).targetId === 'string'
  )
}

// 저장된 값이 없거나 손상된 JSON이면 빈 배열을 반환한다.
export async function getManualTrackedContent(ocid: string): Promise<ManualTrackedItem[]> {
  await whenRecordsReleased()
  const value = await preferences.get(manualTrackedContentKey(ocid))
  if (value === null) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.flatMap((stored) => (isStoredItem(stored) ? (toItem(stored) ?? []) : [])) : []
  } catch {
    return []
  }
}

// 배열 전체를 덮어쓴다. 부분 추가/삭제는 호출부가 배열을 계산해서 넘긴다(setTrackedCharacterOcids와 동일한 패턴).
export async function setManualTrackedContent(
  ocid: string,
  items: ManualTrackedItem[],
): Promise<void> {
  await whenRecordsReleased()
  await preferences.set(manualTrackedContentKey(ocid), JSON.stringify(items.map(storedManualTrackedItemOf)))
}

/** 월드 리프한 캐릭터의 목록을 새 ocid 로 옮기는 함수. 새 캐릭터에 목록이 있으면 리프 뒤에 고른 그 목록을 둔다. */
export async function moveManualTrackedContentToOcid(fromOcid: string, toOcid: string): Promise<void> {
  await whenRecordsReleased()
  const value = await preferences.get(manualTrackedContentKey(fromOcid))
  if (value === null) return
  if ((await preferences.get(manualTrackedContentKey(toOcid))) === null) {
    await preferences.set(manualTrackedContentKey(toOcid), value)
  }
  await preferences.remove(manualTrackedContentKey(fromOcid))
}
