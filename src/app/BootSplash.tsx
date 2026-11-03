import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, { useReducedMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'

import body from '../../assets/splash/body.png'
import snow0 from '../../assets/splash/snow-0.png'
import snow1 from '../../assets/splash/snow-1.png'
import snow2 from '../../assets/splash/snow-2.png'
import snow3 from '../../assets/splash/snow-3.png'
import snow4 from '../../assets/splash/snow-4.png'
import snow5 from '../../assets/splash/snow-5.png'
import snow6 from '../../assets/splash/snow-6.png'
import { FIRST_RUN_HOLD_MS } from '../features/live-update/store'
import { resolveSystemTheme } from '../features/theme/system-theme'
import { markBootSplashDone } from '../hooks/useBootSplashDone'
import { getThemeDefinition } from '../lib/theme/theme-registry'
import { hideSplashScreen } from '../native/splash-screen'
import {
  entranceEndMs,
  fallAnimation,
  hopAnimation,
  LOCKUP_FADE_ANIMATION,
  spinAnimation,
  swayAnimation,
} from './splash/animations'
import { SPLASH_COLORS } from './splash/colors'
import { splashLayout } from './splash/layout'
import { SPLASH_LEAF_PATH, SPLASH_LEAF_VIEW_BOX } from './splash/leaf'
import { WORDMARK_EM_HEIGHT, WORDMARK_GLYPHS } from './splash/wordmark'

/**
 * 스플래시의 두 번째 겹. 앱이 그리는 브랜드 화면.
 *
 * 첫 번째 겹은 OS 시작 창이라 앱이 그 자리에 못 온다(실행 15ms 만에 뜬다). 그래서 애니메이션이
 * 들어갈 수 있는 자리는 여기뿐이다.
 *
 * ## 넘겨받는 순서가 이 파일의 실질
 *
 * 1겹을 내리는 신호는 **이 층이 실제로 그려졌다는 사실**이다. 시계가 아니다. 그래서
 * `onLayout` 이 `hideSplashScreen()` 을 부른다. 이 순서라야 1겹이 걷히는 순간 아래가 이미
 * 칠해져 있어 빈 구간이 생길 수가 없다.
 *
 * 그다음 이 층이 서 있는 시간은 **1겹이 사라진 뒤부터** 센다(`BOOT_SPLASH_HOLD_MS`).
 *
 * 시계로 내리면 화면에 무엇이 그려졌는지 모르는 채로 걷게 된다. 그때 빈 화면이 안 보이는 것은
 * 부팅이 그 시간보다 빨랐다는 뜻일 뿐 보장이 아니다.
 *
 * ## 그리는 것
 *
 * 하늘 그라디언트 위에 겨울 축제 일러스트, 그 위에 잎과 이름 묶음이다. 잎과 이름은 1겹이 사라진
 * 뒤에 나타나 글자가 하나씩 뛴다. 눈 조각은 처음부터 계속 내린다. 색은 `splash/colors.ts` 가, 자리는
 * `splash/layout.ts` 가, 움직임은 `splash/animations.ts` 가 정한다. 모션 줄이기면 묶음은 처음부터 보이고
 * 눈은 없다.
 *
 * `onLayout` 은 회전·키보드로 여러 번 온다. 내리는 것은 한 번이면 된다.
 *
 * 터치를 막는 것은 의도다. 이 층이 덮고 있는 동안 아래는 아직 준비 중이라, 새어 나간 탭이
 * 안 보이는 버튼을 누르면 안 된다. 상한이 있어 갇힐 위험은 없다.
 */
const SNOW_SPRITES = [snow0, snow1, snow2, snow3, snow4, snow5, snow6]

/** 글자마다 뛰는 차례. 띄어쓰기는 뛰지 않고 차례도 차지하지 않는다(`null`). */
let syllableCount = 0
const GLYPHS = WORDMARK_GLYPHS.map((glyph) => ({
  glyph,
  syllable: glyph.path === '' ? null : syllableCount++,
}))

/**
 * 글자 패스에 두르는 같은 색 윤곽선의 두께. em 의 1000 분의 1 단위다.
 *
 * 메이플스토리 서체는 Light 와 Bold 뿐이고 실기기에서 Light 는 얇고 Bold 는 무겁다. 윤곽선은 획의 안팎에
 * 반씩 걸쳐 획이 이만큼 굵어진다. 3배 화면의 36pt 글자에서 2px 다.
 */
const WORDMARK_STROKE_UNITS = 18

/**
 * 1겹이 사라진 **뒤부터** 이 층이 서 있는 시간. 등장(`entranceEndMs`)이 끝난 뒤에 걷어야 한다.
 *
 * 1겹과 합쳐 사용자가 스플래시를 보는 시간이 되므로, 등장보다 길게 늘릴 이유가 없다.
 */
export const BOOT_SPLASH_HOLD_MS = Math.ceil(entranceEndMs(syllableCount) / 100) * 100 + 100

/**
 * 1겹이 사라지기를 기다리는 상한.
 *
 * 없으면 `hideSplashScreen()` 이 끝내 안 끝날 때 이 층이 영영 안 걷혀 앱이 바탕색에 갇힌다.
 * 트리 밖 실패 안전 타이머도 같은 함수를 기다리므로 그쪽이 대신 받아 주지 못한다.
 */
const BOOT_SPLASH_HANDOFF_CAP_MS = 2000

type Phase = 'waiting' | 'covering'

export function BootSplash(props: {
  /** 처음 실행에서 OTA 를 받아 적용하는 동안 참. 최소 표시 시간이 지나도 걷지 않는다. */
  holding?: boolean
}): React.JSX.Element | null {
  const [phase, setPhase] = useState<Phase>('waiting')
  const [heldLongEnough, setHeldLongEnough] = useState(false)
  const [capped, setCapped] = useState(false)
  const handedOff = useRef(false)
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (phase !== 'covering') return

    const timer = setTimeout(() => {
      setHeldLongEnough(true)
    }, BOOT_SPLASH_HOLD_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [phase])

  // 붙드는 쪽이 끝내 놓지 않아도 갇히지 않게, 처음 켠 때부터 센다.
  useEffect(() => {
    const timer = setTimeout(() => {
      setCapped(true)
    }, FIRST_RUN_HOLD_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [])

  const done = phase === 'covering' && heldLongEnough && (props.holding !== true || capped)
  useEffect(() => {
    if (done) markBootSplashDone()
  }, [done])

  if (done) return null

  const handleLayout = (): void => {
    // ref 로 막는 것은 `phase` 가 다음 렌더에야 바뀌기 때문이다. 같은 틱에 레이아웃이 두 번 오면
    // 상태만으로는 둘 다 통과한다.
    if (handedOff.current) return
    handedOff.current = true
    // 실패는 삼킨다. 못 내려도 이 층이 덮고 있어 화면은 멀쩡하고, 여기서 던지면 그 대가로
    // 부팅 렌더가 죽는다.
    //
    // **세기 시작하는 시점이 부른 때가 아니라 끝난 때다.** 부른 때부터 세면 그 시간의 일부를
    // 1겹에 가려진 채로 보낸다. 계측에서 600ms 중 320ms 가 그랬다.
    //
    // `hideAsync()` 는 **요청이 접수되면 끝나고** 안드로이드의 1겹은 그 뒤로 400ms 를 더 걸려
    // 사라진다. 그래서 잎과 이름의 등장도 `covering` 부터 시작한다. 그려지자마자 시작하면 그만큼이
    // 1겹 아래에서 지나간다.
    void Promise.race([
      hideSplashScreen().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, BOOT_SPLASH_HANDOFF_CAP_MS)),
    ]).then(() => {
      setPhase('covering')
    })
  }

  const layout = splashLayout({ width, height, topInset: insets.top })
  const theme = getThemeDefinition(resolveSystemTheme())
  const colors = SPLASH_COLORS[theme.mode]
  const entered = phase === 'covering'
  const animate = entered && !reduceMotion
  const glyphScale = layout.lockup.namePx / WORDMARK_EM_HEIGHT

  return (
    <View
      testID="boot-splash"
      onLayout={handleLayout}
      style={[styles.cover, { backgroundColor: colors.sky }]}
    >
      <LinearGradient
        colors={[colors.sky, colors.ground, colors.ground]}
        locations={[0, colors.groundAt, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Image
        testID="boot-splash-illustration"
        source={body}
        style={{
          position: 'absolute',
          left: layout.image.left,
          bottom: layout.image.bottom,
          width: layout.image.width,
          height: layout.image.height,
        }}
      />
      {reduceMotion
        ? null
        : layout.snow.map((flake) => (
            <Animated.View
              key={flake.sprite}
              style={[
                { position: 'absolute', left: flake.left, top: 0, width: flake.width, height: flake.height },
                fallAnimation(flake),
              ]}
            >
              <Animated.View style={swayAnimation(flake)}>
                <Animated.View style={flake.spinMs > 0 ? spinAnimation(flake) : undefined}>
                  <Image
                    source={SNOW_SPRITES[flake.sprite]}
                    style={{ width: flake.width, height: flake.height }}
                  />
                </Animated.View>
              </Animated.View>
            </Animated.View>
          ))}
      <Animated.View
        testID="boot-splash-lockup"
        style={[
          styles.lockup,
          { top: layout.lockup.top, gap: layout.lockup.gap },
          reduceMotion ? styles.shown : entered ? LOCKUP_FADE_ANIMATION : styles.hidden,
        ]}
      >
        <Svg width={layout.lockup.leafWidth} height={layout.lockup.leafHeight} viewBox={SPLASH_LEAF_VIEW_BOX}>
          <Path d={SPLASH_LEAF_PATH} fill={theme.primary} />
        </Svg>
        <View style={styles.name}>
          {GLYPHS.map(({ glyph, syllable }, index) => {
            const glyphWidth = glyph.advance * glyphScale
            if (syllable === null) return <View key={index} style={{ width: glyphWidth }} />
            return (
              <Animated.View
                key={index}
                style={animate ? hopAnimation(layout.lockup.namePx, syllable) : undefined}
              >
                <Svg
                  width={glyphWidth}
                  height={layout.lockup.namePx}
                  viewBox={`0 0 ${glyph.advance} ${WORDMARK_EM_HEIGHT}`}
                >
                  <Path
                    d={glyph.path}
                    fill={colors.ink}
                    stroke={colors.ink}
                    strokeWidth={WORDMARK_STROKE_UNITS}
                    strokeLinejoin="round"
                  />
                </Svg>
              </Animated.View>
            )
          })}
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  lockup: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    flexDirection: 'row',
  },
  hidden: {
    opacity: 0,
  },
  shown: {
    opacity: 1,
  },
})
