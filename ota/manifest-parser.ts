/**
 * 캐패시터 앱 **1.0.6 번들에 실린 매니페스트 파서의 동결 사본**([[ADR-155]] 결정 5).
 *
 * ── 고치지 말 것 ──────────────────────────────────────────────────────────────────
 *
 * 이 파일이 답하는 질문은 *"기기에 있는 그 앱이 `ota/latest.json` 을 읽을 수 있는가"* 다.
 * 그 앱은 **1.0.6 에서 영원히 멈춰 있다** — 캐패시터 소스가 저장소에서 사라졌고, 새 번들을 구울
 * 방법도 그것을 받을 경로도 없다([[ADR-154]] 결정 4: 게이트가 켜지면 새 번들은 다운로드 자체가
 * 안 된다).
 *
 * 그러니 참조 대상도 멈춰 있어야 한다. 여기를 «개선» 하는 순간 `ota/__tests__/latest.test.mjs` 는
 * 기기의 현실이 아니라 저장소의 현재를 검사하게 되고, 그때부터 초록은 아무것도 보장하지 않는다.
 *
 * ── 출처 ──────────────────────────────────────────────────────────────────────────
 *
 * `packages/app-capacitor/src/native/adapters/capacitor-live-update.ts` (커밋 `f8228484`) 의
 * `LiveUpdateManifest` · `parseLiveUpdateManifest` 를 **그대로** 옮겼다. 원본은 @capgo 플러그인과
 * core 포트를 import 했지만 이 둘은 그 어느 것도 안 쓴다(순수 함수라 잘라 낼 수 있었다).
 * 주석까지 원본 그대로이고, 지운 것은 없다.
 */

/**
 * @capgo 매니페스트([[ADR-022]] 가 형식을 정했다).
 *
 * 이 형식은 **이 앱 전용**이다 — RN 은 Expo Updates 프로토콜의 매니페스트를 쓰고, 두 형식 사이에
 * 공통분모를 만들려 하지 않았다([[ADR-137]] 결정 6: 공통인 것은 형식이 아니라 «앱이 무엇을 할 수
 * 있나» 다).
 */
export interface LiveUpdateManifest {
  version: string
  url: string
  checksum: string
  size: number // zip 바이트 — 다운로드 전 사용자에게 용량을 안내([[ADR-027]])
  minNativeVersion?: string // 이 번들을 적용하려면 필요한 최소 네이티브 버전(스토어 업데이트 게이트, [[ADR-027]])
  // 이 버전의 **핵심 목록** 3~4줄([[ADR-119]] → [[ADR-126]] 결정 2). 원천은
  // packages/core/src/data/release-notes.ts 한 벌이고, 배포 스크립트가 배포하는 버전의 highlights
  // 만 뽑아 여기로 파생시킨다 — 여기서 그 파일을 읽지 않는다(원격에서 온 값이다).
  //
  // minNativeVersion과 같은 이유로 **선택 필드**다: 이미 발행된 옛 매니페스트에는 이 필드가 없고,
  // 필수로 만들면 그것을 읽는 기존 설치본이 전부 파싱 실패(null → check-error)해 업데이트를 못 받는다.
  // 매니페스트는 URL 고정·내용 가변이라 옛 앱이 새 파일을, 새 앱이 옛 파일을 읽는 조합이 둘 다 실재한다.
  highlights?: string[]
  // 이 목록에 든 플랫폼(`Capacitor.getPlatform()` 문자열)은 **스토어로 보낸다**([[ADR-154]]).
  //
  // 이 앱은 RN 바이너리로 대체됐고, 갱신이 끝난 플랫폼에 「최신입니다」를 돌려주는 것은 거짓이다.
  // `minNativeVersion` 과 답하는 질문이 다르다 — 그쪽은 *"이 번들을 적용할 수 있는가"*(번들의
  // 성질)이고 이쪽은 *"이 플랫폼이 아직 이 앱을 쓰는 것이 맞는가"*(앱의 수명)다. 한 필드에 두
  // 뜻을 얹으면 다음에 읽는 사람이 어느 쪽인지 못 가린다.
  //
  // 위 둘과 **같은 이유로 선택 필드**다(아래 파서 참고).
  storeRequiredPlatforms?: string[]
}

// GitHub Releases의 CDN은 자산을 application/octet-stream으로 내려주므로, CapacitorHttp가
// content-type을 보고 JSON으로 자동 파싱하지 않고 response.data를 "문자열" 그대로 준다(iOS 실측, [[ADR-026]]).
// 문자열이면 직접 파싱하고, 이미 객체면 그대로 쓴다. 형식이 어긋나면 null을 돌려 조용히 중단한다.
export function parseLiveUpdateManifest(data: unknown): LiveUpdateManifest | null {
  let parsed: unknown
  try {
    parsed = typeof data === 'string' ? JSON.parse(data) : data
  } catch {
    return null
  }
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    typeof (parsed as LiveUpdateManifest).version === 'string' &&
    typeof (parsed as LiveUpdateManifest).url === 'string' &&
    typeof (parsed as LiveUpdateManifest).checksum === 'string' &&
    typeof (parsed as LiveUpdateManifest).size === 'number'
  ) {
    const minNativeVersion = (parsed as LiveUpdateManifest).minNativeVersion
    const highlights = (parsed as LiveUpdateManifest).highlights
    // 빈 배열은 "핵심 목록이 없다"와 같게 다룬다 — 실어 보내면 모달이 빈 목록을 여는 버튼을 그린다.
    const hasHighlights =
      Array.isArray(highlights) && highlights.length > 0 && highlights.every((line) => typeof line === 'string')
    // 같은 판정을 스토어 유도 목록에도 쓴다([[ADR-154]] 결정 3). 형식이 어긋나면 매니페스트를
    // 버리는 것이 아니라 **그 필드만** 뺀다 — 유도 하나 때문에 업데이트 경로 전체를 죽이지 않는다.
    const storeRequiredPlatforms = (parsed as LiveUpdateManifest).storeRequiredPlatforms
    const hasStoreRequired =
      Array.isArray(storeRequiredPlatforms) &&
      storeRequiredPlatforms.length > 0 &&
      storeRequiredPlatforms.every((name) => typeof name === 'string')
    return {
      version: (parsed as LiveUpdateManifest).version,
      url: (parsed as LiveUpdateManifest).url,
      checksum: (parsed as LiveUpdateManifest).checksum,
      size: (parsed as LiveUpdateManifest).size,
      ...(typeof minNativeVersion === 'string' ? { minNativeVersion } : {}),
      ...(hasHighlights ? { highlights } : {}),
      ...(hasStoreRequired ? { storeRequiredPlatforms } : {}),
    }
  }
  return null
}
