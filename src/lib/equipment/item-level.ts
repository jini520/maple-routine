/**
 * 장비 이름에서 **착용 레벨**로. 스타포스 비용이 이 값에 좌우된다.
 *
 * 스타포스 응답에는 `item_level` 이 없다(1년치 3,220건 실측). 큐브·잠재는 그 값을 주므로 그쪽
 * 기록이 표의 절반을 채우고, 나머지는 `src/data/equipment-items.json` 이 든다.
 *
 * **모르면 `null` 이다. 0 이 아니다.** 0 을 주면 레벨 0 짜리 장비가 생겨 비용이 조용히 틀린다.
 *
 * @see docs/persistence/sqlite.md `enhancement_history`
 */
import equipmentItems from '../../data/equipment-items.json'

interface EquipmentItem {
  name: string
  set: string | null
  level: number | null
}

/** API 는 `아케인셰이드 나이트햇` 처럼 띄어 주고 표는 붙여 쓴다. 그대로 맞추면 한 건도 안 걸린다. */
function normalize(name: string): string {
  return name.replace(/\s/g, '')
}

const SET_LEVEL = new Map<string, number>(
  (equipmentItems.sets as { name: string; level: number | null }[])
    .filter((entry): entry is { name: string; level: number } => entry.level !== null)
    .map((entry) => [entry.name, entry.level]),
)

// 개별 레벨이 없으면 세트 레벨이 받는다. 세트 한 줄로 수십 종이 채워진다.
const LEVEL_BY_NAME = new Map<string, number>()
for (const item of equipmentItems.items as EquipmentItem[]) {
  const level = item.level ?? (item.set === null ? null : (SET_LEVEL.get(item.set) ?? null))
  if (level !== null) {
    LEVEL_BY_NAME.set(item.name, level)
  }
}

/** 모르면 `null`. 그 아이템의 스타포스 비용은 안 매기고 건수만 센다. */
export function equipmentItemLevel(targetItem: string): number | null {
  return LEVEL_BY_NAME.get(normalize(targetItem)) ?? null
}
