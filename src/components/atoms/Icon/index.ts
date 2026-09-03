/**
 * 커스텀 아이콘을 한 자리에서 가져가는 배럴. 쓰는 쪽은
 * `import { ProfitIcon } from 'components/atoms/Icon'` 이다.
 *
 * **`icon-base.tsx` 는 안 내보낸다.** `IconSvg` 와 `IconProps` 는 이 디렉터리 안에서 아이콘을 그릴
 * 때만 쓰고, 그 파일들은 `./icon-base` 로 직접 가져온다.
 *
 * lucide 아이콘은 `./lucide` 가 등록해 내보낸다. 그 파일은 **아이콘별 경로로**
 * 가져온다. 배럴 import 는 아이콘 1,900개를 그래프에 넣는데 Metro 는 트리셰이킹을 안 한다.
 * 움직이는 잎은 `atoms/Spinner` 다.
 */
export * from './lucide'

export { GearIcon } from './GearIcon'
export { MapleLeaf } from './MapleLeaf'
export { ProfitIcon } from './ProfitIcon'
