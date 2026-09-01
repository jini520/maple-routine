/**
 * 커스텀 아이콘을 한 자리에서 가져간다([[ADR-199]] 결정 1). 쓰는 쪽은
 * `import { ProfitIcon } from 'components/atoms/Icon'` 이다.
 *
 * **`icon-base.tsx` 는 안 내보낸다.** `IconSvg` 와 `IconProps` 는 이 디렉터리 안에서 아이콘을 그릴
 * 때만 쓰고, 그 파일들은 `./icon-base` 로 직접 가져온다.
 *
 * lucide 아이콘은 여기가 아니라 `lib/icons.ts` 를 거친다([[ADR-197]] 결정 4). 움직이는 잎은
 * `atoms/Spinner` 다([[ADR-199]] 정정 2). 새 아이콘을 더할 때는 이 파일에 한 줄을 더한다.
 */
export { GearIcon } from './GearIcon'
export { MapleLeaf } from './MapleLeaf'
export { ProfitIcon } from './ProfitIcon'
