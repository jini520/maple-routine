import { Accelerometer } from 'expo-sensors'
import { Platform } from 'react-native'

import type { Tilt, TiltPort } from '../ports'

/** 빛이 손을 따라오는 데 충분한 간격. 더 촘촘하면 배터리만 먹고 눈에는 차이가 없다. */
const UPDATE_INTERVAL_MS = 33

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value))
}

/**
 * `TiltPort` 의 RN 구현. 가속도계의 중력 성분(단위 g)을 iOS 의 부호로 맞춰 기울기로 쓰는 어댑터.
 *
 * 센서가 없는 기기(시뮬레이터 포함)는 구독하지 않는다. 가용성 확인이 비동기라 그 사이에 해제되면 구독을 열지 않는다.
 */
export const rnTiltPort: TiltPort = {
  subscribe(listener: (tilt: Tilt) => void) {
    let subscription: { remove: () => void } | null = null
    let released = false

    void Accelerometer.isAvailableAsync()
      .then((available) => {
        if (!available || released) return
        // 안드로이드 가속도계는 iOS 와 부호가 반대다. 뒤집지 않으면 같은 쪽으로 기울여도 빛이 플랫폼마다 반대로 밀린다.
        const sign = Platform.OS === 'android' ? -1 : 1
        Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS)
        subscription = Accelerometer.addListener(({ x, y }) => listener({ x: clampUnit(sign * x), y: clampUnit(sign * y) }))
      })
      .catch(() => undefined)

    return () => {
      released = true
      subscription?.remove()
      subscription = null
    }
  },
}
