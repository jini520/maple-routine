/**
 * 대표 캐릭터 동작 시트. 빠른 이동 편집 시트와 같은 구조다.
 *
 * 행동과 표정은 시트 제목 아래의 세그먼트로 한쪽씩 보인다. 칸마다 그 캐릭터가 그 동작을 하는 그림이 서고,
 * 바닥 트레이에서 동작 시간 · 쉬는 시간을 고르고 고른 조합을 위젯 크기로 미리 본다. `적용` 을 눌러야 저장된다.
 */
import { Image as CachedImage } from 'expo-image'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Pressable, View } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'

import { CheckBox, CheckIcon, Text } from '../../components/atoms'
import { Segment } from '../../components/molecules/Segment/Segment'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import {
  FIGURE_ACTION_GROUPS,
  FIGURE_DURATIONS_MS,
  FIGURE_NAMES,
  MAX_FIGURE_ACTIONS,
  MAX_FIGURE_EMOTIONS,
  PICKABLE_EMOTIONS,
  toggleFigureAction,
  toggleFigureEmotion,
} from '../../features/figure-motion/config'
import { useFigureMotionStore } from '../../features/figure-motion/store'
import { lookFrameKey, lookFrameUrl } from '../../lib/character-look'
import { boxShadowOf, type ShadowLayer } from '../../lib/shadow'
import { useThemeAppearance } from '../../theme/context'
import type { FigureDurationMs, FigureMotion, LookAction, LookEmotion } from '../../types/figure-motion'
import { tileSteps, type FigureStep } from './widgets/figure-motion'
import { RepresentativeFigure } from './widgets/RepresentativeFigure'
import { FIGURE_CACHE_POLICY, useFigureReady } from './widgets/useFigureStep'

/** 다 고른 뒤 고르지 않은 칸. 흐리지 않으면 누를 수 없는 칸이 멀쩡해 보인다 */
const LOCKED_OPACITY = 0.35
const CHECK_SIZE = 22
const CHECK_GAP = 3
/** 칸 상자 높이. 위젯 그림과 같은 높이다 */
const TILE_HEIGHT = 76
/** 행동 칸은 위젯 그림과 같은 배율로 전신을, 표정 칸은 얼굴을 키워 그린다 */
const ACTION_SCALE = 0.76
const FACE_SCALE = 1.7
/** 그림 안의 캐릭터 기준점(300×300 그림 px). 행동은 발이 칸 바닥에 오게, 표정은 얼굴이 칸 가운데 오게 */
const ACTION_ANCHOR = { x: 150, top: 114 }
const FACE_ANCHOR = { x: 146, y: 152 }
/** 칸이 함께 쓰는 시계의 한 박자. 가장 짧은 칸(깜빡임)과 같다 */
const TICK_MS = 50
/** 보스 선택 트레이와 같은 그림자. 구분선 대신 위로 드리워 본문과 가른다 */
const TRAY_SHADOW: ShadowLayer = { opacity: 0.23, radius: 12, y: -10 }

const TABS = ['action', 'emotion'] as const
type Tab = (typeof TABS)[number]
const DURATION_OPTIONS = FIGURE_DURATIONS_MS.map(String)

export interface FigureMotionSheetProps {
  ocid: string
  /** 캐릭터 이름. 미리보기 그림을 스크린리더가 읽는다 */
  name: string
  imageUrl: string
  motion: FigureMotion
  onClose: () => void
}

/** 칸이 함께 쓰는 시계. 칸마다 자기 그림이 바뀔 때만 다시 그린다 */
interface SheetClock {
  now: () => number
  subscribe: (listener: () => void) => () => void
}

function createSheetClock(): SheetClock & { tick: () => void } {
  let now = 0
  const listeners = new Set<() => void>()
  return {
    now: () => now,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    tick: () => {
      now += TICK_MS
      listeners.forEach((listener) => listener())
    },
  }
}

/** 움직임 줄이기면 멈춰 첫 그림에 선다 */
function useSheetClock(): SheetClock {
  const reduceMotion = useReducedMotion()
  const [clock] = useState(createSheetClock)

  useEffect(() => {
    if (reduceMotion) return
    const timer = setInterval(clock.tick, TICK_MS)
    return () => clearInterval(timer)
  }, [clock, reduceMotion])

  return clock
}

/** 시계가 가리키는 칸 차례 */
function stepIndexAt(clock: number, starts: readonly number[], total: number): number {
  const at = clock % total
  let index = 0
  while (index < starts.length - 1 && at >= starts[index + 1]) index += 1
  return index
}

/**
 * 칸 그림. 위젯처럼 그 동작의 그림을 겹쳐 깔고 지금 차례의 한 장만 보이며, 좌우를 뒤집어 그린다.
 *
 * 보이고 숨기기는 React 상태로 한다. Reanimated 의 애니메이션 스타일을 단 상자 안의 그림은 iOS 에서 그려지지 않는다(값이 고정이어도).
 */
function TileFigure(props: { clock: SheetClock; imageUrl: string; code: LookAction | LookEmotion }): React.JSX.Element {
  const steps: FigureStep[] = useMemo(() => tileSteps(props.code), [props.code])
  const starts = useMemo(
    () => steps.reduce<number[]>((list, step, index) => [...list, index === 0 ? 0 : list[index - 1] + steps[index - 1].ms], []),
    [steps],
  )
  const total = steps.reduce((sum, step) => sum + step.ms, 0)
  const index = useSyncExternalStore(props.clock.subscribe, () => stepIndexAt(props.clock.now(), starts, total))
  const step = steps[index]
  const shownKey = lookFrameKey(step.frame)
  const layers = [...new Map(steps.map((each) => [lookFrameKey(each.frame), each.frame])).entries()]
  const isFace = props.code.startsWith('E')
  const scale = isFace ? FACE_SCALE : ACTION_SCALE
  const size = 300 * scale
  const left = -(isFace ? FACE_ANCHOR.x : ACTION_ANCHOR.x) * scale
  const top = isFace ? TILE_HEIGHT / 2 - FACE_ANCHOR.y * scale : -ACTION_ANCHOR.top * scale

  return (
    // 칸 가운데를 축으로 뒤집는다. 그림은 칸 가운데에서 기준점만큼 비켜 놓아 칸 폭을 몰라도 캐릭터가 가운데 선다.
    <View
      style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, transform: [{ translateY: -step.liftPx }, { scaleX: -1 }] }}
    >
      {layers.map(([key, frame]) => (
        <View
          key={key}
          testID={`figure-motion-layer-${props.code}-${key}`}
          style={{ position: 'absolute', left: '50%', marginLeft: left, top, width: size, height: size, opacity: key === shownKey ? 1 : 0 }}
        >
          <CachedImage
            source={{ uri: lookFrameUrl(props.imageUrl, frame) }}
            cachePolicy={FIGURE_CACHE_POLICY}
            contentFit="fill"
            style={{ width: size, height: size }}
          />
        </View>
      ))}
    </View>
  )
}

function Tile(props: {
  clock: SheetClock
  imageUrl: string
  code: LookAction | LookEmotion
  selected: boolean
  locked: boolean
  onPress: () => void
}): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const name = FIGURE_NAMES[props.code]

  return (
    <Pressable
      testID={`figure-motion-tile-${props.code}`}
      role="button"
      aria-label={name}
      aria-selected={props.selected}
      disabled={props.locked}
      onPress={props.onPress}
      // RN 의 `disabled` 는 모양을 바꾸지 않는다.
      style={props.locked ? { opacity: LOCKED_OPACITY } : undefined}
      className="w-1/4 items-center gap-1.5 px-1 pb-3"
    >
      <View className="self-stretch">
        <View className="self-stretch overflow-hidden rounded-[14px] bg-card-inset" style={{ height: TILE_HEIGHT }}>
          <TileFigure clock={props.clock} imageUrl={props.imageUrl} code={props.code} />
        </View>
        {props.selected && (
          <View
            testID={`figure-motion-check-${props.code}`}
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
      {/* 말줄임과 줄바꿈을 쓰지 않는다. 칸보다 긴 이름은 넘지 않을 만큼 글자를 줄인다. */}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        className={`text-11 ${props.selected ? 'font-bold text-text' : 'text-text-muted'}`}
      >
        {name}
      </Text>
    </Pressable>
  )
}

function TileCard(props: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View className="rounded-[22px] bg-surface px-3 pb-1 pt-3.5">
      <Text className="px-1.5 pb-2.5 text-xs font-bold text-text">{props.label}</Text>
      <View className="flex-row flex-wrap">{props.children}</View>
    </View>
  )
}

export function FigureMotionSheet(props: FigureMotionSheetProps): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const clock = useSheetClock()
  const [draft, setDraft] = useState(props.motion)
  const [tab, setTab] = useState<Tab>('action')
  const complete = draft.actions.length > 0 && draft.emotions.length > 0
  // 고르는 그때 고른 조합의 그림을 받는다. 위젯은 움직이는 동안 새로 받지 않는다.
  const ready = useFigureReady(props.imageUrl, complete ? draft : props.motion, !complete)
  const actionsFull = draft.actions.length >= MAX_FIGURE_ACTIONS
  const emotionsFull = draft.emotions.length >= MAX_FIGURE_EMOTIONS

  async function apply(): Promise<void> {
    await useFigureMotionStore.getState().save(props.ocid, draft)
    props.onClose()
  }

  const actionTile = (action: LookAction): React.JSX.Element => {
    const selected = draft.actions.includes(action)
    return (
      <Tile
        key={action}
        clock={clock}
        imageUrl={props.imageUrl}
        code={action}
        selected={selected}
        locked={actionsFull && !selected}
        onPress={() => setDraft(toggleFigureAction(draft, action))}
      />
    )
  }

  const emotionTile = (emotion: LookEmotion): React.JSX.Element => {
    const selected = draft.emotions.includes(emotion)
    return (
      <Tile
        key={emotion}
        clock={clock}
        imageUrl={props.imageUrl}
        code={emotion}
        selected={selected}
        locked={emotionsFull && !selected}
        onPress={() => setDraft(toggleFigureEmotion(draft, emotion))}
      />
    )
  }

  return (
    <BottomSheet
      testId="figure-motion-sheet"
      label="대표 캐릭터 동작"
      onClose={props.onClose}
      resetScrollKey={tab}
      header={
        <View className="gap-3">
          <Text className="text-base font-bold text-text">대표 캐릭터 동작</Text>
          <Segment
            size="md"
            fill
            options={TABS}
            selected={tab}
            // 고른 수와 최대 수를 함께 적는다. 어느 쪽을 보고 있어도 두 쪽의 수가 다 보인다.
            labelOf={(value) =>
              value === 'action'
                ? `행동 ${draft.actions.length}/${MAX_FIGURE_ACTIONS}`
                : `표정 ${draft.emotions.length}/${MAX_FIGURE_EMOTIONS}`
            }
            onSelect={setTab}
          />
        </View>
      }
      footer={
        <View className="-mx-4 -mt-3 bg-bg pt-3" style={{ boxShadow: boxShadowOf(definition.shadowColor, TRAY_SHADOW) }}>
          <View className="flex-row items-center justify-between px-5">
            <Text className="text-xs font-bold text-text">동작 시간</Text>
            <Segment
              size="sm"
              options={DURATION_OPTIONS}
              selected={String(draft.durationMs)}
              labelOf={(value) => `${Number(value) / 1000}초`}
              onSelect={(value) => setDraft({ ...draft, durationMs: Number(value) as FigureDurationMs })}
            />
          </View>
          <Pressable
            testID="figure-motion-rest"
            role="checkbox"
            aria-checked={draft.rest}
            aria-label="쉬는 시간"
            onPress={() => setDraft({ ...draft, rest: !draft.rest })}
            className="flex-row items-center gap-2 self-start px-5 pt-2.5"
          >
            <CheckBox checked={draft.rest} />
            <Text className="text-xs font-bold text-text">쉬는 시간</Text>
          </Pressable>
          <View className="mx-4 mt-3 items-center rounded-[14px] bg-surface p-3">
            <RepresentativeFigure
              name={props.name}
              imageUrl={props.imageUrl}
              unavailable={false}
              motion={complete ? draft : props.motion}
              active
              ready={complete && ready}
              testIdPrefix="figure-motion-preview"
            />
          </View>
          <View className="px-4 pt-3">
            <Pressable
              role="button"
              aria-label="적용"
              disabled={!complete}
              onPress={() => void apply()}
              className={`h-[52px] items-center justify-center rounded-full ${complete ? 'bg-primary' : 'bg-surface-2'}`}
            >
              <Text className={`text-base font-bold ${complete ? 'text-on-primary' : 'text-text-disabled'}`}>적용</Text>
            </Pressable>
          </View>
        </View>
      }
    >
      <View className="gap-3 px-4 pb-3">
        {tab === 'action' ? (
          FIGURE_ACTION_GROUPS.map((group) => (
            <TileCard key={group.label} label={group.label}>
              {group.actions.map(actionTile)}
            </TileCard>
          ))
        ) : (
          <TileCard label="표정">{PICKABLE_EMOTIONS.map(emotionTile)}</TileCard>
        )}
      </View>
    </BottomSheet>
  )
}
