/**
 * 보스 추가 단계의 바닥. `n개 선택됨` 줄과 `n개 추가` 버튼.
 *
 * 고른 보스는 캐릭터별로 묶여 선다. 묶음마다 왼쪽 열에 얼굴 · 이름이 서고 그 오른쪽에 초상이 서며, 묶음 사이를 세로선으로 가른다.
 * 타일을 누르면 그 초상이 그 캐릭터 묶음의 끝 자리로 날아온다. 날아오는 동안 진짜 칸은 숨겨 두었다가 도착하면
 * 드러낸다. 칸을 길게 누르면 떠서 **같은 묶음 안에서** 좌우로 끌어 차례를 바꾸고, 누르면 난이도 팝오버가 열린다.
 */
import { useEffect, useRef, useState } from 'react'
import { Modal, Pressable, View } from 'react-native'
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  runOnJS,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Sortable from 'react-native-sortables'

import { Badge, Text, difficultyOutlineColor } from '../../components/atoms'
import { BossPortrait } from '../../components/molecules/BossPortrait/BossPortrait'
import { DIFFICULTY_NAME } from '../../constants/domain/boss-difficulty'
import { groupBossesByCharacter, moveWithinGroup } from '../../features/party-appointments/boss-groups'
import { bossAliasOf, bossPortraitSlugOf } from '../../lib/boss/bosses'
import { selectionFeedback } from '../../native/haptics'
import type { PopoverAnchorRect } from '../../hooks/useAnchoredPopover'
import type { BossDifficulty } from '../../types'
import type { PartyAppointmentBoss } from '../../types/party-appointment'
import { TILE_PORTRAIT } from './BossPickerBody'
import { CHARACTER_LABEL_WIDTH, CharacterGroupLabel } from './CharacterGroupLabel'

/** 선택 줄 칸의 폭 · 초상 한 변 · 칸 사이 · 줄 좌우 여백 */
const ITEM_WIDTH = 50
const ITEM_PORTRAIT = 40
/** 초상과 테두리 사이의 바탕 틈, 그리고 테두리 두께 */
const RING_GAP = 2
const RING = 2
const SLOT = ITEM_PORTRAIT + (RING_GAP + RING) * 2
const SLOT_GAP = 10
const ROW_PAD = 16
/** 묶음 사이: 틈 · 세로선 1 · 틈 */
const GROUP_GAP = 12
const GROUP_SPACE = GROUP_GAP * 2 + 1
/** 묶음 왼쪽 얼굴 열과 초상 사이. 칸의 가로 자리가 열 폭 + 이만큼 오른쪽이다 */
const LABEL_GAP = 8
/**
 * 날아가는 시간. 시간 곡선은 처음에 느리고 끝에서 감속한다.
 *
 * 시안은 0.52초였다. 날아가는 거리가 시트 높이의 절반이라 이 아래로는 초상이 어디서 와서 어디로
 * 갔는지가 안 읽힌다.
 */
const FLIGHT_MS = 400
const FLIGHT_EASING = Easing.bezier(0.35, 0, 0.25, 1)
/** 넘치듯 튀는 곡선. 도착한 칸 · 난이도를 바꾼 칸 · 버튼 숫자가 쓴다 */
const POP_EASING = Easing.bezier(0.3, 1.6, 0.5, 1)
/** 도착한 칸이 0.4 배에서 드러나는 시간 */
const LAND_MS = 160
/**
 * 첫 보스가 기다렸다 출발하는 시간. 줄이 생기며 바닥이 자라 시트가 통째로 올라가므로(시트 이동 380ms),
 * 출발 자리를 그 전에 재면 초상이 타일의 옛 자리에서 뜬다.
 *
 * 380ms 를 다 기다리지는 않는다. 시트 이동 곡선이 `Easing.out(cubic)` 이라 180ms 면 이동의 89% 가
 * 끝나 있고, 남은 몫은 출발 직전에 타일을 다시 재는 것(`measureFrom`)이 덮는다.
 */
const FIRST_FLIGHT_DELAY_MS = 180

/** 날아오는 중인 초상 하나 */
export interface Flight {
  /** 이 비행을 가르는 값. 같은 보스를 빼고 다시 골라도 새 비행이 된다 */
  id: number
  boss: PartyAppointmentBoss
  from: PopoverAnchorRect
  /** 출발 타일을 다시 잰다. 시트가 자라 타일이 움직였을 때 새 자리에서 출발하려고 */
  measureFrom: (done: (rect: PopoverAnchorRect) => void) => void
}

export interface BossPickerTrayProps {
  picked: PartyAppointmentBoss[]
  /** 캐릭터 `ocid → 이름` */
  names: ReadonlyMap<string, string>
  /** 캐릭터 `ocid → 얼굴 그림 URL` */
  faces: ReadonlyMap<string, string | null>
  flight: Flight | null
  onFlightDone: () => void
  onReorder: (next: PartyAppointmentBoss[]) => void
  /** `index` 는 `picked` 안의 차례 */
  onPressItem: (index: number, anchor: PopoverAnchorRect) => void
  onConfirm: () => void
}

function keyOf(boss: PartyAppointmentBoss): string {
  return `${boss.ocid}:${boss.bossKey}`
}

/**
 * 날아가는 초상. 난이도 배지를 달고 간다. 도착점을 알기 전에는 출발 자리에 떠 있다.
 *
 * 시안의 세 장면을 그대로 잇는다. 출발 · 중간(거리의 45%, 60 위로 뜨고 조금 커진다) · 도착.
 * reanimated 의 `Animated.View` 에 className 을 주면 조용히 사라진다. 스타일만 준다.
 */
function FlyingPortrait(props: {
  flight: Flight
  from: PopoverAnchorRect
  to: { x: number; y: number } | null
  onDone: () => void
}): React.JSX.Element {
  const { flight, to, from } = props
  const progress = useSharedValue(0)
  const left = from.left
  const top = from.top
  const scaleTo = ITEM_PORTRAIT / TILE_PORTRAIT
  // 도착 칸 초상의 가운데로 간다. 크기가 달라 모서리끼리가 아니라 가운데끼리 맞춘다.
  const dx = to === null ? 0 : to.x - from.left + (ITEM_PORTRAIT - TILE_PORTRAIT) / 2
  const dy = to === null ? 0 : to.y - from.top + (ITEM_PORTRAIT - TILE_PORTRAIT) / 2
  const midScale = ((1 + scaleTo) / 2) * 1.15

  useEffect(() => {
    if (to === null) return
    progress.value = withTiming(1, { duration: FLIGHT_MS, easing: FLIGHT_EASING }, (finished) => {
      if (finished) runOnJS(props.onDone)()
    })
    // 도착점이 정해질 때 한 번 출발한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to === null, flight.id])

  const style = useAnimatedStyle(() => {
    const t = progress.value
    return {
      transform: [
        { translateX: interpolate(t, [0, 0.5, 1], [0, dx * 0.45, dx]) },
        { translateY: interpolate(t, [0, 0.5, 1], [0, dy * 0.45 - 60, dy]) },
        { scale: interpolate(t, [0, 0.5, 1], [1, midScale, scaleTo]) },
      ],
    }
  })

  // 창 전체를 덮는 투명 층에 그린다. 출발(타일)과 도착(선택 줄)이 둘 다 창 좌표라 기준점을 빼지 않는다.
  // 자리는 바깥 View 가 잡고 Animated.View 에는 움직임만 준다. 정적 스타일을 함께 주면 그쪽이 버려져
  // 초상이 창 왼쪽 위 구석에 그려졌다(실측).
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent>
      <View pointerEvents="none" style={{ position: 'absolute', left, top, width: TILE_PORTRAIT, height: TILE_PORTRAIT }}>
        <Animated.View style={style}>
          <BossPortrait
            portraitSlug={bossPortraitSlugOf(flight.boss.bossKey)}
            label={bossAliasOf(flight.boss.bossKey, flight.boss.bossKey)}
            size={TILE_PORTRAIT}
          />
          <View style={{ position: 'absolute', bottom: -6, left: 0, right: 0, alignItems: 'center' }}>
            <Badge variant={flight.boss.difficulty as BossDifficulty} size="mini">
              {DIFFICULTY_NAME[flight.boss.difficulty as BossDifficulty] ?? flight.boss.difficulty}
            </Badge>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

/** 선택 줄의 칸 하나. 날아온 초상이 내려앉으면 한 번 튀었다가 멈춘다 */
function TrayItem(props: {
  boss: PartyAppointmentBoss
  index: number
  hidden: boolean
  onPress: BossPickerTrayProps['onPressItem']
}): React.JSX.Element {
  const { boss, index, hidden } = props
  const name = bossAliasOf(boss.bossKey, boss.bossKey)
  // 팝오버가 이 초상 위에 선다. 누름 좌표는 안쪽 그림 기준이라 쓰지 않고 직접 잰다.
  const itemRef = useRef<View>(null)
  const scale = useSharedValue(hidden ? 0.4 : 1)
  const opacity = useSharedValue(hidden ? 0 : 1)
  const wasHidden = useRef(hidden)
  const lastDifficulty = useRef(boss.difficulty)

  // 날아온 초상이 내려앉으면 0.4 배에서 넘치듯 커지며 드러난다.
  useEffect(() => {
    if (wasHidden.current && !hidden) {
      scale.set(withSequence(withTiming(0.4, { duration: 0 }), withTiming(1, { duration: LAND_MS, easing: POP_EASING })))
      opacity.set(withTiming(1, { duration: LAND_MS, easing: POP_EASING }))
    }
    if (hidden) opacity.set(0)
    wasHidden.current = hidden
  }, [hidden, scale, opacity])

  // 난이도를 바꾸면 한 번 튄다.
  useEffect(() => {
    if (lastDifficulty.current !== boss.difficulty) {
      scale.set(withSequence(withTiming(1.2, { duration: 0 }), withTiming(1, { duration: 260, easing: POP_EASING })))
    }
    lastDifficulty.current = boss.difficulty
  }, [boss.difficulty, scale])

  const popStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }))

  return (
    <Pressable
      role="button"
      aria-label={`${name}, 난이도 바꾸기 또는 제거`}
      onPress={() => {
        itemRef.current?.measureInWindow((left, top, width, height) => props.onPress(index, { left, top, width, height }))
      }}
      style={{ width: ITEM_WIDTH }}
    >
      <Animated.View style={popStyle}>
        <View style={{ alignItems: 'center', gap: 3 }}>
        {/* 바탕색 틈 2 + 난이도 색 테두리 2. 캐릭터는 색이 아니라 묶음 왼쪽 얼굴이 알린다. */}
        <View
          ref={itemRef}
          testID={`tray-ring-${keyOf(boss)}`}
          style={{
            width: SLOT,
            height: SLOT,
            borderRadius: SLOT / 2,
            borderWidth: RING,
            borderColor: difficultyOutlineColor(boss.difficulty as BossDifficulty),
            padding: RING_GAP,
          }}
        >
          <BossPortrait portraitSlug={bossPortraitSlugOf(boss.bossKey)} label={name} size={ITEM_PORTRAIT} />
        </View>
        <Badge variant={boss.difficulty as BossDifficulty} size="mini">
          {DIFFICULTY_NAME[boss.difficulty as BossDifficulty] ?? boss.difficulty}
        </Badge>
        </View>
      </Animated.View>
    </Pressable>
  )
}

export function BossPickerTray(props: BossPickerTrayProps): React.JSX.Element {
  const scrollRef = useAnimatedRef<Animated.ScrollView>()
  const [from, setFrom] = useState<{ id: number; rect: PopoverAnchorRect } | null>(null)
  const [target, setTarget] = useState<{ id: number; x: number; y: number } | null>(null)
  const { flight, picked } = props
  const flyingKey = flight === null ? null : keyOf(flight.boss)
  const lastCount = useRef(picked.length)
  const bump = useSharedValue(1)

  // 버튼 숫자가 바뀌면 한 번 튄다.
  useEffect(() => {
    if (picked.length !== lastCount.current && picked.length > 0) {
      bump.value = withSequence(
        withTiming(1.45, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 180, easing: POP_EASING }),
      )
    }
    lastCount.current = picked.length
  }, [picked.length, bump])
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }))

  const rowRef = useRef<View>(null)
  const groups = groupBossesByCharacter(picked)
  /** 묶음마다 잰 폭. 머리 이름이 칸보다 길면 묶음이 칸 줄보다 넓다 */
  const groupWidths = useRef(new Map<string, number>())
  /** 날아가는 동안 줄을 세워 둘 가로 스크롤 자리 */
  const flightScrollX = useRef<number | null>(null)

  /**
   * 새 칸의 도착점. 그 캐릭터 묶음의 끝 자리다. 앞 묶음들의 잰 폭과 칸 크기에서 계산하고, 줄이 넘치면 그 자리가
   * 보이도록 줄을 옮겨 둔다. 칸을 직접 재지 않는 것은 정렬 라이브러리가 내용 폭을 한 박자 늦게 늘려, 잰 순간의
   * 칸이 아직 화면 밖에 있기 때문이다(실측: 그 자리로 내려앉은 뒤 칸이 옆으로 미끄러져 들어왔다).
   */
  function aim(target: Flight): void {
    const at = groups.findIndex((group) => group.ocid === target.boss.ocid)
    if (at < 0) return
    const widthOf = (index: number): number => {
      const group = groups[index]!
      const items = group.bosses.length * ITEM_WIDTH + (group.bosses.length - 1) * SLOT_GAP
      return Math.max(groupWidths.current.get(group.ocid) ?? 0, CHARACTER_LABEL_WIDTH + LABEL_GAP + items)
    }
    let groupX = ROW_PAD
    for (let index = 0; index < at; index += 1) groupX += widthOf(index) + GROUP_SPACE
    const slot = groups[at]!.bosses.findIndex((boss) => keyOf(boss) === keyOf(target.boss))
    const itemX = groupX + CHARACTER_LABEL_WIDTH + LABEL_GAP + slot * (ITEM_WIDTH + SLOT_GAP)
    let contentWidth = ROW_PAD * 2
    for (let index = 0; index < groups.length; index += 1) contentWidth += widthOf(index) + (index > 0 ? GROUP_SPACE : 0)
    rowRef.current?.measureInWindow((rowX, rowY, rowWidth) => {
      const maxScroll = Math.max(0, contentWidth - rowWidth)
      const scrollX = Math.min(maxScroll, Math.max(0, itemX + ITEM_WIDTH + ROW_PAD - rowWidth))
      flightScrollX.current = scrollX
      scrollRef.current?.scrollTo({ x: scrollX, animated: false })
      setTarget({
        id: target.id,
        x: rowX + itemX - scrollX + (ITEM_WIDTH - SLOT) / 2 + RING_GAP + RING,
        y: rowY + 8 + RING_GAP + RING,
      })
    })
  }

  // 비행이 시작되면 초상이 출발 자리에 뜨고 도착점을 잡는다. 첫 보스는 시트가 다 자란 뒤 타일을 다시 재서
  // 그 새 자리에서 뜬다. 그 전에는 초상을 안 그린다.
  useEffect(() => {
    if (flight === null) {
      flightScrollX.current = null
      return
    }
    const first = picked.length === 1
    const timer = setTimeout(
      () => {
        if (!first) {
          setFrom({ id: flight.id, rect: flight.from })
          aim(flight)
          return
        }
        flight.measureFrom((rect) => {
          setFrom({ id: flight.id, rect })
          aim(flight)
        })
      },
      first ? FIRST_FLIGHT_DELAY_MS : 0,
    )
    return () => clearTimeout(timer)
    // 비행 하나에 한 번 잰다. 날아가는 동안 목록이 바뀌어도 도착점을 다시 잡지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight?.id])

  // 들고 들어온 목록에서는 칸 자리를 움직이지 않는다. 단계를 바꾸는 동안 줄이 한 번 더 재어져, 움직이면 칸이
  // 넓게 섰다가 왼쪽으로 미끄러진다. 고르거나 빼서 목록이 바뀐 뒤부터는 남은 칸이 새 자리로 미끄러진다.
  const [enteredWith] = useState(picked)
  const layoutTransition = picked === enteredWith ? 'reorder' : 'all'

  const count = picked.length
  return (
    // 바닥 줄의 좌우 · 위 여백을 걷어 선택 줄이 시트 폭 끝까지 깔린다.
    <View className="-mx-4 -mt-3">
      {count > 0 && (
        // 처음 고를 때 줄이 아래에서 펼쳐진다. 스타일 없는 겉 층에만 애니메이션을 단다(className 함정).
        // 사라질 때는 애니메이션이 없다. 이탈하는 뷰는 배치에서 빠져 제자리에 그려지는데, 바닥 줄이
        // 그 즉시 줄어 그 제자리가 저장 버튼 자리라 초상이 버튼 위로 흘러내렸다.
        <Animated.View testID="tray-row" entering={FadeInDown.duration(260)}>
          <View className="border-t border-border bg-surface">
            <View className="flex-row items-center justify-between px-4 pb-0.5 pt-2">
              <Text className="text-11 font-bold text-text-muted">{count}개 선택됨</Text>
              <Text className="text-11 font-bold text-text-muted">초상화 터치 시 난이도 변경 또는 제거</Text>
            </View>
            <View ref={rowRef}>
              <Animated.ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: ROW_PAD, paddingTop: 8, paddingBottom: 10 }}
                // 날아가는 동안은 내용 폭이 늘 때마다 도착 칸이 보이는 자리로 다시 세운다.
                onContentSizeChange={() => {
                  if (flight !== null && flightScrollX.current !== null) {
                    scrollRef.current?.scrollTo({ x: flightScrollX.current, animated: false })
                  }
                }}
              >
                <View className="flex-row" style={{ gap: GROUP_GAP }}>
                  {groups.map((group, groupIndex) => (
                    <View key={group.ocid} className="flex-row" style={{ gap: GROUP_GAP }}>
                      {groupIndex > 0 && <View className="w-px bg-border" />}
                      <View
                        className="flex-row items-center"
                        style={{ gap: LABEL_GAP }}
                        onLayout={(event) => groupWidths.current.set(group.ocid, event.nativeEvent.layout.width)}
                      >
                        <CharacterGroupLabel
                          name={props.names.get(group.ocid) ?? ''}
                          imageUrl={props.faces.get(group.ocid) ?? null}
                        />
                        {/* 묶음마다 정렬 줄이 따로라, 끌어도 다른 캐릭터 묶음으로는 못 넘어간다. 폭을 미리 박는다. 라이브러리가 칸을
                            재기 전에는 줄 폭이 0 이라 묶음이 접혀, 둘째 칸이 옆 묶음 자리에 그려졌다가 제자리로 옮겨 갔다. */}
                        <View
                          testID={`tray-group-${group.ocid}`}
                          style={{ width: group.bosses.length * ITEM_WIDTH + (group.bosses.length - 1) * SLOT_GAP }}
                        >
                        <Sortable.Flex
                          gap={SLOT_GAP}
                          flexWrap="nowrap"
                          scrollableRef={scrollRef}
                          // 새 칸의 등장은 칸이 직접 한다(0.4 배에서 튄다). 라이브러리 효과가 겹치면 칸이 옆에서 미끄러져 들어온다.
                          itemEntering={null}
                          itemsLayoutTransitionMode={layoutTransition}
                          onOrderChange={() => {
                            'worklet'
                            runOnJS(selectionFeedback)()
                          }}
                          onDragEnd={({ fromIndex, toIndex }) =>
                            props.onReorder(moveWithinGroup(picked, group.ocid, fromIndex, toIndex))
                          }
                        >
                          {group.bosses.map((boss) => (
                            <TrayItem
                              key={keyOf(boss)}
                              boss={boss}
                              index={picked.findIndex((one) => keyOf(one) === keyOf(boss))}
                              hidden={keyOf(boss) === flyingKey}
                              onPress={props.onPressItem}
                            />
                          ))}
                        </Sortable.Flex>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </Animated.ScrollView>
            </View>
          </View>
        </Animated.View>
      )}
      <View className="border-t border-border px-4 pt-2.5">
        <Pressable
          role="button"
          aria-label={count === 0 ? '보스를 선택해주세요' : `${count}개 추가`}
          disabled={count === 0}
          onPress={props.onConfirm}
          className={`items-center rounded-xl py-3 ${count === 0 ? 'bg-surface-2' : 'bg-primary'}`}
        >
          <Animated.View style={bumpStyle}>
            <Text className={`text-sm font-bold ${count === 0 ? 'text-text-disabled' : 'text-on-primary'}`}>
              {count === 0 ? '보스를 선택해주세요' : `${count}개 추가`}
            </Text>
          </Animated.View>
        </Pressable>
      </View>

      {flight !== null && from !== null && from.id === flight.id && (
        <FlyingPortrait
          flight={flight}
          from={from.rect}
          to={target !== null && target.id === flight.id ? target : null}
          onDone={props.onFlightDone}
        />
      )}
    </View>
  )
}
