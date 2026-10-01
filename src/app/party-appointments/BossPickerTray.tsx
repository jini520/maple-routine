/**
 * 보스 추가 단계의 바닥. `n개 선택됨` 줄과 `n개 추가` 버튼.
 *
 * 타일을 누르면 그 초상이 이 줄의 다음 자리로 날아온다. 날아오는 동안 진짜 칸은 숨겨 두었다가 도착하면
 * 드러낸다. 칸을 길게 누르면 떠서 좌우로 끌어 차례를 바꾸고, 누르면 난이도 팝오버가 열린다.
 */
import { useEffect, useRef, useState } from 'react'
import { Modal, Pressable, View } from 'react-native'
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  FadeOutDown,
  runOnJS,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Sortable from 'react-native-sortables'

import { Badge, Text } from '../../components/atoms'
import { BossPortrait } from '../../components/molecules/BossPortrait/BossPortrait'
import { DIFFICULTY_NAME } from '../../constants/domain/boss-difficulty'
import { moveItem } from '../../features/party-appointments/draft'
import { bossAliasOf, bossPortraitSlugOf } from '../../lib/boss/bosses'
import { selectionFeedback } from '../../native/haptics'
import type { PopoverAnchorRect } from '../../hooks/useAnchoredPopover'
import type { BossDifficulty } from '../../types'
import type { PartyAppointmentBoss } from '../../types/party-appointment'
import { TILE_PORTRAIT } from './BossPickerBody'

/** 선택 줄 칸의 폭 · 초상 한 변 · 칸 사이 · 줄 좌우 여백 */
const ITEM_WIDTH = 50
const ITEM_PORTRAIT = 40
/** 초상과 캐릭터 색 고리 사이의 바탕 틈, 그리고 고리 두께 */
const RING_GAP = 2
const RING = 2
const SLOT = ITEM_PORTRAIT + (RING_GAP + RING) * 2
const SLOT_GAP = 10
const ROW_PAD = 16
/** 시안과 같은 값. 0.52초, 시간 곡선은 처음에 느리고 끝에서 감속한다 */
const FLIGHT_MS = 520
const FLIGHT_EASING = Easing.bezier(0.35, 0, 0.25, 1)
/** 넘치듯 튀는 곡선. 도착한 칸 · 난이도를 바꾼 칸 · 버튼 숫자가 쓴다 */
const POP_EASING = Easing.bezier(0.3, 1.6, 0.5, 1)
/**
 * 첫 보스는 시트가 다 자란 뒤에 출발한다. 줄이 생기며 바닥이 자라 시트가 통째로 올라가므로(시트 이동 380ms),
 * 그 전에 출발하면 초상만 옛 자리에 남는다.
 */
const FIRST_FLIGHT_DELAY_MS = 420

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
  colorOf: (ocid: string) => string
  flight: Flight | null
  onFlightDone: () => void
  onReorder: (next: PartyAppointmentBoss[]) => void
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
  color: string
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
      scale.set(withSequence(withTiming(0.4, { duration: 0 }), withTiming(1, { duration: 420, easing: POP_EASING })))
      opacity.set(withTiming(1, { duration: 420, easing: POP_EASING }))
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
      aria-label={`${index + 1}번째 ${name}, 난이도 바꾸기 또는 제거`}
      onPress={() => {
        itemRef.current?.measureInWindow((left, top, width, height) => props.onPress(index, { left, top, width, height }))
      }}
      style={{ width: ITEM_WIDTH }}
    >
      <Animated.View style={popStyle}>
        <View style={{ alignItems: 'center', gap: 3 }}>
        {/* 바탕색 틈 2 + 캐릭터 색 고리 2. 초상이 고리에 붙으면 어느 캐릭터 색인지 안 갈린다. */}
        <View
          ref={itemRef}
          style={{
            width: SLOT,
            height: SLOT,
            borderRadius: SLOT / 2,
            borderWidth: RING,
            borderColor: props.color,
            padding: RING_GAP,
          }}
        >
          <BossPortrait portraitSlug={bossPortraitSlugOf(boss.bossKey)} label={name} size={ITEM_PORTRAIT} />
        </View>
        <Badge variant={boss.difficulty as BossDifficulty} size="mini">
          {DIFFICULTY_NAME[boss.difficulty as BossDifficulty] ?? boss.difficulty}
        </Badge>
        </View>
        {/* 차례 번호도 칸과 함께 숨었다가 함께 튄다. */}
        <View className="absolute -top-1 h-4 w-4 items-center justify-center rounded-full bg-text" style={{ left: -2 }}>
          <Text className="text-9 font-bold text-surface">{index + 1}</Text>
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

  /**
   * 새 칸의 도착점. 줄은 날아가는 동안 끝에 붙어 있으므로(`onContentSizeChange`), 줄이 넘치면 새 칸은
   * 늘 오른쪽 끝 자리다. 칸을 직접 재지 않는 것은 정렬 라이브러리가 내용 폭을 한 박자 늦게 늘려, 잰 순간의
   * 칸이 아직 화면 밖에 있기 때문이다(실측: 그 자리로 내려앉은 뒤 칸이 옆으로 미끄러져 들어왔다).
   */
  function aim(target: Flight): void {
    const index = picked.findIndex((boss) => keyOf(boss) === keyOf(target.boss))
    rowRef.current?.measureInWindow((rowX, rowY, rowWidth) => {
      const contentWidth = ROW_PAD * 2 + picked.length * ITEM_WIDTH + (picked.length - 1) * SLOT_GAP
      const left =
        contentWidth > rowWidth ? rowWidth - ROW_PAD - ITEM_WIDTH : ROW_PAD + index * (ITEM_WIDTH + SLOT_GAP)
      setTarget({
        id: target.id,
        x: rowX + left + (ITEM_WIDTH - SLOT) / 2 + RING_GAP + RING,
        y: rowY + 8 + RING_GAP + RING,
      })
    })
  }

  // 비행이 시작되면 초상이 출발 자리에 뜨고 도착점을 잡는다. 첫 보스는 시트가 다 자란 뒤 타일을 다시 재서
  // 그 새 자리에서 뜬다. 그 전에는 초상을 안 그린다.
  useEffect(() => {
    if (flight === null) return
    scrollRef.current?.scrollToEnd({ animated: false })
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

  const count = picked.length
  return (
    // 바닥 줄의 좌우 · 위 여백을 걷어 선택 줄이 시트 폭 끝까지 깔린다.
    <View className="-mx-4 -mt-3">
      {count > 0 && (
        // 처음 고를 때 줄이 아래에서 펼쳐진다. 스타일 없는 겉 층에만 애니메이션을 단다(className 함정).
        <Animated.View entering={FadeInDown.duration(260)} exiting={FadeOutDown.duration(180)}>
          <View className="border-t border-border bg-card-body">
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
                // 날아가는 동안은 내용 폭이 늘 때마다 끝에 붙인다. 도착점이 오른쪽 끝 칸이라는 약속이 여기서 지켜진다.
                onContentSizeChange={() => {
                  if (flight !== null) scrollRef.current?.scrollToEnd({ animated: false })
                }}
              >
                <Sortable.Flex
                  gap={SLOT_GAP}
                  flexWrap="nowrap"
                  scrollableRef={scrollRef}
                  // 새 칸의 등장은 칸이 직접 한다(0.4 배에서 튄다). 라이브러리 효과가 겹치면 칸이 옆에서 미끄러져 들어온다.
                  itemEntering={null}
                  onOrderChange={() => {
                    'worklet'
                    runOnJS(selectionFeedback)()
                  }}
                  onDragEnd={({ fromIndex, toIndex }) => props.onReorder(moveItem(picked, fromIndex, toIndex))}
                >
                  {picked.map((boss, index) => (
                    <TrayItem
                      key={keyOf(boss)}
                      boss={boss}
                      index={index}
                      hidden={keyOf(boss) === flyingKey}
                      color={props.colorOf(boss.ocid)}
                      onPress={props.onPressItem}
                    />
                  ))}
                </Sortable.Flex>
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
