// 초상화 한 칸 — 얼굴 원 + 진행 링 + 아래 곡선 글자 **한 줄**([[ADR-142]] 결정 2·3·5 · 정정 1·2).
//
// 기하는 전부 `character-portrait-geometry.ts` 가 갖는다(그 파일이 «왜 이 반지름인가» 를 적는다).
// 여기서는 그 값들을 **어떤 순서로 그리는지**만 정한다.
//
// ── 이 파일이 밟는 함정 셋 ────────────────────────────────────────────────────────
//
// ① **링 색이 `className` 이 아니라 `stroke` 프롭이다.** `react-native-svg` 의 도형은
//    `cssInterop` 에 등록돼 있지 않고, 등록해도 `currentColor` 한 색만 통한다 — 한 `<Svg>` 안에서
//    네 색(찬 호 둘 · 트랙 · 글자)을 쓰므로 테마에서 직접 읽는다(`CharacterAvatar` 가 먼저 밟았다).
// ② **`TextPath` 는 `Defs` 안의 `Path` 를 id 로 찾는다.** id 가 화면 안에서 겹치면 둘 중 하나가
//    엉뚱한 호를 따라가므로 **ocid 로 유일하게** 만든다(레일에 같은 컴포넌트가 여러 벌 뜬다).
// ③ **얼굴 크롭의 기준 상자는 얼굴 원(40px)이지 슬롯이 아니다.** 슬롯을 기준으로 잡으면 크롭이
//    밀린다([[ADR-015]] 기법 그대로 — `boss-profit/CharacterAvatar` 와 같은 함정).
import { Image, Pressable, Text, View, type ImageStyle } from 'react-native'
import { Circle, Defs, Path, TextPath, Text as SvgText } from 'react-native-svg'

import { Svg } from '../../../lib/nativewind-interop'
import { useThemeAppearance } from '../../../theme/context'
import {
  PORTRAIT_CENTER_X,
  PORTRAIT_CENTER_Y,
  PORTRAIT_FACE_SIZE,
  PORTRAIT_TEXT_FONT_SIZE,
  PORTRAIT_RING_R,
  PORTRAIT_RING_STROKE,
  PORTRAIT_SLOT_W,
  isFullTurn,
  portraitMetrics,
  portraitRingArcPath,
  portraitRingSpan,
  portraitTextArcPath,
  portraitTextOffsetPercent,
  ringRatio,
} from './character-portrait-geometry'

/** 링 한 칸이 받는 값 — 화면이 «무엇을 세었는지» 까지 들고 온다(접근성 이름이 그것을 말한다). */
export interface PortraitRingProgress {
  /** `일간`·`주간`·`월간` — 접근성 이름에 그대로 들어간다. */
  label: string
  completed: number
  total: number
}

export interface CharacterPortraitProps {
  ocid: string
  characterName: string
  /** `null` 이면 레벨 글자를 비운다 — 캐시가 아직 모르는 것을 아는 척하지 않는다([[ADR-142]] 결정 2). */
  level: number | null
  imageUrl: string | null
  /**
   * **0개면 링을 안 그리고, 1개면 온전한 원, 2개면 좌·우 반원**([[ADR-142]] 정정 1·8).
   *
   * 컨텐츠 스케줄러는 둘(왼쪽 일간 · 오른쪽 주간), 보스 스케줄러는 하나(주간), **관리 화면 둘은
   * 없음**이다 — 거기서는 캐릭터를 고르는 것이 일이지 진행을 보는 자리가 아니다. 셋 이상은 받지
   * 않는다(반원을 더 쪼개면 못 읽는다).
   *
   * 링이 없으면 글자가 얼굴 쪽으로 들어오고 칸도 낮아진다(`portraitMetrics`).
   */
  rings: [] | [PortraitRingProgress] | [PortraitRingProgress, PortraitRingProgress]
  isSelected: boolean
  onPress: () => void
}

// 원본 전신 이미지에서 얼굴만 확대해 쓴다([[ADR-015]]) — 크롭 박스와 원본 크기는 보스 수익의
// 아바타와 **같은 값**이고 슬롯 크기만 다르다. 값을 따로 정하면 같은 얼굴이 화면마다 다르게 잘린다.
const SOURCE_IMAGE_SIZE = 300
const FACE_CROP_BOX = { x: 123, y: 128, size: 48 }

function portraitFaceCropStyle(): ImageStyle {
  const scale = PORTRAIT_FACE_SIZE / FACE_CROP_BOX.size
  return {
    position: 'absolute',
    width: SOURCE_IMAGE_SIZE * scale,
    height: SOURCE_IMAGE_SIZE * scale,
    left: -FACE_CROP_BOX.x * scale,
    top: -FACE_CROP_BOX.y * scale,
  }
}

/**
 * 레벨과 이름이 **같은 글자**다(정정 6) — 자리만 다르다. 한 상수로 묶어 둬야 한쪽만 바뀌는 일이
 * 안 생긴다(그렇게 갈렸던 것이 이 정정의 이유다).
 */
const CAPTION_FONT_PROPS = { fontSize: PORTRAIT_TEXT_FONT_SIZE, fontWeight: '600' } as const

const RING_STROKE_PROPS = {
  fill: 'none',
  strokeWidth: PORTRAIT_RING_STROKE,
  strokeLinecap: 'round',
} as const

/** 한 바퀴짜리 링 — **호로는 못 그린다**(시작점과 끝점이 같다). 그 자리만 `Circle` 로 간다. */
function FullRing(props: { testID: string; color: string }): React.JSX.Element {
  return (
    <Circle
      testID={props.testID}
      cx={PORTRAIT_CENTER_X}
      cy={PORTRAIT_CENTER_Y}
      r={PORTRAIT_RING_R}
      stroke={props.color}
      {...RING_STROKE_PROPS}
    />
  )
}

/** 트랙(빈 칸) 위에 찬 만큼을 덧그린다 — 구간은 `portraitRingSpan` 이 정한다. */
function ProgressArc(props: {
  half: 'left' | 'right' | 'full'
  progress: PortraitRingProgress
  color: string
  track: string
}): React.JSX.Element {
  const span = portraitRingSpan(props.half)
  const wholeTurn = isFullTurn(span)
  const ratio = ringRatio(props.progress.completed, props.progress.total)
  const filledTo = span.from + (span.to - span.from) * ratio
  const filled = portraitRingArcPath(PORTRAIT_RING_R, span.from, filledTo)

  return (
    <>
      {wholeTurn ? (
        <FullRing testID="portrait-ring-track" color={props.track} />
      ) : (
        <Path
          testID="portrait-ring-track"
          d={portraitRingArcPath(PORTRAIT_RING_R, span.from, span.to)}
          stroke={props.track}
          {...RING_STROKE_PROPS}
        />
      )}

      {/* 100% 를 채운 한 바퀴도 호로는 못 그린다 — 같은 이유로 `Circle` 이다. */}
      {wholeTurn && ratio >= 1 ? (
        <FullRing testID="portrait-ring-fill" color={props.color} />
      ) : (
        filled !== '' && (
          <Path testID="portrait-ring-fill" d={filled} stroke={props.color} {...RING_STROKE_PROPS} />
        )
      )}
    </>
  )
}

export function CharacterPortrait(props: CharacterPortraitProps): React.JSX.Element {
  const { definition } = useThemeAppearance()
  // 함정 ② — 화면에 여러 벌이 뜨므로 id 가 칸마다 달라야 한다.
  const textPathId = `portrait-text-${props.ocid}`
  const { textR, slotH } = portraitMetrics(props.rings.length > 0)

  const ringLabel = (ring: PortraitRingProgress): string =>
    `${ring.label} ${ring.completed}/${ring.total}`
  // 링이 없으면 읽어 줄 진행도 없다 — 이름과 레벨에서 끝난다.
  const ringsLabel = props.rings.length === 0 ? '' : `, ${props.rings.map(ringLabel).join(' · ')}`

  // 얼굴 원은 상자 가운데가 아니라 **원 중심**에 앉는다(정정 1로 원이 위로 붙었다).
  const faceTop = PORTRAIT_CENTER_Y - PORTRAIT_FACE_SIZE / 2



  return (
    <Pressable
      testID="character-portrait"
      role="button"
      aria-selected={props.isSelected}
      aria-label={`${props.level !== null ? `Lv.${props.level} ` : ''}${props.characterName}${ringsLabel}`}
      onPress={props.onPress}
      // 결정 5: 고른 칸은 그대로, 나머지는 흐리게. 레이아웃이 전혀 안 움직인다.
      style={{ opacity: props.isSelected ? 1 : 0.45, width: PORTRAIT_SLOT_W, height: slotH }}
    >
      {/* 얼굴은 SVG 아래에 깔린다 — 링·글자가 그 위에 그려져야 한다. 크롭 기준 상자는 이 원이다(함정 ③). */}
      <View
        style={{
          position: 'absolute',
          top: faceTop,
          left: (PORTRAIT_SLOT_W - PORTRAIT_FACE_SIZE) / 2,
          width: PORTRAIT_FACE_SIZE,
          height: PORTRAIT_FACE_SIZE,
        }}
        className="overflow-hidden rounded-full bg-surface-2"
      >
        {props.imageUrl !== null ? (
          <Image
            testID="character-portrait-image"
            accessibilityLabel={props.characterName}
            source={{ uri: props.imageUrl }}
            style={portraitFaceCropStyle()}
          />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Text className="text-sm font-bold text-text">{props.characterName.charAt(0)}</Text>
          </View>
        )}
      </View>

      <View pointerEvents="none" className="absolute inset-0">
        <Svg width={PORTRAIT_SLOT_W} height={slotH} viewBox={`0 0 ${PORTRAIT_SLOT_W} ${slotH}`}>
          <Defs>
            <Path id={textPathId} d={portraitTextArcPath(textR)} />
          </Defs>

          {props.rings.length === 0 ? null : props.rings.length === 1 ? (
            <ProgressArc
              half="full"
              progress={props.rings[0]}
              color={definition.primary}
              track={definition.border}
            />
          ) : (
            <>
              {/* 왼쪽이 첫 번째(일간), 오른쪽이 두 번째(주간) — 둘 다 12시에서 시작해 아래로 찬다. */}
              <ProgressArc
                half="left"
                progress={props.rings[0]}
                color={definition.primary}
                track={definition.border}
              />
              <ProgressArc
                half="right"
                progress={props.rings[1]}
                color={definition.third}
                track={definition.border}
              />
            </>
          )}

          {/* 정정 2·4·5·6: 레벨과 이름이 **호 하나**(같은 `Path`)를 **같은 글자로** 함께 쓰고,
              가운데에 맞추는 것은
              줄이 아니라 **둘의 경계**다 — 레벨은 6시에서 끝나고(`end`) 이름은 6시에서 시작한다
              (`start`). 줄 전체를 `middle` 로 앉히면 이름이 더 길어 글자가 오른쪽으로 치우친다.
              레벨을 모르면 이름 혼자라 그때는 줄을 가운데에 앉힌다(치우칠 상대가 없다). */}
          {props.level !== null && (
            <SvgText
              testID="portrait-level-text"
              {...CAPTION_FONT_PROPS}
              fill={definition.text}
              // **`textAnchor` 는 `TextPath` 가 아니라 `Text` 에 붙는다** — 자식에 주면
              // `react-native-svg` 가 조용히 버린다(실측: `TextPath` 의 `font` 가 빈 객체로 온다).
              textAnchor="end"
            >
              <TextPath href={`#${textPathId}`} startOffset={portraitTextOffsetPercent('left', textR)}>
                {`Lv.${props.level}`}
              </TextPath>
            </SvgText>
          )}

          <SvgText
            testID="portrait-name-text"
            {...CAPTION_FONT_PROPS}
            fill={definition.text}
            textAnchor={props.level === null ? 'middle' : 'start'}
          >
            <TextPath
              href={`#${textPathId}`}
              startOffset={props.level === null ? '50%' : portraitTextOffsetPercent('right', textR)}
            >
              {props.characterName}
            </TextPath>
          </SvgText>
        </Svg>
      </View>
    </Pressable>
  )
}
