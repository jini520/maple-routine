// 보스 원형 초상 — 보스 수익 화면의 보스 행·파티 인원 모달이 쓴다. 크롭은 원형 아이콘 전용 표에서
// 오고(카드 bleed 용과 다른 표다 — [[ADR-018]]), 값은 `/debug` 도구에서 사용자가 직접 맞춘 것이라
// AI 가 채우지 않는다([[ADR-006]] 과 같은 원칙).
//
// ── ⚠️ RN 에서는 지금 **플레이스홀더 하나만 그린다** ───────────────────────────────
//
// 웹은 두 분기다 — 그림이 있으면 배경 이미지 원, 없으면 `?` 플레이스홀더. RN 에는 **그림이 아직
// 한 장도 없다**(`src/lib/rn-boss-icons.ts` 파일 머리 — `getBossPortraitUrl` 이 항상 `null` 이다).
// 그래서 웹이라도 같은 값을 받으면 탔을 분기, 즉 플레이스홀더만 남는다. 없는 것을 흉내 내지 않는다.
//
// **이미지 분기를 미리 써 두지 않는 이유**는 죽은 코드라서만이 아니다. 웹의 그 분기는
// `background-size: "220% auto"` · `background-position: "60% 40%"` 를 CSS 에 그대로 넘기는데,
// RN 에는 배경 위치가 없어 `<Image>` 를 손으로 앉혀야 하고 그 계산에는 **그림의 고유 종횡비**가
// 필요하다. 그 값은 에셋이 번들에 들어온 뒤에야 알 수 있으므로(`Image.resolveAssetSource`), 지금
// 쓰는 코드는 실행할 수도 검증할 수도 없다. 두 결정에는 순서가 있고, 여기서는 그 순서를 지킨다.
//
// `crop` 프롭은 **남겨 둔다** — 호출부 API 를 바꾸지 않기 위해서다([[ADR-128]] 원칙 1의 같은 취지).
// 에셋 레이어가 오면 이 프롭이 그대로 이미지 분기의 입력이 되고, 값이 없을 때의 조회
// (`getBossPortraitIconCrop`)도 그때 같이 살아난다.
import { Text, View } from 'react-native'

import type { BossPortraitCrop } from '@core/lib/boss-icons'

export interface BossPortraitProps {
  portraitSlug: string | null
  label: string
  size?: number // px, 기본값 40(보스 수익 화면 기존 h-10 크기)
  crop?: BossPortraitCrop // 없으면 boss-portrait-icon-crops.json에서 portraitSlug로 조회(없으면 cover/center)
}

export function BossPortrait(props: BossPortraitProps): React.JSX.Element {
  const size = props.size ?? 40

  return (
    <View
      testID="boss-portrait"
      accessibilityLabel={props.label}
      style={{ width: size, height: size }}
      className="shrink-0 items-center justify-center rounded-full bg-surface-2"
    >
      <Text className="text-xs text-text-muted">?</Text>
    </View>
  )
}
