/**
 * 메이플 ID 의 이름. 앱 전체가 메이플 ID 를 이 이름으로 부른다.
 *
 * 사용자가 바꾼 이름이 있으면 그것이다. 없으면 ID 값에서 바로 지어서, 대표 캐릭터나 목록이 없어도 늘 서고 서로 다른 ID 가 같은
 * 이름으로 서지 않는다.
 *
 * @param accountId 메이플 ID(`character/list` 의 `account_id`)
 * @param custom 사용자가 바꾼 이름(`useMapleIdNamesStore` 의 `names`)
 * @example mapleIdNameOf('da9b2f21c3e4') // '메이플ID-da9b2f21'
 */
export function mapleIdNameOf(accountId: string, custom?: Readonly<Record<string, string>>): string {
  return custom?.[accountId] ?? `메이플ID-${accountId.slice(0, 8)}`
}
