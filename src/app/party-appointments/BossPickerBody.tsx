/**
 * 보스 추가 단계의 본문. 캐릭터 드롭다운 · `모든 보스 보기` 스위치 · 보스 타일 묶음(파티 → 스케줄러 → 모든 보스).
 *
 * 타일에는 초상과 이름만 둔다. 고른 타일은 흐리게 두고 `선택됨` 을 얹는다. 다시 누르면 빠진다.
 */
import { useEffect, useRef, useState } from 'react'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated'
import { Pressable, View } from 'react-native'

import { Switch, Text } from '../../components/atoms'
import { BossPortrait } from '../../components/molecules/BossPortrait/BossPortrait'
import { CharacterAvatar } from '../../components/molecules/CharacterAvatar/CharacterAvatar'
import { SelectChevron, SelectField } from '../../components/organisms/SelectField/SelectField'
import { isPicked, type BossPickerSections, type PickerTile } from '../../features/party-appointments/boss-picker'
import { bossAliasOf, bossPortraitSlugOf } from '../../lib/boss/bosses'
import type { PopoverAnchorRect } from '../../hooks/useAnchoredPopover'
import { useThemeAppearance } from '../../theme/context'
import type { PartyAppointmentBoss } from '../../types/party-appointment'
import type { Flight } from './BossPickerTray'

/** 타일 초상 한 변. 한 줄에 다섯이 선다 */
export const TILE_PORTRAIT = 48

export interface PickerCharacter {
  ocid: string
  name: string
  level: number | null
  /** 캐릭터 얼굴 그림 URL */
  imageUrl: string | null
  registeredCount: number
}

export interface BossPickerBodyProps {
  characters: readonly PickerCharacter[]
  ocid: string
  onSelectCharacter: (ocid: string) => void
  sections: BossPickerSections
  picked: readonly PartyAppointmentBoss[]
  /**
   * 누른 타일 초상의 창 기준 자리와 그것을 다시 재는 손잡이. 선택 줄로 날아가는 그림이 여기서 출발한다
   */
  onPressTile: (tile: PickerTile, from: PopoverAnchorRect, measureFrom: Flight['measureFrom']) => void
}

/** 시안과 같은 값. 누르면 주황 고리가 0.35초 동안 12 만큼 퍼지며 사라지고, 0.26초 뒤에 `선택됨` 으로 흐려진다 */
const PULSE_MS = 350
const PULSE_SPREAD = 12
const SELECTED_DELAY_MS = 260

function Tile(props: {
  tile: PickerTile
  selected: boolean
  onPress: (from: PopoverAnchorRect, measureFrom: Flight['measureFrom']) => void
}): React.JSX.Element {
  const { tile, selected } = props
  const name = bossAliasOf(tile.bossKey, tile.bossKey)
  const { definition } = useThemeAppearance()
  // 누른 좌표로 되짚지 않고 초상을 직접 잰다. 누름의 locationX 는 손가락이 닿은 안쪽 그림 기준이라 어긋난다.
  const portraitRef = useRef<View>(null)
  // 고르는 순간에는 밝은 채로 두어 고리가 보이게 하고, 조금 뒤에 흐린다. 빼는 것은 바로 밝힌다.
  const [settled, setSettled] = useState(selected)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(selected), selected ? SELECTED_DELAY_MS : 0)
    return () => clearTimeout(timer)
  }, [selected])
  const shownSelected = selected && settled

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
      onPress={() => {
        if (!selected) {
          pulse.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) })))
        }
        const measureFrom: Flight['measureFrom'] = (done) =>
          portraitRef.current?.measureInWindow((left, top, width, height) => done({ left, top, width, height }))
        measureFrom((rect) => props.onPress(rect, measureFrom))
      }}
      className="w-1/5 items-center gap-1 pb-3"
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
        <View style={{ opacity: shownSelected ? 0.45 : 1 }}>
          <BossPortrait portraitSlug={bossPortraitSlugOf(tile.bossKey)} label={name} size={TILE_PORTRAIT} />
        </View>
      </View>
      {shownSelected && (
        // 흐린 초상 위에 또렷하게 얹는다. 초상과 같이 흐려지면 왜 흐린지가 안 읽힌다.
        <View className="absolute items-center justify-center" style={{ top: 0, height: TILE_PORTRAIT }}>
          <View className="rounded-full bg-surface px-1.5 py-0.5">
            <Text className="text-9 font-bold text-text">선택됨</Text>
          </View>
        </View>
      )}
      <Text className={`text-11 font-semibold ${shownSelected ? 'text-text-muted' : 'text-text'}`} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  )
}

function TileGroup(props: {
  label: string
  tiles: readonly PickerTile[]
  ocid: string
  picked: readonly PartyAppointmentBoss[]
  onPressTile: BossPickerBodyProps['onPressTile']
}): React.JSX.Element | null {
  if (props.tiles.length === 0) return null
  return (
    <View className="gap-2">
      <Text className="text-11 font-semibold text-text-muted">{props.label}</Text>
      <View className="flex-row flex-wrap">
        {props.tiles.map((tile) => (
          <Tile
            key={tile.bossKey}
            tile={tile}
            selected={isPicked(props.picked, props.ocid, tile.bossKey)}
            onPress={(from, measureFrom) => props.onPressTile(tile, from, measureFrom)}
          />
        ))}
      </View>
    </View>
  )
}

/** 드롭다운의 캐릭터 얼굴. 캐릭터가 바뀌면 작아졌다가 넘치듯 커지며 새 얼굴이 든다 */
function CharacterFace(props: { ocid: string; name: string; imageUrl: string | null }): React.JSX.Element {
  const scale = useSharedValue(1)
  const lastOcid = useRef(props.ocid)
  useEffect(() => {
    if (lastOcid.current !== props.ocid) {
      scale.set(
        withSequence(
          withTiming(0.3, { duration: 0 }),
          withTiming(1.3, { duration: 190, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 190, easing: Easing.bezier(0.3, 1.6, 0.5, 1) }),
        ),
      )
    }
    lastOcid.current = props.ocid
  }, [props.ocid, scale])
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <Animated.View style={style}>
      <CharacterAvatar imageUrl={props.imageUrl} name={props.name} size={22} className="bg-surface-2" />
    </Animated.View>
  )
}

export function BossPickerBody(props: BossPickerBodyProps): React.JSX.Element {
  const [showAll, setShowAll] = useState(false)
  const current = props.characters.find((character) => character.ocid === props.ocid)

  return (
    <View className="gap-4 px-4">
      <SelectField
        label="캐릭터"
        testID="boss-picker-character"
        bare
        options={props.characters.map((character) => ({ value: character.ocid, label: character.name }))}
        selected={props.ocid}
        onSelect={(value) => {
          if (value !== null) props.onSelectCharacter(value)
        }}
        renderTrigger={(open, isOpen) => (
          <Pressable
            role="button"
            aria-label="캐릭터 고르기"
            onPress={open}
            className="flex-1 flex-row items-center gap-2.5 active:opacity-60"
          >
            <CharacterFace ocid={props.ocid} name={current?.name ?? ''} imageUrl={current?.imageUrl ?? null} />
            <Text className="text-15 font-bold text-text">{current?.name ?? ''}</Text>
            {current?.level != null && <Text className="text-xs text-text-muted">Lv.{current.level}</Text>}
            <View className="ml-auto">
              <SelectChevron open={isOpen} />
            </View>
          </Pressable>
        )}
        renderOption={(option, isSelected) => {
          const character = props.characters.find((one) => one.ocid === option.value)
          return (
            <View className="flex-row items-center gap-2.5">
              <CharacterAvatar
                imageUrl={character?.imageUrl ?? null}
                name={option.label}
                size={20}
                className="bg-surface-2"
              />
              <Text className={`text-sm font-semibold ${isSelected ? 'text-primary-ink' : 'text-text'}`}>
                {option.label}
              </Text>
              {character?.level != null && <Text className="text-11 text-text-muted">Lv.{character.level}</Text>}
              <Text className="ml-auto text-11 text-text-muted">보스 {character?.registeredCount ?? 0}</Text>
            </View>
          )
        }}
      />
      <Switch on={showAll} label="모든 보스 보기" onToggle={() => setShowAll(!showAll)} className="justify-between">
        <Text className="text-13 text-text">모든 보스 보기</Text>
      </Switch>
      <TileGroup label="파티" tiles={props.sections.party} {...props} />
      <TileGroup label="스케줄러" tiles={props.sections.scheduler} {...props} />
      {showAll && <TileGroup label="모든 보스" tiles={props.sections.all} {...props} />}
    </View>
  )
}
