/**
 * 기본 배치 — **손으로 적은 좌표**(사용자 확정 2026-08-17).
 *
 * ```
 * (0,0)  4x1     대표 캐릭터
 * (0,1)  2x1     초기화 카운트다운      (2,1) 2x1  주간 결정석 판매 한도
 * (0,2)  4×auto  계정 및 메이플 ID 공유 컨텐츠  ← 아래 전부가 이 둘의 초과분만큼 내려간다
 * (0,3)  4×auto  캐릭터별 남은 스케줄
 * (0,4)  4×auto  주간 보스 수익          ← 여기까지 셋이 auto 라 초과분이 누적된다
 * (0,5)  2x1     이번 주 최고가 아이템  (2,5) 2x1  가격 미입력
 * (0,6)  4x1     아이템 드롭 가뭄
 * ```
 *
 * 읽는 순서가 곧 이 배열의 근거다 — 정체(대표) → **마감·상한**(초기화 · 결정석) → **한 번만 하면
 * 되는 것**(공유) → 캐릭터별 할 일(남은 스케줄) → 결과(수익) → 결과의 디테일(최고가 · 미입력) →
 * 정서(가뭄). 공유가 남은 스케줄 **위**인 이유는 **먼저 치우면 아래 목록이 줄어드는 관계**라서다
 * (사용자 지정).
 *
 * **`row` 는 auto 타일의 nominal `h = 1`**(최소 높이) 기준으로 적는다. 그래서 좌표가 한 칸씩 이어지고,
 * 렌더러가 실측 초과분만큼 아래를 민다 — **`row` 를 재계산해 다시 채우지 않는다.**
 * auto 타일이 **셋**이어도 규칙은 그대로다: `w === 4` 라 옆 칸이 없어 초과분이 그냥
 * **누적**된다.
 *
 * **v1 에서 이 배열은 코드 상수다**(사용자 결정 — 고정 레이아웃 + 확장 가능한 설계). 저장 스키마도
 * 마이그레이션도 만들지 않는다. 편집이 오면 같은 배열을 저장소로 옮기고 검증 함수를 그대로 쓴다.
 *
 * 손으로 적은 값이므로 **테스트가 지킨다**(`__tests__/widget-registry.test.ts`) — 자동 패킹을
 * 기각하며 산 값이 거기서 회수된다.
 */

import type { WidgetPlacement } from '../../../lib/today/widget-layout'
import type { WidgetId } from './types'

/** `WidgetPlacement` 의 `id` 를 레지스트리에 있는 것으로 좁힌다 — 오타가 타입에서 걸린다. */
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
