import { Preferences } from '@capacitor/preferences'
import { manualTrackedContentKey } from './keys'

// ADR-035 결정 6: 멤버십(+사용자 입력 max_count)만 저장한다 — nowCount/questState/isComplete 같은
// 동기화 유래 값은 절대 여기 두지 않고, 표시 시점에 schedulerCache에서 조회한다(단일 진실 공급원).
export interface ManualTrackedItem {
  contentName: string
  kind: 'content' | 'boss'
  difficulty?: string // kind: 'boss'일 때만 사용(보스명만으로는 유일하지 않음)
  maxCount?: number // kind: 'content'이고 카운트형일 때만. 템플릿(scheduler-content-template.json)의 확정값을 복사해 저장(ADR-035 결정 7)
}

// 저장된 값이 없거나 손상된 JSON이면 빈 배열을 반환한다.
export async function getManualTrackedContent(ocid: string): Promise<ManualTrackedItem[]> {
  const { value } = await Preferences.get({ key: manualTrackedContentKey(ocid) })
  if (value === null) {
    return []
  }

  try {
    return JSON.parse(value) as ManualTrackedItem[]
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
