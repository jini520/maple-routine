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
  level: number | null
}

/**
 * API 는 `아케인셰이드 나이트햇` 처럼 띄어 주고 표는 붙여 쓴다. 들어오는 쪽의 공백을 지워 맞춘다.
 *
 * 1년치 실제 장비 132종에서 공백을 지웠을 때 겹치는 이름이 **한 건도 없다.** 그래서 이 정규화가
 * 두 아이템을 하나로 뭉개지 않는다.
 */
function normalize(name: string): string {
  return name.replace(/\s/g, '')
}

const LEVEL_BY_NAME = new Map<string, number>()
for (const item of equipmentItems.items as EquipmentItem[]) {
  if (item.level !== null) {
    LEVEL_BY_NAME.set(item.name, item.level)
  }
}

/** 모르면 `null`. 그 아이템의 스타포스 비용은 안 매기고 건수만 센다. */
export function equipmentItemLevel(targetItem: string): number | null {
  return LEVEL_BY_NAME.get(normalize(targetItem)) ?? null
}
