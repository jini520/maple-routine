import { useEffect, useRef, useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'

import splashLogo from '../../assets/splash-icon.png'
import { hideSplashScreen } from '../native/splash-screen'

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
 * ## 최소 표시 시간이 여기 있는 이유
 *
 * 1겹은 OS 가 언제 걷을지 모른다. 앱에 넘기는 데 제한 시간이 있고 못 받으면 시스템이 걷어 간다.
 * 이 층은 우리가 통제하므로 보장을 여기 둔다.
 *
 * `onLayout` 은 회전·키보드로 여러 번 온다. 내리는 것은 한 번이면 된다.
 *
 * 터치를 막는 것은 의도다. 이 층이 덮고 있는 동안 아래는 아직 준비 중이라, 새어 나간 탭이
 * 안 보이는 버튼을 누르면 안 된다. 상한이 있어 갇힐 위험은 없다.
 */
const BOOT_SPLASH_BACKGROUND = '#F58B0F'
const BOOT_SPLASH_LOGO_WIDTH = 200

/**
 * 1겹이 사라진 **뒤부터** 이 층이 서 있는 시간. 애니메이션이 붙으면 그 길이가 이 값을 대체한다.
 *
 * 1겹과 합쳐 사용자가 스플래시를 보는 시간이 되므로, 1겹이 이미 오래 떠 있었다면 여기서 더
 * 늘릴 이유가 없다.
 */
export const BOOT_SPLASH_HOLD_MS = 600

/**
 * 1겹이 사라지기를 기다리는 상한.
 *
 * 없으면 `hideSplashScreen()` 이 끝내 안 끝날 때 이 층이 영영 안 걷혀 앱이 브랜드색에 갇힌다.
 * 트리 밖 실패 안전 타이머도 같은 함수를 기다리므로 그쪽이 대신 받아 주지 못한다.
 */
const BOOT_SPLASH_HANDOFF_CAP_MS = 2000

type Phase = 'waiting' | 'covering' | 'done'

export function BootSplash(): React.JSX.Element | null {
  const [phase, setPhase] = useState<Phase>('waiting')
  const handedOff = useRef(false)

  useEffect(() => {
    if (phase !== 'covering') return

    const timer = setTimeout(() => {
      setPhase('done')
    }, BOOT_SPLASH_HOLD_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [phase])

  if (phase === 'done') return null

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
    // 다만 이것으로도 다 못 막는다. `hideAsync()` 는 **요청이 접수되면 끝나고** 1겹은 그 뒤로
    // 400ms 를 더 걸려 사라진다(라이브러리의 기본 퇴장 길이). 계측에서 이 층이 실제로 혼자
    // 보인 것은 600ms 중 160ms 였다. 두 겹이 같은 그림이라 지금은 안 보이는 차이지만,
    // **애니메이션을 붙일 때는 앞 400ms 가 1겹 아래에서 지나간다고 보고 설계할 것.**
    void Promise.race([
      hideSplashScreen().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, BOOT_SPLASH_HANDOFF_CAP_MS)),
    ]).then(() => {
      setPhase('covering')
    })
  }

  return (
    <View testID="boot-splash" onLayout={handleLayout} style={styles.cover}>
      <Image
        testID="boot-splash-logo"
        source={splashLogo}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  )
}

// 1겹과 같은 값이어야 전환이 안 보인다. 원천은 `app.json` 의 `expo-splash-screen` 블록이고
// 그쪽을 고치면 여기도 함께 고칠 것.
const styles = StyleSheet.create({
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BOOT_SPLASH_BACKGROUND,
  },
  logo: {
    width: BOOT_SPLASH_LOGO_WIDTH,
  },
})
