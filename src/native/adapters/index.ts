import {
  setAdsPort,
  setBackGesturePort,
  setHuntingTimerPort,
  setKeyboardPort,
  setLiveUpdatePort,
  setNotificationsPort,
  setSplashScreenPort,
  setStatusBarPort,
  setSystemBarsPort,
} from '../ports'
import { capacitorAdsPort } from './capacitor-ads'
import { capacitorBackGesturePort } from './capacitor-back-gesture'
import { capacitorHuntingTimerPort } from './capacitor-hunting-timer'
import { capacitorKeyboardPort } from './capacitor-keyboard'
import { capacitorLiveUpdatePort } from './capacitor-live-update'
import { capacitorNotificationsPort } from './capacitor-notifications'
import { capacitorSplashScreenPort } from './capacitor-splash-screen'
import { capacitorStatusBarPort } from './capacitor-status-bar'
import { capacitorSystemBarsPort } from './capacitor-system-bars'

/**
 * 네이티브 포트 아홉을 한 번에 주입한다([[ADR-127]]).
 *
 * 저장소 포트는 둘이라 `main.tsx` 가 직접 세터를 불렀지만, 이쪽은 하나라도 빠지면 그 기능만 조용히
 * 던지므로 "전부"를 한 자리에서 보장한다. 주입 순서는 서로 무관하다 — 포트끼리 참조하지 않는다.
 */
export function installCapacitorNativePorts(): void {
  setAdsPort(capacitorAdsPort)
  setBackGesturePort(capacitorBackGesturePort)
  setHuntingTimerPort(capacitorHuntingTimerPort)
  setKeyboardPort(capacitorKeyboardPort)
  setLiveUpdatePort(capacitorLiveUpdatePort)
  setNotificationsPort(capacitorNotificationsPort)
  setSplashScreenPort(capacitorSplashScreenPort)
  setStatusBarPort(capacitorStatusBarPort)
  setSystemBarsPort(capacitorSystemBarsPort)
}
