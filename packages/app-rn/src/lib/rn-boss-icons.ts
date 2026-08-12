/**
 * `@core/lib/boss-icons` 의 RN 대체 — `core-shims.js` 가 번들러 수준에서 이 파일로 갈아끼운다
 * (왜 갈아끼우는지의 일반론은 그 파일에, 이 자리의 사정은 아래에).
 *
 * **시그니처는 한 글자도 다르지 않다**([[ADR-127]] 원칙 1). `BossPortrait` 는 자기가 어느 구현을
 * 쓰는지 모른다.
 *
 * ## 크롭 두 표는 진짜다 — URL 하나만 없다
 *
 * 원본에서 `import.meta.glob` 을 쓰는 것은 **에셋 URL 맵 한 곳**뿐이고, 크롭 두 표는 JSON 조회다
 * ([[ADR-018]] 결정 — 원형 아이콘용 표와 카드 bleed 용 표가 따로다). 그래서 그 둘은 여기서도 같은
 * JSON 을 읽어 같은 규칙(NFC 정규화 → 조회 → 없으면 `DEFAULT_CROP`)으로 답한다. **값을 베끼지
 * 않았다** — 표는 `@core/data/*.json` 그대로다([[ADR-006]]).
 *
 * ## `getBossPortraitUrl` 은 항상 `null` 이다
 *
 * `null` 은 원본이 이미 정의해 둔 정상 경로다 — *"슬러그에 해당하는 파일이 없으면 `null`"*. 그리고
 * 지금 RN 번들에는 실제로 그 파일이 **한 장도 없다**. 이 함수가 채워질 때 필요한 것은 두 가지이고,
 * 둘 다 이 파일 밖의 결정이다.
 *
 * 1. **슬러그 → 에셋 매핑.** Metro 는 `require()` 경로를 정적으로 알아야 하고, `import.meta.glob` 의
 *    짝인 `require.context` 는 **jest 에서 아예 없다**(실측 2026-08-12: `require.context is not a
 *    function`). Metro 만 되고 테스트가 죽는 방식은 이 저장소가 이미 거부한 형태다(`core-shims.js`
 *    「한 벌로 두는 이유」). 그래서 남는 길은 정적 맵이고, 그 맵을 **무엇이 생성·검증하는가**가
 *    에셋 레이어의 결정이다([[ADR-093]] 이 웹에서 "자산 최적화는 코드를 안 바꿔 조용히 깨진다"고
 *    적고 전수 해석 테스트를 세운 것과 같은 문제).
 * 2. **CSS `background-size`/`background-position` → RN 기하.** 표의 값은 `"220% auto"` ·
 *    `"60% 40%"` 처럼 **컨테이너 기준 퍼센트**이고, RN 에는 배경 위치가 없어 `<Image>` 를 직접
 *    앉혀야 한다. 그 계산에는 그림의 **고유 종횡비**가 필요한데 그것은 1번이 해결된 뒤에야 알 수
 *    있다(`Image.resolveAssetSource`). 즉 두 결정은 순서가 정해져 있다.
 *
 * 그때까지 `BossPortrait` 는 자기 플레이스홀더 분기(`?`)만 그린다 — 그것이 이 반환값의 계약이다.
 */

import cropsData from '@core/data/boss-portrait-crops.json'
import iconCropsData from '@core/data/boss-portrait-icon-crops.json'

export interface BossPortraitCrop {
  size: string
  position: string
}

const BOSS_PORTRAIT_CROPS = cropsData as Record<string, BossPortraitCrop>
const BOSS_PORTRAIT_ICON_CROPS = iconCropsData as Record<string, BossPortraitCrop>

const DEFAULT_CROP: BossPortraitCrop = { size: 'cover', position: 'center' }

/** 항상 `null` — RN 번들에 보스 일러스트가 아직 없다(파일 머리). */
export function getBossPortraitUrl(portraitSlug: string | null): string | null {
  void portraitSlug
  return null
}

export function getBossPortraitCrop(portraitSlug: string | null): BossPortraitCrop {
  if (portraitSlug === null) return DEFAULT_CROP

  return BOSS_PORTRAIT_CROPS[portraitSlug.normalize('NFC')] ?? DEFAULT_CROP
}

export function getBossPortraitIconCrop(portraitSlug: string | null): BossPortraitCrop {
  if (portraitSlug === null) return DEFAULT_CROP

  return BOSS_PORTRAIT_ICON_CROPS[portraitSlug.normalize('NFC')] ?? DEFAULT_CROP
}
