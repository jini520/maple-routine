// 보스 카드를 탭하면 열리는 파티 인원·난이도 모달 ([[ADR-121]]).
//
// **표시 전용이다** — 모드(자동/수동)를 모르고, 난이도 선택이 무엇을 뜻하는지도 모른다. 수동
// 모드에서는 멤버십 교체이고 자동 모드에서는 "어느 난이도의 파티 인원을 편집할지" 전환인데, 그
// 차이는 호출부가 핸들러로 정한다(결정 3). 여기에 모드 분기를 두면 나중에 두 모드를 통합할 때
// 지워야 할 코드가 된다.
//
// 파티 인원은 (보스 + 난이도)에 붙어 있어 난이도를 바꾸면 값과 상한이 함께 갈아탄다
// (스우: 하드 6인 / 익스트림 2인). 라벨 옆 `n / max` 배지가 그 사실을 말한다.
//
// ── RN 으로 옮기며 갈린 것 다섯 ─────────────────────────────────────────────────────
//
// ① **그림이 앉았다(step 5).** 3단계가 *"셋이 한 덩어리라 따로 못 옮긴다"* 며 미뤄 둔 자리 —
//    크롭의 CSS 값(`background-size: "100% auto"` / `position: "50% 45%"`)을 RN 기하로 바꾸고,
//    웹의 `filter` 와 `mask-image` 를 각각 RN `filter` 스타일과 **뒤집은 그라데이션**으로
//    푸는 일이다. 그 셋을 step 4 가 컨텐츠 카드에서 이미 한 벌 풀어 두었으므로 여기서는
//    `FadedIllustration` 를 **부르기만 한다**(`variant="hero"` — 마스크 끝점이 카드와 다르다).
//    보스 카드와 같은 컴포넌트를 쓰는 것이 [[ADR-121]] 결정 7 이 요구하는 *"같은 값"* 이다.
// ② **`bg-surface/60` 이 안 나온다.** NativeWind(v3 엔진)는 `var()` 색에 투명도 접미사를 만들지
//    못한다(step 3 이 남긴 함정 둘 중 하나) — 클래스는 조용히 사라지고 닫기 버튼 배경이 없어진다.
//    그래서 값에서 직접 rgba 를 만든다(`lib/color-alpha.ts` — step 6 의 경계 페이드가 같은 함정을
//    밟아 두 번째 호출부가 됐다). 그 값이 `surface` 가 아니라 **`mediaSurface`** 인 것도 같은
//    이유다 — 버튼이 `media-scope` 안이라 웹에서는 `var(--color-surface)` 가 이미 그것으로
//    재선언돼 있었다([[ADR-064]] 결정 5).
// ③ **글자 그림자·베일이 스타일이 아니라 컴포넌트가 된다.** `textShadow` 는 RN 에서
//    `textShadowColor/Offset/Radius` 세 프롭이라 두 겹(웹은 그림자 둘)을 못 겹친다 — 강한 쪽
//    하나만 남긴다. `linear-gradient` 베일은 `expo-linear-gradient` 로 그린다.
// ④ `border-t` 경계선은 `media-scope` **바깥**이다 — 다크 테마는 media-surface ≈ surface 이고
//    검은마법사는 값이 완전히 같아(#1C1319) 경계가 이 선뿐이다. 웹과 같은 자리에 그대로 둔다.
// ⑤ `space-y`/`gap-[18px]` 은 `gap-*` 로, `tabular-nums` 는 스타일로(`lib/text-styles.ts`).
import { Pressable, View } from 'react-native'

import { getBossPortraitCrop, getBossPortraitUrl } from '../../../lib/assets/asset-lookup'
import type { BossDifficulty } from '../../../types'

import { withAlpha } from '../../../lib/color'
import { LinearGradient } from '../../../lib/nativewind-interop'
import { UsersIcon, XIcon } from '../../../lib/icons'
// 히어로 글자의 그림자는 카드 둘과 같은 값을 쓴다 — 세 번째 호출부가 생기며 `lib/text-styles.ts`
// 로 올라갔다([[ADR-094]] 결정 1). 값·근거는 그 파일이 갖는다.
import { ILLUSTRATION_TEXT_SHADOW_STYLE, TABULAR_NUMS } from '../../../constants/style/text-styles'
import { useThemeAppearance } from '../../../theme/context'
import { MediaScope } from '../../../theme/MediaScope'
import { Badge, Text } from '../../atoms'
import { DifficultySegment } from '../../molecules/DifficultySegment/DifficultySegment'
import { FadedIllustration } from '../../molecules/FadedIllustration/FadedIllustration'
import { PartySizeStepper } from '../../molecules/PartySizeStepper/PartySizeStepper'
import { Modal } from '../Modal/Modal'

export function PartySizeModal(props: {
  bossName: string
  /** 히어로의 키커 — '주간 보스' / '월간 보스'. */
  cycleLabel: string
  portraitSlug: string | null
  difficulties: BossDifficulty[]
  difficulty: BossDifficulty
  partySize: number
  maxPartySize: number
  onSelectDifficulty: (difficulty: BossDifficulty) => void
  onChangePartySize: (next: number) => void
  onClose: () => void
}): React.JSX.Element {
  // `MediaScope` 안에서 `--color-surface` 로 재선언되는 그 값이다([[ADR-064]] 결정 5) — 파생
  // 함수를 다시 부르지 않는다(`deriveMediaScope` 의 입력이 곧 이 토큰이다).
  const { definition } = useThemeAppearance()
  const mediaSurface = definition.mediaSurface

  const portraitUrl = getBossPortraitUrl(props.portraitSlug)
  // 카드 bleed 와 **같은 표**다(`boss-portrait-crops.json`) — 원형 초상의 `…-icon-crops` 가 아니다.
  const crop = getBossPortraitCrop(props.portraitSlug)

  return (
    // align="center": 이 모달은 키보드를 띄우지 않는다(`Modal` 기본은 'top').
    // Modal.Panel: 일러스트가 모서리까지 가야 해서 카드 껍데기(p-6)를 쓰지 않고 직접 두른다.
    <Modal onClose={props.onClose} align="center" testId="party-size-modal">
      <Modal.Panel maxWidth="max-w-2xs">
        {/* 스크림 위 테두리 톤다운([[ADR-122]])을 **이 View 가 직접** 쓴다 — RN 에는
            `.panel-on-scrim-parent > *` 짝이 없다(`Modal.tsx` 의 `ModalPanel` 주석). 안쪽
            `border-t` 는 표면 위 구분선이라 대상이 아니다. */}
        <View className="overflow-hidden rounded-[14px] border border-panel-border bg-surface">
          {/* 히어로 — 카드와 같은 bleed 레시피([[ADR-018]]). `MediaScope` 안이라 `bg-surface`·
              `text-text` 가 media-* 로 해석된다([[ADR-064]] 결정 5). */}
          <MediaScope className="relative h-22 overflow-hidden bg-surface">
            {/* 일러스트 없는 보스(`portraitSlug: null`)는 히어로를 **비운다** — 폴백 디자인을 따로
                만들지 않는다(`boss-scheduler.md`). 그 판정은 `FadedIllustration` 가 이미 갖고 있어
                여기서 다시 `null` 을 검사하지 않는다.

                **감싸지 않는다.** 아트와 베일이 둘 다 `absolute inset-0` 이라 흐름 자식인 래퍼로
                감싸면 그 래퍼가 크기 0 인 상자가 되어 기준이 히어로에서 그리로 옮겨간다(그림이
                사라진다). 그래서 화면 전용 testID(`party-size-modal-art`)도 함께 없어지고,
                이 자리의 계약은 공용 `faded-illustration` 가 나른다. */}
            <FadedIllustration source={portraitUrl} crop={crop} variant="hero" />

            {/* 글자를 앉히는 베일 — 하드코딩 rgba 가 아니라 스코프의 표면색을 쓴다. */}
            <LinearGradient
              className="absolute inset-0"
              colors={[mediaSurface, 'transparent']}
              locations={[0, 0.62]}
              start={{ x: 0, y: 1 }}
              end={{ x: 0, y: 0 }}
            />

            <Pressable
              role="button"
              onPress={props.onClose}
              aria-label="닫기"
              className="absolute right-2.5 top-2.5 h-8 w-8 items-center justify-center rounded-full"
              style={{ backgroundColor: withAlpha(mediaSurface, 0.6) }}
            >
              <XIcon className="h-[17px] w-[17px] text-text" strokeWidth={2} aria-hidden />
            </Pressable>

            <View className="absolute inset-x-[18px] bottom-3">
              <Text
                className="text-10 font-bold tracking-[.16em] text-text-muted"
                style={ILLUSTRATION_TEXT_SHADOW_STYLE}
              >
                {props.cycleLabel}
              </Text>
              <Text
                className="text-xl font-extrabold tracking-[-.02em] text-text"
                style={ILLUSTRATION_TEXT_SHADOW_STYLE}
              >
                {props.bossName}
              </Text>
            </View>
          </MediaScope>

          <View className="gap-[18px] border-t border-border p-[18px]">
            <View>
              <Text className="mb-2.5 text-xs font-bold tracking-[.06em] text-text-muted">난이도</Text>
              <DifficultySegment
                difficulties={props.difficulties}
                selected={props.difficulty}
                onSelect={props.onSelectDifficulty}
              />
            </View>

            <View>
              <View className="mb-2.5 flex-row items-center justify-between gap-2.5">
                <View className="flex-row items-center gap-1.5">
                  <UsersIcon className="h-3.5 w-3.5 text-text-muted" strokeWidth={2} aria-hidden />
                  <Text className="text-xs font-bold tracking-[.06em] text-text-muted">파티 인원</Text>
                </View>
                {/* 주간 n/12 배지와 같은 컴포넌트다 — 신규 스타일을 만들지 않는다. */}
                <Badge variant="primary" style={TABULAR_NUMS}>
                  {props.partySize} / {props.maxPartySize}
                </Badge>
              </View>
              <PartySizeStepper
                label={props.bossName}
                value={props.partySize}
                max={props.maxPartySize}
                onChange={props.onChangePartySize}
              />
            </View>
          </View>
        </View>
      </Modal.Panel>
    </Modal>
  )
}
