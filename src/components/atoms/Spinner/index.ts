/**
 * 대기 마크를 한 자리에서 가져간다. 쓰는 쪽은
 * `import { MapleSweepSpinner } from 'components/atoms/Spinner'` 다.
 *
 * **크기로 고른다.** 16px 버튼 안은 `MapleSpinner`, 24px 이상은 `MapleSweepSpinner` 다.
 *
 * `spinner-base.ts` 는 안 내보낸다. 스피너 둘이 공유하는 프롭 타입만 들었다. 정지한 잎은
 * `atoms/Icon` 의 `MapleLeaf` 다.
 */
export { MapleSpinner } from './MapleSpinner'
export { MapleSweepSpinner } from './MapleSweepSpinner'
