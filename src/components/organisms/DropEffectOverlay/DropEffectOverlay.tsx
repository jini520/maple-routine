/**
 * 고가 아이템 드롭 시 뜨는 전체화면 연출. ScreenEff 가 화면을 채우고, 8프레임 시점에 중앙 아이템이
 * 팝인하며 DropEff(pre → loop ∞)가 그 아래에서 올라오는 오버레이. 화면을 탭하면 end 를 재생하고
 * 닫힌다.
 *
 * 프레임은 **전부 마운트해 두고 보이는 것만 바꾼다**. `source` 를 갈아끼우면 아직 안 그려 본 프레임
 * 에서 디코드가 비동기라 한 장이 통째로 빈다.
 *
 * 배치는 `frame-layout.ts` 가 레이아웃 값(`left` · `top` · `width` · `height`)으로 낸다. 프레임마다
 * 비트맵 크기가 달라서 origin 을 그 크기 위에서 해석해야 하고, 크기는 `Image.resolveAssetSource`
 * 가 준다.
 *
 * @see docs/features/item-drop.md 연출 정책
 */
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Image, Modal, Pressable, View, useWindowDimensions } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

import { getItemIconUrl } from '../../../lib/assets/asset-lookup'
import { DROP_EFFECT_FRAMES, screenEffectScale } from './drop-effect-layout'

import { AnimatedView, Svg } from '../../../lib/nativewind-interop'
import { Text } from '../../atoms'
import {
  advanceDropEffect,
  createDropEffectState,
  requestDropEffectClose,
  rendersDifferently,
  type DropEffectFrameCounts,
} from './drop-effect-player'
import { FLOAT_ANIMATION, POP_IN_ANIMATION } from './float-animation'
import {
  buildPillarFrames,
  buildScreenFrames,
  type FrameBitmapSize,
  type SpriteFrame,
} from './frame-layout'

/** 중앙 아이템 세로 위치(값 ↑ = 아래로). DropEff 지면 앵커도 이 값 기준으로 계산한다. */
const ITEM_CENTER_TOP = '66%'
const ITEM_SIZE_PX = 72
/** DropEff 기둥만 아이템과 무관하게 세로 이동(양수 = 아래로). */
const DROP_OFFSET_Y_PX = 8

/** 배경 방사 그라디언트. 테마 밖 고정색(파일 머리 ④). */
const BACKDROP_INNER = '#1b0f29'
const BACKDROP_OUTER = '#05010a'
/** CSS `farthest-corner` 의 근사(파일 머리 ②). */
const BACKDROP_RADIUS = '70.7%'

interface DropEffectOverlayProps {
  itemName: string
  slot?: string
  onClose: () => void
}

/**
 * 프레임 비트맵 크기. 번들 에셋은 스스로 안다(이후). 모르면 `null` 이고, 그때는
 * 아예 안 그린다(`frame-layout.ts`. 크기 없이 그리면 프레임마다 최대 26px 튄다).
 */
function bitmapSizeOf(source: number | { uri?: string }): FrameBitmapSize | null {
  const resolved = Image.resolveAssetSource(source as never)
  if (resolved === null || resolved === undefined) return null
  if (!Number.isFinite(resolved.width) || !Number.isFinite(resolved.height)) return null
  return { width: resolved.width, height: resolved.height }
}

/**
 * 스프라이트 한 층. **전 프레임을 마운트해 두고 `opacity` 로 한 장만 켠다**(파일 머리 ⑤).
 *
 * `source` 를 갈아끼우지 않는 것이 요점이다. 붙어 있는 `<Image>` 는 자기 비트맵을 쥐고 있어
 * 캐시에서 밀려나도 그릴 수 있다. 갈아끼우는 구조에서는 그 순간 캐시를 다시 뒤지고, 없으면
 * 그 프레임이 통째로 빈다.
 */
/**
 * 프레임 한 장. **`memo` 인 이유는 tick 마다 55장을 전부 재조정하지 않기 위해서다**. 실제로 바뀌는
 * 것은 **켜지는 하나와 꺼지는 하나** 뿐이다.
 */
const SpriteFrameView = memo(function SpriteFrameView(props: {
  frame: SpriteFrame
  active: boolean
  onSettle?: () => void
  testID: string
}): React.JSX.Element {
  return (
    <View style={{ position: 'absolute', ...props.frame.placement, opacity: props.active ? 1 : 0 }}>
      <Image
        testID={props.testID}
        source={props.frame.source}
        onLoad={props.onSettle}
        onError={props.onSettle}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  )
})

function SpriteLayer(props: {
  frames: readonly SpriteFrame[]
  activeKey: string | null
  onSettle?: () => void
  testID: string
}): React.JSX.Element {
  return (
    <>
      {props.frames.map((frame) => (
        <SpriteFrameView
          key={frame.key}
          frame={frame}
          active={frame.key === props.activeKey}
          onSettle={props.onSettle}
          testID={props.testID}
        />
      ))}
    </>
  )
}

export function DropEffectOverlay(props: DropEffectOverlayProps): React.JSX.Element {
  const gradientId = `drop-effect-backdrop-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const itemUrl = getItemIconUrl(props.itemName, props.slot)
  const reduceMotion = useReducedMotion()
  const { width: viewportW, height: viewportH } = useWindowDimensions()

  const counts: DropEffectFrameCounts = useMemo(
    () => ({
      screen: DROP_EFFECT_FRAMES.screen.length,
      pre: DROP_EFFECT_FRAMES.pre.length,
      loop: DROP_EFFECT_FRAMES.loop.length,
      end: DROP_EFFECT_FRAMES.end.length,
    }),
    [],
  )

  // ── 스프라이트 층: **전 프레임을 마운트해 두고 보이는 것만 켠다**(파일 머리 ⑤).
  const pillarFrames = useMemo(() => buildPillarFrames(bitmapSizeOf), [])
  const screenFrames = useMemo(
    () => buildScreenFrames(screenEffectScale(viewportW, viewportH), bitmapSizeOf),
    [viewportW, viewportH],
  )
  // **기다리는 것은 버스트(screen) 뿐이다.** 기둥은 8프레임째(약 356ms 뒤)에나 나오고 장당 작아서
  // 그 사이에 다 실린다. 55장을 다 기다리면 재생이 시작되는 바로 그 순간까지 디코드가 몰려
  // **첫 장이 늘어졌다가 뒤에서 서두른다**(2026-08-26 실측: frame 0 이 91ms, frame 2 가 25ms).
  const [warm, setWarm] = useState(false)
  const pendingRef = useRef(screenFrames.length)
  const settleOne = useCallback(() => {
    pendingRef.current -= 1
    if (pendingRef.current <= 0) setWarm(true)
  }, [])

  const [state, setState] = useState(createDropEffectState)

  // 상태를 ref 로도 들고 있는 이유: tick 은 `requestAnimationFrame` 콜백이라 **자기 클로저의 옛
  // state 를 본다.** 웹판이 `st` 객체 하나를 변이하며 돌던 자리와 같은 역할이다.
  //
  // **ref 가 원본이고 state 는 그림자다**. 렌더 때 `stateRef.current = state` 로 되맞추지 않는다.
  // 그 방향이면 렌더 중 ref 를 건드리게 되고(React 규칙 위반), 무엇보다 필요가 없다: 값을 바꾸는
  // 곳이 tick 과 탭 둘뿐이고 둘 다 ref 를 먼저 고친 뒤 `setState` 로 화면에 흘린다.
  const stateRef = useRef(state)

  const onCloseRef = useRef(props.onClose)
  useEffect(() => {
    onCloseRef.current = props.onClose
  }, [props.onClose])

  // 재생 루프. **`requestAnimationFrame` 인 이유는 `drop-effect-player.ts` 머리에 적었다**.
  // 스프라이트 재생은 **몇 번째 그림인가** 를 정하는 일이라 JS 스레드를 벗어날 수 없다.
  //
  // **예열이 끝나기 전에는 돌지 않는다**(파일 머리 ⑤). 디코드가 안 끝난 프레임을 넘기면 그 한 장이
  // 통째로 빈다.
  useEffect(() => {
    if (!warm) return undefined
    let raf = 0
    let last = 0

    const tick = (ts: number): void => {
      if (last === 0) last = ts
      const dt = ts - last
      last = ts

      const prev = stateRef.current
      const next = advanceDropEffect(prev, dt, counts)
      stateRef.current = next
      // **그림이 그대로면 다시 그리지 않는다**(`rendersDifferently`). 안 그러면 120Hz 기기에서
      // 초당 120번 트리를 재조정하면서 정작 스프라이트는 22번만 바뀐다.
      if (rendersDifferently(prev, next)) setState(next)

      if (next.finished) {
        onCloseRef.current()
        return
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [counts, warm])

  // 탭 → end 재생 → 닫힘. 이미 닫는 중이면 즉시 끝난다(웹과 같은 **두 번 탭하면 건너뛴다**).
  const handlePress = useCallback(() => {
    const next = requestDropEffectClose(stateRef.current, counts)
    stateRef.current = next
    setState(next)
    if (next.finished) onCloseRef.current()
  }, [counts])

  // ── 이번 프레임에 **켤 키**. 그림을 바꾸는 것이 아니라 켜는 것을 바꾼다(파일 머리 ⑤).
  // 예열이 끝나기 전에는 아무것도 안 켠다. 켜 두면 그 한 장이 예열 내내 **멈춰 서 있다.**
  const activeScreenKey = !warm || state.screenDone ? null : `screen-${state.screenIndex}`
  const activePillarKey =
    !warm || state.pillarPhase === null ? null : `${state.pillarPhase}-${state.pillarIndex}`

  return (
    <Modal
      testID="drop-effect-overlay-modal"
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={props.onClose}
    >
      <Pressable
        testID="drop-effect-overlay"
        onPress={handlePress}
        className="flex-1 overflow-hidden"
        // 그라디언트가 못 덮은 자리로 뒤(시트)가 비치지 않게, 바깥색을 바탕으로 깔아 둔다.
        style={{ backgroundColor: BACKDROP_OUTER }}
      >
        <Svg
          testID="drop-effect-backdrop"
          className="absolute inset-0"
          width={viewportW}
          height={viewportH}
        >
          <Defs>
            <RadialGradient id={gradientId} cx="50%" cy="50%" r={BACKDROP_RADIUS}>
              <Stop offset="0%" stopColor={BACKDROP_INNER} />
              <Stop offset="100%" stopColor={BACKDROP_OUTER} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={viewportW} height={viewportH} fill={`url(#${gradientId})`} />
        </Svg>


        {/* DropEff 기둥. 이 View 의 좌상단이 **기둥의 지면 앵커**이고, 프레임은 자기 origin 이 그
            점에 오도록 음수 좌표로 놓인다(`frame-layout.ts`). 검은 배경 위 가산 합성
            스프라이트라 `mixBlendMode: 'screen'` 이 필수다. 없으면 검은 사각형이 그대로 보인다.
            **블렌드는 이 앵커가 진다**(안쪽 View 에 걸면 `zIndex` 가 만든 스태킹 컨텍스트에 갇힌다,
            파일 머리 ③). 웹에서는 `<img>` 하나가 지던 자리다. */}
        <View
          testID="drop-effect-pillar"
          pointerEvents="none"
          className="absolute left-1/2"
          style={{
            top: ITEM_CENTER_TOP,
            marginTop: ITEM_SIZE_PX / 2 + DROP_OFFSET_Y_PX,
            zIndex: 2,
            mixBlendMode: 'screen',
          }}
        >
          <SpriteLayer
            frames={pillarFrames}
            activeKey={activePillarKey}
            testID="drop-effect-pillar-frame"
          />
        </View>

        {/* 중앙 아이템(투명 PNG). 이후 매핑이 있는 아이템은 여기까지 오지만, 그림을
            앉히는 `<Image>` 는 재생 엔진(파일 머리 ⓑ)과 함께 온다. 팝인 트리거가 8프레임 시점이라
            엔진 없이는 켤 것이 없다. 매핑이 없는 아이템은 웹과 같은 분기로 그대로 비어 있다. */}
        {itemUrl !== null && state.itemVisible && (
          <View
            testID="drop-effect-item"
            pointerEvents="none"
            className="absolute left-1/2"
            style={{
              top: ITEM_CENTER_TOP,
              zIndex: 3,
              marginLeft: -ITEM_SIZE_PX / 2,
              marginTop: -ITEM_SIZE_PX / 2,
            }}
          >
            {/* 웹이 레이어를 셋으로 가른 이유가 RN 에서도 그대로다. 중앙정렬(바깥)·부유(가운데)·
                팝인(안쪽)이 한 요소에 겹치면 서로의 transform 을 덮어쓴다.
                모션 줄이기면 둘 다 안 건다(웹의 `prefers-reduced-motion` 짝). */}
            <AnimatedView
              testID="drop-effect-item-float"
              style={reduceMotion ? undefined : FLOAT_ANIMATION}
            >
              <AnimatedView
                testID="drop-effect-item-pop"
                style={reduceMotion ? undefined : POP_IN_ANIMATION}
              >
                <Image
                  testID="drop-effect-item-image"
                  source={itemUrl}
                  accessibilityLabel={props.itemName}
                  resizeMode="contain"
                  style={{ width: ITEM_SIZE_PX, height: ITEM_SIZE_PX }}
                />
              </AnimatedView>
            </AnimatedView>
          </View>
        )}

        {/* ScreenEff. 전 프레임 동일 배율 + 화면 중앙. 기둥과 같은 이유로
            가산 합성이다. */}
        <View
          testID="drop-effect-screen"
          pointerEvents="none"
          className="absolute left-1/2 top-1/2"
          style={{ zIndex: 4, mixBlendMode: 'screen' }}
        >
          <SpriteLayer
            frames={screenFrames}
            activeKey={activeScreenKey}
            onSettle={settleOne}
            testID="drop-effect-screen-frame"
          />
        </View>

        <View className="absolute inset-x-0 bottom-6" pointerEvents="none" style={{ zIndex: 5 }}>
          <Text
            className="text-center text-xs font-semibold"
            style={{
              color: 'rgba(255,255,255,0.8)',
              textShadowColor: 'rgba(0,0,0,0.7)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 4,
            }}
          >
            화면을 터치하면 닫힙니다
          </Text>
        </View>
      </Pressable>
    </Modal>
  )
}
