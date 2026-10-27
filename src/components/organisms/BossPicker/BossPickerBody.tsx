/**
 * 보스 고르기의 본문. 캐릭터 자리와 `모든 보스` 토글, 그 아래 보스 타일 묶음.
 *
 * 묶음마다 흰 카드에 5열로 타일을 놓는다. 고른 타일은 초상 오른쪽 아래에 체크 원이 붙는다. 다시 누르면 빠진다.
 * 파티 스케줄과 주간 보스 수익 계산기가 함께 쓰고, 화면마다 다른 것(캐릭터 자리 · 묶음 · 잠긴 타일)은 여는 쪽이 넘긴다.
 */
import { useRef, useState } from 'react'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated'
import { Pressable, View } from 'react-native'

import { CheckIcon, Switch, Text } from '../../atoms'
import { BossPortrait } from '../../molecules/BossPortrait/BossPortrait'
import type { PickerTile } from '../../../features/party-appointments/boss-picker'
import { bossAliasOf, bossPortraitSlugOf } from '../../../lib/boss/bosses'
import type { PopoverAnchorRect } from '../../../hooks/useAnchoredPopover'
import { useThemeAppearance } from '../../../theme/context'
import type { Flight } from './BossPickerTray'

/** 타일 초상 한 변. 한 줄에 다섯이 선다 */
export const TILE_PORTRAIT = 48

/** 타일 묶음 하나. `onlyWithAll` 이면 `모든 보스` 토글을 켰을 때만 선다 */
export interface BossPickerTileGroup {
  key: string
  label: string
  tiles: readonly PickerTile[]
  onlyWithAll?: boolean
}

export interface BossPickerBodyProps {
  /** 첫 줄 왼쪽. 파티 스케줄은 캐릭터 드롭다운, 계산기는 바꿀 수 없는 캐릭터다 */
  character: React.ReactNode
  /** `모든 보스` 토글을 캐릭터 아랫줄에 둔다. 파티 스케줄의 드롭다운은 화면 폭을 다 써야 해서 한 줄에 둘 수 없다 */
  toggleBelow?: boolean
  groups: readonly BossPickerTileGroup[]
  isSelected: (tile: PickerTile) => boolean
  /** 고를 수 없는 타일. 흐리게 그리고 눌러도 부르지 않는다 */
  isLocked?: (tile: PickerTile) => boolean
  /**
   * 누른 타일 초상의 창 기준 자리와 그것을 다시 재는 손잡이. 선택 줄로 날아가는 그림이 여기서 출발한다
   */
  onPressTile: (tile: PickerTile, from: PopoverAnchorRect, measureFrom: Flight['measureFrom']) => void
}

/** 누르면 주황 고리가 0.35초 동안 12 만큼 퍼지며 사라진다 */
const PULSE_MS = 350
const PULSE_SPREAD = 12
/** 체크 원 지름. 카드 색 고리 3 을 둘러 초상에서 떼어 낸다 */
const CHECK_SIZE = 22
const CHECK_GAP = 3
/** 잠긴 타일의 진하기 */
const LOCKED_OPACITY = 0.35

function Tile(props: {
  tile: PickerTile
  selected: boolean
  locked: boolean
  onPress: (from: PopoverAnchorRect, measureFrom: Flight['measureFrom']) => void
}): React.JSX.Element {
  const { tile, selected, locked } = props
  const name = bossAliasOf(tile.bossKey, tile.bossKey)
  const { definition } = useThemeAppearance()
  // 누른 좌표로 되짚지 않고 초상을 직접 잰다. 누름의 locationX 는 손가락이 닿은 안쪽 그림 기준이라 어긋난다.
  const portraitRef = useRef<View>(null)

  const pulse = useSharedValue(0)
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value === 0 ? 0 : 0.6 * (1 - pulse.value),
    transform: [{ scale: 1 + (PULSE_SPREAD * 2 * pulse.value) / TILE_PORTRAIT }],
  }))

  return (
    <Pressable
      role="button"
      aria-label={selected ? `${name} 빼기` : `${name} 고르기`}
      aria-selected={selected}
      disabled={locked}
      onPress={() => {
        if (!selected) {
          pulse.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) })))
        }
        const measureFrom: Flight['measureFrom'] = (done) =>
          portraitRef.current?.measureInWindow((left, top, width, height) => done({ left, top, width, height }))
        measureFrom((rect) => props.onPress(rect, measureFrom))
      }}
      // RN 의 `disabled` 는 모양을 바꾸지 않는다. 흐리지 않으면 고를 수 없는 타일이 멀쩡해 보인다.
      style={locked ? { opacity: LOCKED_OPACITY } : undefined}
      className="w-1/5 items-center gap-1.5 pb-3"
    >
      <View ref={portraitRef}>
        {/* 자리 · 모양은 바깥 View, 움직임만 Animated.View. 둘을 한 배열로 주면 정적 쪽이 버려진다. */}
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: TILE_PORTRAIT, height: TILE_PORTRAIT }}>
          <Animated.View style={pulseStyle}>
            <View
              style={{
                width: TILE_PORTRAIT,
                height: TILE_PORTRAIT,
                borderRadius: TILE_PORTRAIT / 2,
                borderWidth: 3,
                borderColor: definition.primary,
              }}
            />
          </Animated.View>
        </View>
        <BossPortrait portraitSlug={bossPortraitSlugOf(tile.bossKey)} label={name} size={TILE_PORTRAIT} />
        {selected && (
          <View
            testID={`boss-picker-check-${tile.bossKey}`}
            pointerEvents="none"
            className="absolute items-center justify-center rounded-full bg-primary"
            style={{
              right: -CHECK_GAP,
              bottom: -CHECK_GAP,
              width: CHECK_SIZE,
              height: CHECK_SIZE,
              boxShadow: `0 0 0 ${CHECK_GAP}px ${definition.surface}`,
            }}
          >
            <CheckIcon className="h-3 w-3 text-on-primary" strokeWidth={4} aria-hidden />
          </View>
        )}
      </View>
      <Text className={`text-xs ${selected ? 'font-bold text-text' : 'font-medium text-text-muted'}`}>{name}</Text>
    </Pressable>
  )
}

function TileGroup(props: {
  group: BossPickerTileGroup
  isSelected: BossPickerBodyProps['isSelected']
  isLocked: BossPickerBodyProps['isLocked']
  onPressTile: BossPickerBodyProps['onPressTile']
}): React.JSX.Element | null {
  if (props.group.tiles.length === 0) return null
  return (
    // 테두리 없이 카드와 시트 바탕의 색 차이로 묶음을 가른다.
    <View className="rounded-[22px] bg-surface px-3 pb-1 pt-3.5">
      <Text className="px-1.5 pb-2.5 text-13 font-bold text-text">{props.group.label}</Text>
      <View className="flex-row flex-wrap">
        {props.group.tiles.map((tile) => (
          <Tile
            key={tile.bossKey}
            tile={tile}
            selected={props.isSelected(tile)}
            locked={props.isLocked?.(tile) === true}
            onPress={(from, measureFrom) => props.onPressTile(tile, from, measureFrom)}
          />
        ))}
      </View>
    </View>
  )
}

export function BossPickerBody(props: BossPickerBodyProps): React.JSX.Element {
  const [showAll, setShowAll] = useState(false)
  const toggle = (
    <Switch size="sm" on={showAll} label="모든 보스" onToggle={() => setShowAll(!showAll)} className="gap-2">
      <Text className="text-xs font-semibold text-text-muted">모든 보스</Text>
    </Switch>
  )

  return (
    <View className="gap-3 px-4">
      {props.toggleBelow === true ? (
        <>
          <View testID="boss-picker-character-row">{props.character}</View>
          <View className="items-end">{toggle}</View>
        </>
      ) : (
        <View testID="boss-picker-character-row" className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1">{props.character}</View>
          {toggle}
        </View>
      )}
      {props.groups
        .filter((group) => group.onlyWithAll !== true || showAll)
        .map((group) => (
          <TileGroup
            key={group.key}
            group={group}
            isSelected={props.isSelected}
            isLocked={props.isLocked}
            onPressTile={props.onPressTile}
          />
        ))}
    </View>
  )
}
