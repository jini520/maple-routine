/**
 * 시세 응답을 게임 데이터와 잇는 곳. 서버는 아이템을 key 로만 주고, 이름과 그림은 앱이 가진 게임 데이터에서 찾는다.
 */
import { findItem } from '../../lib/item-catalog'
import { isInWorldPeriod, worlds, type WorldEntry } from '../../lib/world/worlds'

export interface MarketItemFace {
  name: string
  /** 그림 id. 아이템 표에 없거나 그림이 없으면 `null` */
  iconAssetId: string | null
}

/**
 * 시세 줄의 이름과 그림. 반지는 드롭 기록과 같이 이름 뒤에 ` 4레벨` 을 붙인다.
 * 앱이 아직 모르는 새 아이템은 이름 자리에 key 를 적는다. 게임 데이터를 다시 받으면 이름이 선다.
 */
export function marketItemFace(itemKey: string, ringLevel: number | null): MarketItemFace {
  const item = findItem(itemKey)
  const level = ringLevel === null ? '' : ` ${ringLevel}레벨`
  return { name: `${item?.name ?? itemKey}${level}`, iconAssetId: item?.iconAssetId ?? null }
}

/**
 * 소비 월드 고르개의 월드. 기간이 없거나 그날이 든 기간이 있는 월드를 게임 데이터 차례대로 준다.
 * 닫힌 이벤트 월드는 서버가 시세를 만들지 않아 고르면 늘 빈 상태라 뺀다.
 *
 * @param todayKey KST `YYYY-MM-DD`
 */
export function openWorlds(todayKey: string): WorldEntry[] {
  return worlds().filter((world) => world.periods.length === 0 || isInWorldPeriod(world.key, todayKey))
}

/** 고르개의 처음 값. 대표 캐릭터의 월드가 고르개에 있으면 그 월드이고, 아니면 첫 월드다. */
export function initialWorldKey(open: readonly WorldEntry[], representativeWorldKey: string | null): string | null {
  if (representativeWorldKey !== null && open.some((world) => world.key === representativeWorldKey)) return representativeWorldKey
  return open[0]?.key ?? null
}
