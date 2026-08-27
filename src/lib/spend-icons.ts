/**
 * 지출 목록의 **타일 그림**([[ADR-170]] 정정 16) — 고를 것의 이름에서 아이콘을 찾는다.
 *
 * ## 왜 표인가 (계산이 아니라)
 *
 * 이름에서 파일명을 **계산하지 않는다** — 「몬스터 파크」 의 그림은 입장권이고 「일간 퀘스트」 는
 * 슈피겔만(그 퀘스트를 주는 NPC)이다. 이름과 파일이 어긋나는 자리가 대부분이므로 규칙을 만들면
 * 예외부터 생긴다([[ADR-011]] 결정 6 이 반지·아이템에서 내린 그 판단과 같다: **표에서 조회하고,
 * 없으면 폴백**).
 *
 * ## 원천이 둘이다
 *
 * 대부분은 아이템 그림(`assets/items/`)이지만 **에픽던전 셋은 지역 아이콘**이다
 * (`assets/maps/icons/` — 일일 퀘스트 화면이 쓰는 그 그림). 같은 그림을 복사해 두 벌로 두지
 * 않는다: 한쪽만 갈리면 같은 곳이 화면마다 다르게 보인다.
 *
 * 두 생성물의 **키 모양이 다르다** — 아이템은 확장자까지 있는 파일명, 지역 아이콘은 슬러그다
 * (`assets/generated/`). 표를 둘로 나눠 그 차이를 이름으로 드러낸다.
 *
 * ## 없는 것은 없는 채로 둔다
 *
 * 그림이 없는 항목이 남아 있다(출석 이벤트 패스 · 보약 버프 둘 · 영약 밖의 것들). 비슷한 그림을
 * 갖다 붙이면 **틀린 것을 그리는** 셈이라([[ADR-101]] 결정 1) `null` 을 돌려주고 화면이 비운다.
 * 「솔 에르다」 가 그렇게 한 번 물렸다 — 조각 그림을 달았다가 *"그거 아니야"* 로 걷었고
 * (2026-08-28), 지금 것은 사용자가 지정한 `sole_1000` 이다.
 *
 * ## 키는 **타일에 적히는 이름**이다
 *
 * 카탈로그의 `base ?? name` — 사용자가 실제로 누르는 칸의 글자다. 카탈로그가 사용자 데이터라
 * ([[ADR-006]]) 이름이 바뀌면 이 표도 함께 손봐야 하고, 안 고치면 **그림만 조용히 사라진다**
 * (에러가 아니다) — 그 자리를 `SpendSheet.test` 가 붙든다.
 */
import { ITEM_ASSETS } from '../assets/generated/items'
import { DAILY_QUEST_ICON_ASSETS } from '../assets/generated/map-icons'
import type { ImageAssetRef } from '../types/image-asset'

/** 타일 이름 → `assets/items/` 의 **파일명**(확장자 포함). */
const ITEM_ICON_BY_LABEL: Record<string, string> = {
  '몬스터 파크': 'monster_park_ticket.webp',
  '에픽던전': 'cerzar.webp',
  '일간 퀘스트': 'grandis_spiegelmann.webp',
  '주간 퀘스트': 'arcane_river_spiegelmann.webp',
  '메카베리 농장': 'mechaberry_farm_ticket.webp',
  '블루베리 농장': 'blueberry_farm_ticket.webp',
  '솔 에르다': 'sole_1000.webp',
  '블랙 서큘레이터': 'black_circulator.webp',
  미호로이드: 'mihoroid.webp',
  'VIP 사우나': 'vip_sauna_ticket.webp',
  '닉네임 변경': 'npc_mr_newname.webp',
  '세이람의 영약': 'seiram_elixir.webp',
  '알레리아의 영약': 'alleria_elixir.webp',
  '콜렉터의 영약': 'collector_elixir.webp',
  '명예의 영약': 'honor_elixir.webp',
}

/**
 * 타일 이름 → `assets/maps/icons/` 의 **슬러그**(확장자 없음). 에픽던전 셋이 여기 산다.
 *
 * 이 셋만 그림이 **이름 옆**에 선다(사용자 지정 2026-08-28) — 사유는 `SpendIcon.beside`.
 */
const MAP_ICON_BY_LABEL: Record<string, string> = {
  하이마운틴: 'highMountain',
  '앵글러 컴퍼니': 'anglerCompany',
  악몽선경: 'nightmareParadise',
}

/**
 * 그림 하나 — **어디에 서는지까지** 든다.
 *
 * `beside` 는 «이름 바로 옆» 이다(아니면 타일 왼쪽 끝). 에픽던전 추가 리워드 셋만 그쪽이고,
 * 그것은 사용자가 자리를 그렇게 지정했기 때문이다(2026-08-28) — 지금은 «지역 아이콘 = 이름 옆»
 * 이 우연히 일치하지만, 그 둘은 다른 이야기라 **자리를 표가 직접 말한다.**
 */
export interface SpendIcon {
  readonly ref: ImageAssetRef
  readonly beside: boolean
}

export function spendIconOf(label: string): SpendIcon | null {
  const file = ITEM_ICON_BY_LABEL[label]
  if (file !== undefined) {
    const ref = ITEM_ASSETS[file]
    return ref === undefined ? null : { ref, beside: false }
  }

  const slug = MAP_ICON_BY_LABEL[label]
  if (slug !== undefined) {
    const ref = DAILY_QUEST_ICON_ASSETS[slug]
    return ref === undefined ? null : { ref, beside: true }
  }

  return null
}
