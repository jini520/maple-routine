/**
 * 보스 추가 단계 첫 줄의 캐릭터 드롭다운. 파티 스케줄은 여러 캐릭터의 보스를 한 번에 고르므로 단계 안에서 캐릭터를 바꾼다.
 */
import { useEffect, useRef } from 'react'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated'
import { Pressable, View } from 'react-native'

import { Text } from '../../components/atoms'
import { CharacterAvatar } from '../../components/molecules/CharacterAvatar/CharacterAvatar'
import { SelectChevron, SelectField } from '../../components/organisms/SelectField/SelectField'

export interface PickerCharacter {
  ocid: string
  name: string
  level: number | null
  /** 캐릭터 얼굴 그림 URL */
  imageUrl: string | null
  registeredCount: number
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

export function PickerCharacterSelect(props: {
  characters: readonly PickerCharacter[]
  ocid: string
  onSelect: (ocid: string) => void
}): React.JSX.Element {
  const current = props.characters.find((character) => character.ocid === props.ocid)

  return (
    <SelectField
      label="캐릭터"
      testID="boss-picker-character"
      tall
      options={props.characters.map((character) => ({ value: character.ocid, label: character.name }))}
      selected={props.ocid}
      onSelect={(value) => {
        if (value !== null) props.onSelect(value)
      }}
      renderTrigger={(open, isOpen) => (
        <Pressable
          role="button"
          aria-label="캐릭터 고르기"
          onPress={open}
          className="flex-1 flex-row items-center gap-2.5 active:opacity-60"
        >
          <CharacterFace ocid={props.ocid} name={current?.name ?? ''} imageUrl={current?.imageUrl ?? null} />
          <Text className="text-sm font-semibold text-text">{current?.name ?? ''}</Text>
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
  )
}
