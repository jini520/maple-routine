/**
 * 대기 마크를 한 자리에서 가져간다([[ADR-199]] 정정 2). 쓰는 쪽은
 * `import { MapleSweepSpinner } from 'components/atoms/Spinner'` 다.
 *
 * **크기로 고른다.** 16px 버튼 안은 `MapleSpinner`, 24px 이상은 `MapleSweepSpinner` 다
 * ([[ADR-061]] 결정 1).
 *
 * `spinner-base.tsx` 는 안 내보낸다 — 여기서 스피너를 그릴 때만 쓴다. 정지한 잎은 `atoms/Icon` 의
 * `MapleLeaf` 다.
 */
export { MapleSpinner } from './MapleSpinner'
export { MapleSweepSpinner } from './MapleSweepSpinner'
