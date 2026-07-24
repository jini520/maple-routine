import { Preferences } from '@capacitor/preferences'
import { manualTrackedContentKey } from './keys'
import { TEMPLATE_DAILY_NAMES, TEMPLATE_WEEKLY_NAMES } from '../lib/scheduler-content-template'

// ADR-035 결정 6: 멤버십(+사용자 입력 max_count)만 저장한다 — nowCount/questState/isComplete 같은
// 동기화 유래 값은 절대 여기 두지 않고, 표시 시점에 schedulerCache에서 조회한다(단일 진실 공급원).
// ADR-035 결정 19: 컨텐츠는 일간/주간 탭 표시 구분을 저장 시점에 확정하기 위해 kind를
// 'daily' | 'weekly'로 세분한다(표시 시점 추론 없음).
export interface ManualTrackedItem {
  contentName: string
  kind: 'daily' | 'weekly' | 'boss'
  difficulty?: string // kind: 'boss'일 때만 사용(보스명만으로는 유일하지 않음)
  maxCount?: number // 컨텐츠이고 카운트형일 때만. 템플릿(scheduler-content-template.json)의 확정값을 복사해 저장(ADR-035 결정 7)
}

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
  const { value } = await Preferences.get({ key: manualTrackedContentKey(ocid) })
  if (value === null) {
    return []
  }

  try {
    return migrateLegacyKinds(JSON.parse(value) as StoredManualTrackedItem[])
  } catch {
    return []
  }
}

// 배열 전체를 덮어쓴다 — 부분 추가/삭제는 호출부가 배열을 계산해서 넘긴다(setTrackedCharacterOcids와 동일한 패턴).
export async function setManualTrackedContent(
  ocid: string,
  items: ManualTrackedItem[],
): Promise<void> {
  await Preferences.set({ key: manualTrackedContentKey(ocid), value: JSON.stringify(items) })
}
