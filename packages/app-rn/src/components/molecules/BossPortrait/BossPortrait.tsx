// 보스 원형 초상 — 보스 관리 페이지 행·보스 수익 화면의 보스 행이 쓴다. 크롭은 원형 아이콘 전용
// 표에서 오고(카드 bleed 용과 다른 표다 — [[ADR-018]]), 값은 `/debug` 도구에서 사용자가 직접 맞춘
// 것이라 AI 가 채우지 않는다([[ADR-006]] 과 같은 원칙).
//
// ── 그림 분기가 돌아왔다 (4단계 step 5) ─────────────────────────────────────────────
//
// 3단계는 플레이스홀더 쪽만 그렸다. 막고 있던 것 둘이 차례로 풀렸다 — 에셋은 [[ADR-129]] 가
// 번들에 넣었고(`getBossPortraitUrl` 이 진짜 참조를 돌려준다), 남아 있던 **기하**는 step 4 가
// 컨텐츠 카드에서 푼 변환을 그대로 쓴다(`MediaCardArt/media-card-art.ts` 파일 머리 — CSS
// `background-size`/`position` 퍼센트를 `width`+`aspectRatio`, `left`+`translateX` 로 옮긴다).
//
// **여기서 다시 계산하지 않는다.** 카드 bleed 와 이 원형 초상은 크롭 표만 다르고(`…-crops` vs
// `…-icon-crops`) 값의 형태가 같아, 변환이 두 벌이 되면 한쪽만 고쳐지는 사고가 열린다.
//
// 카드와 **다른 것 셋**: ① 필터·투명도·베일이 없다(웹도 없었다 — 이 그림은 글자 뒤로 깔리지
// 않는다) ② 원형이라 `overflow-hidden` 이 필요하다. 웹은 `background-image` 라 둥근 모서리가
// 배경을 저절로 잘랐지만, RN 의 `<Image>` 는 자식이라 부모가 명시적으로 잘라야 한다 ③ 접근성
// 역할 `img` 가 붙는다(웹과 **같은 이름**이다 — RN 의 `role` 은 ARIA 이름을 그대로 받는다).
import { Image, Text, View } from 'react-native'

import { getBossPortraitIconCrop, getBossPortraitUrl } from '@core/lib/boss-icons'
import type { BossPortraitCrop } from '@core/lib/boss-icons'

import {
  mediaArtImageStyle,
  mediaArtNaturalSize,
  resolveMediaArtLayout,
} from '../MediaCardArt/media-card-art'

export interface BossPortraitProps {
  portraitSlug: string | null
  label: string
  size?: number // px, 기본값 40(보스 수익 화면 기존 h-10 크기)
  crop?: BossPortraitCrop // 없으면 boss-portrait-icon-crops.json에서 portraitSlug로 조회(없으면 cover/center)
}

export function BossPortrait(props: BossPortraitProps): React.JSX.Element {
  const size = props.size ?? 40
  const url = getBossPortraitUrl(props.portraitSlug)

  if (url === null) {
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

  const crop = props.crop ?? getBossPortraitIconCrop(props.portraitSlug)
  const layout = resolveMediaArtLayout(crop, mediaArtNaturalSize(url))

  return (
    <View
      testID="boss-portrait"
      role="img"
      accessibilityLabel={props.label}
      style={{ width: size, height: size }}
      className="shrink-0 overflow-hidden rounded-full"
    >
      <Image
        testID="boss-portrait-image"
        source={url}
        // 상자를 종횡비로 이미 맞췄으므로 `stretch` 가 왜곡을 만들지 않는다(`MediaCardArt` 와 같은 이유).
        resizeMode={layout.kind === 'cover' ? 'cover' : 'stretch'}
        style={mediaArtImageStyle(layout)}
      />
    </View>
  )
}
