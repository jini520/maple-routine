/**
 * 저장된 하단바 순서를 표에 맞추는 순수 함수.
 *
 * 빠른 이동과 달리 빠진 칸을 뒤에 더한다. 빠른 이동은 칸이 비어도 괜찮지만 바에서 칸이 사라지면 그 화면으로 갈 수 없다.
 */
import { BAR_GROUPS, DEFAULT_BAR_ORDER, type BarOrder, type GroupId } from '../../navigation/bar-groups'
import type { TabRouteName } from '../../navigation/routes'

const GROUPS = DEFAULT_BAR_ORDER.groups
/** 양 끝에 고정되는 today 와 더보기 */
const FIRST_GROUP = GROUPS[0]
const LAST_GROUP = GROUPS[GROUPS.length - 1]
const MOVABLE_GROUPS = GROUPS.slice(1, -1)

/** 표에 있는 칸만 저장된 차례로 남기고, 빠진 칸을 표의 순서대로 뒤에 더한 목록 */
function fitToTable<T extends string>(saved: unknown, table: readonly T[]): T[] {
  const listed = Array.isArray(saved) ? saved.filter((one: T) => table.includes(one)) : []
  const kept = [...new Set<T>(listed)]
  return [...kept, ...table.filter((one) => !kept.includes(one))]
}

/** 저장된 값을 바가 그릴 수 있는 순서로 읽는 함수. 값이 없거나 깨졌으면 기본 순서다 */
export function parseBarOrder(raw: unknown): BarOrder {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_BAR_ORDER
  const { groups, subs } = raw as { groups?: unknown; subs?: Partial<Record<GroupId, unknown>> | null }

  return {
    groups: [FIRST_GROUP, ...fitToTable(groups, MOVABLE_GROUPS), LAST_GROUP],
    subs: Object.fromEntries(
      BAR_GROUPS.filter((group) => group.subs.length > 0).map((group) => [
        group.id,
        fitToTable<TabRouteName>(subs?.[group.id], group.subs.map((sub) => sub.page)),
      ]),
    ),
  }
}

/** 편집 페이지의 `적용` 이 꺼지는 조건. 둘 다 `parseBarOrder` 를 거쳐 칸의 차례가 같으므로 문자열로 견준다 */
export function isSameBarOrder(a: BarOrder, b: BarOrder): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
