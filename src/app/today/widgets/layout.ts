/**
 * today 위젯의 기본 배치. 손으로 적은 좌표 표.
 *
 * ```
 * (0,0)  4x1     대표 캐릭터
 * (0,1)  2x1     초기화 카운트다운      (2,1) 2x1  주간 결정석 판매 한도
 * (0,2)  4×auto  계정 및 메이플 ID 공유 컨텐츠
 * (0,3)  4×auto  캐릭터별 남은 스케줄
 * (0,4)  4×auto  주간 보스 수익
 * (0,5)  2x1     이번 주 최고가 아이템  (2,5) 2x1  가격 미입력
 * (0,6)  4x1     아이템 드롭 가뭄
 * ```
 *
 * 읽는 순서가 배열의 근거다. 정체 → 마감·상한 → 한 번만 하면 되는 것 → 캐릭터별 할 일 → 결과 →
 * 결과의 디테일 → 정서. 공유가 남은 스케줄 위인 것은 먼저 치우면 아래 목록이 줄어드는 관계라서다.
 *
 * **`row` 는 auto 타일의 최소 높이(`h = 1`) 기준으로 적는다.** 좌표가 한 칸씩 이어지고 렌더러가
 * 실측 초과분만큼 아래를 민다. `row` 를 재계산해 다시 채우지 말 것. auto 타일이 `w === 4` 라 옆
 * 칸이 없어 초과분이 그냥 누적된다.
 *
 * 이 배열은 코드 상수다. 저장 스키마도 마이그레이션도 만들지 않는다.
 */

import type { WidgetPlacement } from '../../../lib/today/widget-layout'
import type { WidgetId } from './types'

/** `WidgetPlacement` 의 `id` 를 레지스트리에 있는 것으로 좁힌다. 오타가 타입에서 걸린다. */
export type TilePlacement = Omit<WidgetPlacement, 'id'> & { id: WidgetId }

export const TILE_LAYOUT: readonly TilePlacement[] = [
  { id: 'representative-character', col: 0, row: 0, w: 4, h: 1 },
  { id: 'reset-countdown', col: 0, row: 1, w: 2, h: 1 },
  { id: 'crystal-limit', col: 2, row: 1, w: 2, h: 1 },
  { id: 'shared-contents', col: 0, row: 2, w: 4, h: 'auto' },
  { id: 'remaining-schedule', col: 0, row: 3, w: 4, h: 'auto' },
  { id: 'weekly-boss-profit', col: 0, row: 4, w: 4, h: 'auto' },
  { id: 'top-valuable-item', col: 0, row: 5, w: 2, h: 1 },
  { id: 'unpriced-drops', col: 2, row: 5, w: 2, h: 1 },
  { id: 'valuable-drought', col: 0, row: 6, w: 4, h: 1 },
]
