import { difficultyKeyOfName } from '../constants/domain/boss-difficulty'
import { bossKeyOfApiName } from '../lib/boss/bosses'
import { preferences } from './ports'
import { manualTrackedContentKey } from './keys'
import { TEMPLATE_DAILY_NAMES, TEMPLATE_WEEKLY_NAMES } from '../lib/scheduler/scheduler-content-template'
import type { ManualTrackedBossItem, ManualTrackedItem } from '../types/scheduler'

// 타입 선언은 `src/types/scheduler` 에 있다(병합 순수 함수들이 core 에 있어서다. 그쪽 주석 참고).
// 이 모듈에서 계속 export 하므로 `storage/manual-tracked-content` 를 쓰던 import 는 그대로다.
export type { ManualTrackedItem }

// 옛 모양 둘이 섞여 있다. 컨텐츠가 일간·주간 구분 없이 `kind: 'content'` 로 저장되던 시절이 있고,
// 보스가 key 대신 `contentName` 에 보스 이름 · `difficulty` 에 한글 난이도를 들던 시절이 있다.
type StoredManualTrackedItem = {
  kind: ManualTrackedItem['kind'] | 'content'
  contentName?: string
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

// 레거시 `content` 항목은 읽기 시점에 템플릿 조회로 재분류하고 템플릿에 없으면 제외한다.
// 템플릿에 없는 콘텐츠는 애초에 추가 대상이 아니고, 관리 페이지 체크리스트가 템플릿 기반이라
// 템플릿 밖 항목은 편집 불가능한 고아가 된다.
function migrateLegacyKinds(items: StoredManualTrackedItem[]): ManualTrackedItem[] {
  const migrated: ManualTrackedItem[] = []
  for (const item of items) {
    if (item.kind === 'boss') {
      const boss = migrateBossItem(item)
      if (boss !== null) migrated.push(boss)
      continue
    }
    if (item.kind !== 'content') {
      migrated.push(item as ManualTrackedItem)
      continue
    }
    const contentName = item.contentName ?? ''
    if (TEMPLATE_DAILY_NAMES.has(contentName)) {
      migrated.push({ contentName, kind: 'daily', maxCount: item.maxCount })
    } else if (TEMPLATE_WEEKLY_NAMES.has(contentName)) {
      migrated.push({ contentName, kind: 'weekly', maxCount: item.maxCount })
    }
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
