import { difficultyKeyOfName } from '../constants/domain/boss-difficulty'
import { bossKeyOfApiName } from '../lib/boss/bosses'
import { preferences } from './ports'
import { manualTrackedContentKey } from './keys'
import { contentKeyOfApiName, contentSectionOf } from '../lib/scheduler/contents'
import type { ManualTrackedBossItem, ManualTrackedItem } from '../types/scheduler'

// 타입 선언은 `src/types/scheduler` 에 있다(병합 순수 함수들이 core 에 있어서다. 그쪽 주석 참고).
// 이 모듈에서 계속 export 하므로 `storage/manual-tracked-content` 를 쓰던 import 는 그대로다.
export type { ManualTrackedItem }

// 옛 모양 셋이 섞여 있다. 컨텐츠가 일간·주간 구분 없이 `kind: 'content'` 로 저장되던 시절, 컨텐츠가 key 대신
// `contentName` 에 이름을 들던 시절, 보스가 `contentName` 에 보스 이름 · `difficulty` 에 한글 난이도를 들던 시절이다.
type StoredManualTrackedItem = {
  kind: ManualTrackedItem['kind'] | 'content'
  contentName?: string
  contentKey?: string
  bossKey?: string
  difficulty?: string
  maxCount?: number
}

/**
 * 보스 항목을 보스 key 모양으로. 이미 key 모양이면 그대로다. 옛 모양은 이름으로 보스 key 를 찾고 한글
 * 난이도를 key 로 바꾼다. 못 찾으면 `null` 이고 그 항목은 빠진다. 보스 표에 없는 보스는 추적할 key 가 없다.
 */
function migrateBossItem(item: StoredManualTrackedItem): ManualTrackedItem | null {
  if (item.bossKey !== undefined) {
    return { kind: 'boss', bossKey: item.bossKey, difficulty: item.difficulty as ManualTrackedBossItem['difficulty'] }
  }
  const bossKey = item.contentName === undefined ? null : bossKeyOfApiName(item.contentName)
  const difficulty = item.difficulty === undefined ? null : difficultyKeyOfName(item.difficulty)
  return bossKey === null || difficulty === null ? null : { kind: 'boss', bossKey, difficulty }
}

/**
 * 컨텐츠 항목을 컨텐츠 key 모양으로. 이미 key 모양이면 그대로다. 옛 모양은 이름으로 key 를 찾고, 레거시
 * `content` 는 그 key 의 섹션으로 일간 · 주간을 정한다. 못 찾으면 `null` 이고 그 항목은 빠진다.
 *
 * 컨텐츠 표에 없는 컨텐츠는 애초에 추가 대상이 아니고, 관리 페이지 체크리스트가 표 기반이라 표 밖 항목은
 * 편집할 수 없는 고아가 된다.
 */
function migrateContentItem(item: StoredManualTrackedItem): ManualTrackedItem | null {
  const contentKey = item.contentKey ?? (item.contentName === undefined ? null : contentKeyOfApiName(item.contentName))
  const kind = item.kind === 'content' ? contentSectionOf(contentKey) : item.kind
  if (contentKey === null || (kind !== 'daily' && kind !== 'weekly')) return null
  return item.maxCount === undefined ? { contentKey, kind } : { contentKey, kind, maxCount: item.maxCount }
}

// 옛 모양은 읽을 때 옮긴다. 다음 저장이 새 모양으로 덮어쓴다.
function migrateLegacyKinds(items: StoredManualTrackedItem[]): ManualTrackedItem[] {
  const migrated: ManualTrackedItem[] = []
  for (const item of items) {
    if (item.kind === 'boss') {
      const boss = migrateBossItem(item)
      if (boss !== null) migrated.push(boss)
      continue
    }
    const content = migrateContentItem(item)
    if (content !== null) migrated.push(content)
  }
  return migrated
}

// 저장된 값이 없거나 손상된 JSON이면 빈 배열을 반환한다.
export async function getManualTrackedContent(ocid: string): Promise<ManualTrackedItem[]> {
  const value = await preferences.get(manualTrackedContentKey(ocid))
  if (value === null) {
    return []
  }

  try {
    return migrateLegacyKinds(JSON.parse(value) as StoredManualTrackedItem[])
  } catch {
    return []
  }
}

// 배열 전체를 덮어쓴다. 부분 추가/삭제는 호출부가 배열을 계산해서 넘긴다(setTrackedCharacterOcids와 동일한 패턴).
export async function setManualTrackedContent(
  ocid: string,
  items: ManualTrackedItem[],
): Promise<void> {
  await preferences.set(manualTrackedContentKey(ocid), JSON.stringify(items))
}
