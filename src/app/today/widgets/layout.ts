/**
 * today 위젯의 기본 배치. 손으로 적은 좌표 표.
 *
 * ```
 * 0  4칸  대표 캐릭터
 * 1  2칸  초기화 카운트다운        2칸  주간 결정석 판매 한도
 * 2  4칸  다음 파티 스케줄(보여 줄 회차가 없으면 숨는다)
 * 3  4칸  계정 및 메이플 ID 공유 컨텐츠
 * 4  4칸  캐릭터별 남은 스케줄
 * 5  4칸  이번 주 수익
 * 6  2칸  이번 주 최고가 아이템    2칸  가격 미입력
 * ```
 *
 * 읽는 순서가 배열의 근거다. 정체 → 마감·상한 → 한 번만 하면 되는 것 → 캐릭터별 할 일 → 결과 →
 * 결과의 디테일. 공유가 남은 스케줄 위인 것은 먼저 치우면 아래 목록이 줄어드는 관계라서다.
 *
 * 이 배열은 코드 상수다. 저장 스키마도 마이그레이션도 만들지 않는다.
 */

import type { WidgetPlacement } from '../../../lib/today/widget-layout'
import type { WidgetId } from './types'

/** `WidgetPlacement` 의 `id` 를 레지스트리에 있는 것으로 좁힌다. 오타가 타입에서 걸린다. */
export type TilePlacement = Omit<WidgetPlacement, 'id'> & { id: WidgetId }

export const TILE_LAYOUT: readonly TilePlacement[] = [
  { id: 'representative-character', col: 0, row: 0, w: 4 },
  { id: 'reset-countdown', col: 0, row: 1, w: 2 },
  { id: 'crystal-limit', col: 2, row: 1, w: 2 },
  { id: 'next-party-schedule', col: 0, row: 2, w: 4 },
  { id: 'shared-contents', col: 0, row: 3, w: 4 },
  { id: 'remaining-schedule', col: 0, row: 4, w: 4 },
  { id: 'weekly-income', col: 0, row: 5, w: 4 },
  { id: 'top-valuable-item', col: 0, row: 6, w: 2 },
  { id: 'unpriced-drops', col: 2, row: 6, w: 2 },
]
