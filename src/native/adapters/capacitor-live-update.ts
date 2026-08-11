import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { Network } from '@capacitor/network'
import type { LiveUpdatePort, NetworkType } from '@core/native/ports'

/**
 * `LiveUpdatePort` 의 Capacitor(@capgo) 구현([[ADR-127]]).
 *
 * **여기 남는 것은 플러그인 호출 규약뿐이다.** 매니페스트 형식·버전 비교·6상태 판정·적용 순서
 * (닫기 → 커버 → set)는 전부 `native/live-update.ts` 가 갖고 있다 — @capgo → expo-updates 프로토콜
 * 재설계는 별도 결정이고([[ADR-127]] 결정 7), 그때 갈아끼우는 것이 이 파일이다.
 */

const APP_ID = 'com.mapleroutine.app'
// TODO(출시): 실제 App Store 앱 ID로 교체. 아직 스토어 미출시라 placeholder다(ADR-024/ADR-027).
const APP_STORE_ID = '0000000000'

export const capacitorLiveUpdatePort: LiveUpdatePort = {
  // web/개발 서버에는 네이티브 플러그인이 없다.
  isSupported() {
    return Capacitor.getPlatform() !== 'web'
  },

  async notifyAppReady() {
    await CapacitorUpdater.notifyAppReady()
  },

  async getCurrent() {
    const { bundle, native } = await CapacitorUpdater.current()
    return { bundleVersion: bundle.version, nativeVersion: native }
  },

  // CORS는 CapacitorHttp가 네이티브 요청이라 무관하다. 캐시 우회 파라미터·헤더는 호출부가 정해
  // 넘긴다(ADR-026) — 그 결정은 프로토콜이 아니라 정책이다.
  async httpGet({ url, params, headers }) {
    const response = await CapacitorHttp.get({ url, params, headers })
    return { status: response.status, data: response.data }
  },

  // next()로 큐잉하지 않아 자동 적용되지 않는다 — 적용은 사용자가 명시적으로 한다(ADR-027 결정 4).
  async download(params, onProgress) {
    const handle = await CapacitorUpdater.addListener('download', (state) => {
      if (state.bundle?.version === params.version) onProgress(state.percent)
    })
    try {
      const downloaded = await CapacitorUpdater.download(params)
      return { id: downloaded.id }
    } finally {
      await handle.remove()
    }
  },

  // set은 JS 컨텍스트를 파괴하고 재로드한다 — 이후 코드는 실행되지 않는다(ADR-027).
  async applyBundle(id) {
    await CapacitorUpdater.set({ id })
  },

  // 셀룰러면 다운로드 전에 데이터 사용 경고를 띄운다(ADR-027 결정 6). web/구버전 네이티브 셸엔
  // 플러그인이 없어 'unknown'으로 폴백하고(경고 생략), 호출 실패의 폴백은 호출부가 맡는다.
  async getNetworkType() {
    if (Capacitor.getPlatform() === 'web') return 'unknown'
    const status = await Network.getStatus()
    return status.connectionType as NetworkType
  },

  // window.open(_system)은 Capacitor가 외부 앱/브라우저로 넘겨 플러그인이 필요 없다(ADR-027 결정 7).
  // 아직 미출시라 URL/ID는 placeholder.
  openStore() {
    const url =
      Capacitor.getPlatform() === 'ios'
        ? `itms-apps://apps.apple.com/app/id${APP_STORE_ID}`
        : `market://details?id=${APP_ID}`
    window.open(url, '_system')
  },
}
