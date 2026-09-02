import * as Updates from 'expo-updates'
import { addUpdatesStateChangeListener } from 'expo-updates'
import { Linking, Platform } from 'react-native'
import type { LiveUpdateCheckResult, LiveUpdatePort, NetworkType } from '../ports'
// 내장 번들로 돌 때의 표시 버전. `SettingsScreen` 이 읽는 것과 **같은 파일**이라야 한 화면 안에서
// 두 값이 갈리지 않는다(그쪽은 `packageJson.version` 을 직접 읽는다).
import packageJson from '../../../package.json'
// 매니페스트 URL 의 **원천 한 벌**. `expo-updates` 는 그 값을 JS 로 다시 내주지 않으므로
// (`Updates` 의 내보내기에 `updateUrl` 이 없다. 57.0.13 전수 확인) 여기서 주소를 또 적으면
// 두 벌이 되어 한쪽만 고쳐지는 사고가 열린다. 네이티브가 읽는 그 파일을 그대로 읽는다.
import appJson from '../../../app.json'

/**
 * `LiveUpdatePort` 의 `expo-updates` 구현.
 *
 *  이 *"별도 ADR"* 로 미뤄 두고 `not-implemented.ts` 가 던지던 자리다.
 *
 * ## 이 파일이 번역기 인 이유
 *
 * 포트가 말하는 다섯 갈래(`unsupported`·`error`·`up-to-date`·`store-required`·`update-available`)는
 * **프로토콜과 무관한 **앱이 무엇을 할 수 있나**** 다. `expo-updates` 는 그중 넷을
 * 직접 답하고, **`store-required` 하나만 삼킨다**. 런타임이 안 맞으면 서버가 204 를 주고 클라이언트는
 * 그것을 "업데이트 없음"으로 읽는다. 그대로 두면 사용자에게 *"최신 버전입니다"* 라는 **거짓**이
 * 보이므로, 최신으로 떨어졌을 때만 `/latest` 를 한 번 더 물어 그 갈래를 되살린다(결정 4).
 *
 * ## 여기 없는 것
 *
 * 주소·체크섬·번들 id 가 없다. `fetchUpdateAsync()` 는 **직전 확인이 찾은 것**을 받고
 * `reloadAsync()` 는 **마지막으로 받은 것**을 켠다. 런타임이 자기 안에서 든다. 스토어가 그 값을
 * 안 드는 이유가 그것이고, 그래서 포트 시그니처에서 인자가 사라졌다.
 */

/** 매니페스트 URL 의 형제. 같은 Worker 의 다른 경로다. */
const LATEST_URL = `${appJson.expo.updates.url.replace(/\/manifest$/, '')}/latest`

/**
 * 매니페스트 `extra` 에서 우리 축의 값을 꺼낸다.
 *
 * **전부 선택 필드로 읽는다.** 가 `highlights` 를 필수 검사에 안 넣은 것과 같은 이유이고,
 * 이번에는 더 세다. 매니페스트를 만든 스크립트와 그것을 읽는 앱이 서로 다른 시점의 것일 수 있다.
 * 없으면 모달은 그 부분을 안 그린다(버튼째 없다).
 */
function readExtra(manifest: unknown): { appVersion: string | null; highlights?: string[]; sizeBytes: number } {
  const extra = (manifest as { extra?: Record<string, unknown> } | undefined)?.extra
  const appVersion = typeof extra?.appVersion === 'string' ? extra.appVersion : null
  const rawHighlights = extra?.highlights
  // 빈 배열은 "핵심 목록이 없다"와 같게 다룬다. 실어 보내면 모달이 빈 목록을 여는 버튼을 그린다.
  const highlights =
    Array.isArray(rawHighlights) && rawHighlights.length > 0 && rawHighlights.every((l) => typeof l === 'string')
      ? (rawHighlights as string[])
      : undefined
  const sizeBytes = typeof extra?.sizeBytes === 'number' ? extra.sizeBytes : 0
  return { appVersion, ...(highlights ? { highlights } : {}), sizeBytes }
}

/**
 * 최신일 때만 부르는 확인. 프로토콜이 204 로 삼킨 것을 되살린다.
 *
 * 실패는 **삼킨다.** 여기서 실패했다는 것은 "스토어 업데이트가 필요한지 모른다"는 뜻이지 "확인이
 * 실패했다"가 아니다. 앞의 확인은 이미 성공했고, 곁가지 때문에 그 결과를 오류로 뒤집으면
 *  가 가른 **사용자가 시작하지 않은 실패는 조용히**를 어긴다.
 */
async function checkStoreRequired(): Promise<LiveUpdateCheckResult | null> {
  try {
    const response = await fetch(`${LATEST_URL}?platform=${Platform.OS}&t=${Date.now()}`, {
      headers: { 'cache-control': 'no-cache' },
    })
    if (!response.ok) return null
    const latest = (await response.json()) as { runtimeVersion?: string | null; appVersion?: string | null }
    if (!latest.runtimeVersion || !latest.appVersion) return null
    // 런타임이 같으면 스토어를 거칠 이유가 없다. 그냥 최신이다.
    if (latest.runtimeVersion === Updates.runtimeVersion) return null
    // minNativeVersion 은 **싣지 않는다**: runtimeVersion 은 fingerprint 해시라 사용자에게 보여 줄
    // 이름이 아니다. 모달은 그 줄을 안 그린다.
    return { kind: 'store-required', version: latest.appVersion }
  } catch {
    return null
  }
}

export const rnLiveUpdatePort: LiveUpdatePort = {
  /**
   * 개발 서버(`__DEV__`)에는 업데이트 런타임이 없다. `Updates.isEnabled` 가 그것을 그대로 말한다.
   * 동기인 것이 계약이다(네트워크가 나가기 전에 판정된다).
   */
  isSupported() {
    return Updates.isEnabled
  },

  /**
   * **정당한 no-op 이다**. 이 플랫폼에 그 개념이 없다(`not-implemented.ts` 가 세운 갈림 중
   * 해야 하는데 아직 안 했다 가 아니라 이 플랫폼에 개념이 없다 쪽).
   *
   * @capgo 는 번들이 스스로 *"나 정상이다"* 라고 말해 줘야 했고, 안 말하면 `appReadyTimeout` 뒤에
   * 직전 번들로 되돌렸다(→ 가 그 호출 자리를 `AppShell`
   * 마운트로 옮겼다). `expo-updates` 에는 그 신호를 받는 JS API 가 **없다**. 네이티브
   * `ErrorRecovery` 가 부팅 크래시를 직접 관찰해 되돌린다(`expo-updates@57.0.13` 전수 확인:
   * `src/Updates.ts` 의 내보내기에 `notifyAppReady` 가 없다).
   *
   * 그래서 가 **지키려던 것**(*"렌더가 던지는 번들이 SUCCESS 로 찍혀 영구히
   * 박히면 안 된다"*)은 살아 있고, 그것을 지키는 주체가 우리 코드에서 런타임으로 넘어갔다.
   * 호출부(`AppShell`)는 그대로 두는 것이 맞다. 프로토콜이 또 바뀌면 그 자리가 다시 필요하다.
   */
  async notifyAppReady() {},

  /**
   * 지금 도는 번들의 **사용자 표시 버전**.
   *
   * 프로토콜의 정체성은 `Updates.updateId`(UUID)지만 그것은 사용자에게 아무 뜻이 없다. 우리 축의
   * 버전은 매니페스트 `extra.appVersion` 이고, 내장 번들로 돌 때는 그 값이
   * 없으므로 빌드에 박힌 앱 버전으로 떨어진다.
   */
  async getCurrentVersion() {
    const { appVersion } = readExtra(Updates.manifest)
    return appVersion ?? packageJson.version
  },

  // 채널이 하나로 줄었다. 의 빌드 시점 분리는 사이드로딩 베타를
  // 위한 것이었고 App Store 출시로 용도가 끝났다. 표시값은 남는다(관찰용 UI).
  getChannel() {
    return Updates.channel ?? 'production'
  },

  async check(): Promise<LiveUpdateCheckResult> {
    const result = await Updates.checkForUpdateAsync()
    if (!result.isAvailable) {
      // 프로토콜이 **런타임 불일치** 를 여기로 뭉쳐 넣는다. 갈라서 되살린다(결정 4).
      return (await checkStoreRequired()) ?? { kind: 'up-to-date' }
    }
    const { appVersion, highlights, sizeBytes } = readExtra(result.manifest)
    return {
      kind: 'update-available',
      // 매니페스트에 우리 축의 버전이 없으면(옛 스크립트가 만든 것) 버전 없이 말하지 않는다.
      // 모달이 "새 버전 v… " 를 그리는 자리라, 빈 문자열보다 **알 수 없음** 이 정직하다.
      version: appVersion ?? '알 수 없음',
      size: sizeBytes,
      ...(highlights ? { highlights } : {}),
    }
  },

  /**
   * 사용자 동의 후 받는다.
   *
   * 진행률은 **네이티브 상태 변경 이벤트**로 온다(`downloadProgress` 는 0~1). 의
   * 결정형 진행률이 새 프로토콜에서도 성립한다는 뜻이다. 이벤트가 안 오는 구간이 있어도 완료 시
   * 100 은 스토어가 스스로 찍으므로(그쪽 `runDownload`), 여기서 마지막 100을 지어내지 않는다.
   */
  async download(onProgress) {
    const subscription = addUpdatesStateChangeListener((event) => {
      const progress = event.context.downloadProgress
      if (typeof progress === 'number') onProgress(Math.round(progress * 100))
    })
    try {
      const result = await Updates.fetchUpdateAsync()
      if (!result.isNew && !result.isRollBackToEmbedded) {
        throw new Error('받을 업데이트가 없습니다.')
      }
    } finally {
      subscription.remove()
    }
  },

  // reloadAsync 는 JS 컨텍스트를 파괴하고 새 번들로 재시작한다. 이후 코드는 실행되지 않는다.
  // 앞의 순서(닫기 → 커버)는 core 의 applyLiveUpdate 가 소유한다.
  async apply() {
    await Updates.reloadAsync()
  },

  /**
   * 셀룰러 경고를 위한 네트워크 종류.
   *
   * **`'unknown'` 을 돌린다**. RN 에 네트워크 종류를 묻는 내장 API 가 없고,
   * `@react-native-community/netinfo` 는 **새 네이티브 의존성**이라 재빌드를 부른다. 호출부는
   * `'unknown'` 에서 경고를 생략하므로(의 폴백) 동작은 경고 없이 바로 받는다
   * 가 된다. 없는 사실을 지어내지 않는 대신 경고 한 겹을 잃는 것이고, 되살리려면 그 패키지가
   * 선행 조건이다.
   */
  async getNetworkType(): Promise<NetworkType> {
    return 'unknown'
  },

  // 스토어 업데이트가 필요할 때 스토어를 연다.
  openStore() {
    const url =
      Platform.OS === 'ios'
        ? 'itms-apps://apps.apple.com/app/id6797579391'
        : 'market://details?id=com.mapleroutine.app'
    void Linking.openURL(url)
  },
}
