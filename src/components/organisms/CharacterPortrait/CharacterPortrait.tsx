/**
 * 얼굴 원 + 그 둘레의 링. 규격이 둘이고 **프롭이 갈래마다 다르다**.
 *
 * - `rail` 68×70. 아래에 곡선 글자 한 줄이 서고, 눌러서 캐릭터를 고른다
 * - `compact` 40×40. 글자가 없고 링이 처치 한도만큼 쪼개진다
 *
 * 치수·링 모양·글자 유무·누를 수 있는지가 전부 짝지어 움직인다. 프롭을 한 벌로 합치면
 * `compact` + 곡선 글자 같은 못 쓰는 조합이 타입에 남는다.
 *
 * 이 파일은 조립만 한다. 얼굴은 `CharacterAvatar`, 링은 `PortraitRing`, 글자는 `PortraitCaption`,
 * 치수는 `portrait-metrics` 가 갖는다.
 *
 * @see. 규격 둘이 한 부품이 된 경위.
 */
import { Pressable, View } from 'react-native'

import { Svg } from '../../../lib/nativewind-interop'
import { useThemeAppearance } from '../../../theme/context'
import { Text } from '../../atoms'
import { CharacterAvatar } from '../../molecules/CharacterAvatar/CharacterAvatar'
import { PORTRAIT_COMPACT, PORTRAIT_RAIL } from './portrait-metrics'
import { PortraitCaption } from './PortraitCaption'
import { EmptyRing, ProgressArc, SegmentedRing, type PortraitRingProgress } from './PortraitRing'

/** 안 고른 칸의 불투명도. 0.45 는 칸이 여섯을 넘으면 안 잡혔다. */
const SELECTED_DIM_OPACITY = 0.3

interface CommonProps {
  characterName: string
  imageUrl: string | null
}

export interface RailPortraitProps extends CommonProps {
  variant: 'rail'
  /** 곡선 글자가 따라가는 호의 id 재료. 칸마다 달라야 한다. */
  ocid: string
  /** `null` 이면 레벨 글자를 비운다. 모르는 것을 아는 척하지 않는다. */
  level: number | null
  /** 0개면 링 없음, 1개면 온전한 원, 2개면 좌·우 반원. 셋 이상은 못 읽어서 안 받는다. */
  rings: [] | [PortraitRingProgress] | [PortraitRingProgress, PortraitRingProgress]
  isSelected: boolean
  onPress: () => void
}

export interface CompactPortraitProps extends CommonProps {
  variant: 'compact'
  /** 링이 이 값만큼 쪼개진다. `label` 은 읽어 주는 주기(`주간`·`월간`)다. */
  clears: { cleared: number; total: number; label: string }
}

export type CharacterPortraitProps = RailPortraitProps | CompactPortraitProps

export function CharacterPortrait(props: CharacterPortraitProps): React.JSX.Element {
  if (props.variant === 'compact') return <CompactPortrait {...props} />
  return <RailPortrait {...props} />
}

/**
 * 그림이 없을 때의 머리글자. 바탕이 있어야 얼굴이 없다는 것이 읽힌다.
 *
 * 글자 크기를 호출부가 정한다. 규격마다 다르고(레일 14 · compact 12) 여기서 하나로 고르면 화면이
 * 바뀐다. 통일할지는 의 열린 질문이다.
 */
function InitialFallback(props: {
  name: string
  textClass: string
  testID?: string
}): React.JSX.Element {
  return (
    <View testID={props.testID} className="h-full w-full items-center justify-center bg-surface-2">
      <Text fixed className={`font-bold text-text ${props.textClass}`}>
        {props.name.charAt(0)}
      </Text>
    </View>
  )
}

function CompactPortrait(props: CompactPortraitProps): React.JSX.Element {
  return (
    // 링을 얼굴 상자 안에 못 넣는다. `overflow-hidden` 이 stroke 바깥 절반을 자른다. 슬롯 크기가
    // 클래스가 아니라 표에서 오는 것은 `SegmentedRing` 이 같은 값을 읽기 때문이다.
    <View
      className="relative shrink-0 items-center justify-center"
      style={{ width: PORTRAIT_COMPACT.slot, height: PORTRAIT_COMPACT.slot }}
    >
      <CharacterAvatar
        imageTestID="character-portrait-image"
        imageUrl={props.imageUrl}
        name={props.characterName}
        size={PORTRAIT_COMPACT.faceSize}
        className="bg-surface-2"
        fallback={<InitialFallback name={props.characterName} textClass="text-xs" />}
      />
      <SegmentedRing
        cleared={props.clears.cleared}
        total={props.clears.total}
        label={props.clears.label}
      />
    </View>
  )
}

function RailPortrait(props: RailPortraitProps): React.JSX.Element {
  const { definition } = useThemeAppearance()

  const ringLabel = (ring: PortraitRingProgress): string =>
    `${ring.label} ${ring.completed}/${ring.total}`
  // 링이 없으면 읽어 줄 진행도 없다.
  const ringsLabel = props.rings.length === 0 ? '' : `, ${props.rings.map(ringLabel).join(' · ')}`

  return (
    <Pressable
      testID="character-portrait"
      role="button"
      aria-selected={props.isSelected}
      aria-label={`${props.level !== null ? `Lv.${props.level} ` : ''}${props.characterName}${ringsLabel}`}
      onPress={props.onPress}
      // 고른 칸은 그대로 두고 나머지를 흐리게 한다. 레이아웃은 안 움직인다.
      style={{
        opacity: props.isSelected ? 1 : SELECTED_DIM_OPACITY,
        width: PORTRAIT_RAIL.slotW,
        height: PORTRAIT_RAIL.slotH,
      }}
    >
      {/* 링과 글자가 위에 그려져야 해서 얼굴이 SVG 아래에 깔린다. 상자 가운데가 아니라 원 중심에
          앉는다(`PORTRAIT_RAIL.centerY`). */}
      <View
        className="absolute"
        style={{
          top: PORTRAIT_RAIL.centerY - PORTRAIT_RAIL.faceSize / 2,
          left: (PORTRAIT_RAIL.slotW - PORTRAIT_RAIL.faceSize) / 2,
        }}
      >
        <CharacterAvatar
          testID="portrait-face"
          imageTestID="character-portrait-image"
          imageUrl={props.imageUrl}
          name={props.characterName}
          size={PORTRAIT_RAIL.faceSize}
          fallback={
            <InitialFallback
              testID="portrait-face-fallback"
              name={props.characterName}
              textClass="text-sm"
            />
          }
        />
      </View>

      <View pointerEvents="none" className="absolute inset-0">
        <Svg
          width={PORTRAIT_RAIL.slotW}
          height={PORTRAIT_RAIL.slotH}
          viewBox={`0 0 ${PORTRAIT_RAIL.slotW} ${PORTRAIT_RAIL.slotH}`}
        >
          {props.rings.length === 0 && (
            <EmptyRing color={props.isSelected ? definition.primary : definition.border} />
          )}

          {props.rings.length === 1 && (
            <ProgressArc
              half="full"
              progress={props.rings[0]}
              color={definition.primary}
              track={definition.border}
            />
          )}

          {props.rings.length === 2 && (
            <>
              {/* 왼쪽이 일간, 오른쪽이 주간. 둘 다 12시에서 시작해 아래로 찬다. */}
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

          <PortraitCaption
            pathId={`portrait-text-${props.ocid}`}
            level={props.level}
            characterName={props.characterName}
            color={definition.text}
          />
        </Svg>
      </View>
    </Pressable>
  )
}
