import { preferences } from './ports'
import { manualTrackedContentKey } from './keys'
import { TEMPLATE_DAILY_NAMES, TEMPLATE_WEEKLY_NAMES } from '../lib/scheduler/scheduler-content-template'
import type { ManualTrackedItem } from '../types/scheduler'

// 타입 선언은 `src/types/scheduler` 에 있다(병합 순수 함수들이 core 에 있어서다. 그쪽 주석 참고).
// 이 모듈에서 계속 export 하므로 `storage/manual-tracked-content` 를 쓰던 import 는 그대로다.
export type { ManualTrackedItem }

// 결정 19 이전에는 컨텐츠가 일간/주간 구분 없이 kind: 'content'로 저장됐다.
type StoredManualTrackedItem = Omit<ManualTrackedItem, 'kind'> & {
  kind: ManualTrackedItem['kind'] | 'content'
}

// 레거시 'content' 항목은 읽기 시점에 템플릿 조회로 재분류하고, 템플릿에 없으면 제외한다 —
// "템플릿에 없는 콘텐츠는 애초에 추가 대상이 아니다"(결정 11)의 일관 적용이고, 관리 페이지
// 체크리스트(결정 18)가 템플릿 기반이라 템플릿 밖 항목은 편집 불가능한 고아가 되기 때문.
function migrateLegacyKinds(items: StoredManualTrackedItem[]): ManualTrackedItem[] {
  const migrated: ManualTrackedItem[] = []
  for (const item of items) {
    if (item.kind !== 'content') {
      migrated.push(item as ManualTrackedItem)
      continue
    }
    if (TEMPLATE_DAILY_NAMES.has(item.contentName)) {
      migrated.push({ ...item, kind: 'daily' })
    } else if (TEMPLATE_WEEKLY_NAMES.has(item.contentName)) {
      migrated.push({ ...item, kind: 'weekly' })
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
