// 보스 원형 초상 — 보스 수익 화면의 보스 행·파티 인원 모달이 쓴다. 크롭은 원형 아이콘 전용 표에서
// 오고(카드 bleed 용과 다른 표다 — [[ADR-018]]), 값은 `/debug` 도구에서 사용자가 직접 맞춘 것이라
// AI 가 채우지 않는다([[ADR-006]] 과 같은 원칙).
//
// ── ⚠️ RN 에서는 지금 **플레이스홀더 하나만 그린다** ───────────────────────────────
//
// 웹은 두 분기다 — 그림이 있으면 배경 이미지 원, 없으면 `?` 플레이스홀더. RN 은 **아직 플레이스홀더
// 쪽만** 그린다. 이 컴포넌트는 `getBossPortraitUrl` 을 아예 부르지 않는다.
//
// **막고 있는 것이 [[ADR-129]] 로 하나 줄었다.** 그림은 이제 번들에 있다(그 함수가 진짜 에셋 참조를
// 돌려준다). 남은 벽은 **기하**다 — 웹의 그 분기는 `background-size: "220% auto"` ·
// `background-position: "60% 40%"` 를 CSS 에 그대로 넘기는데, RN 에는 배경 위치가 없어 `<Image>` 를
// 손으로 앉혀야 하고 그 계산에는 **그림의 고유 종횡비**가 필요하다(`Image.resolveAssetSource` 로
// 읽는다 — 번들 에셋이라 이제 읽을 수 있다). 그 변환은 화면 작업의 일부라 여기서 몰래 하지 않는다.
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
