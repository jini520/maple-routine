// OTA 발행 지문 못박기 ([[ADR-190]]) — 순수 로직이라 `publish-rn-ota.mjs` 에서 갈라 나왔다.
//
// 갈라낸 이유는 **테스트**다. 발행 스크립트 본문은 최상위 `await` 를 쓰는 ESM 이라 jest 가
// import 하지 못하는데, 여기서 걸러야 하는 사고(스토어 사용자 전원에게 거짓 모달)는 사후에
// 알아채기 가장 어려운 종류라 반드시 테스트가 붙어 있어야 한다.

/**
 * 발행 지문을 **못박는 자리** ([[ADR-190]]).
 *
 * ## 왜 [[ADR-137]] 결정 3 을 여기서만 뒤집나
 *
 * 그 결정은 «`runtimeVersion` 을 우리가 안 적는다» 였고 지금도 그것이 정상 상태다. 뒤집는 경우는
 * 하나 — **트리가 스토어 바이너리의 지문을 재현하지 못할 때**. 1.0.6 이 그렇다: 그때의 아카이브가
 * GUI 로 구워져 사후에 재현되지 않고(`docs/trouble/2026-08-19-rn-runtimeversion-drift.md` 원인 ⑤),
 * 그 위에 [[ADR-155]] 가 `android/`·`ios/`·`modules/` 를 루트로 옮겨 격차가 **영구화**됐다.
 *
 * ## 못박지 않으면 무슨 일이 일어나나
 *
 * 이 스크립트는 매니페스트와 **`latest-*.json` 을 함께** 쓰는데, 그 파일은 배달이 아니라
 * **「스토어 업데이트가 필요해요」 판정 파일**이다([[ADR-137]] 결정 4). 트리 계산값으로 덮이는
 * 순간 스토어 사용자는 매니페스트도 못 받고(이름이 다르다) 판정에서도 어긋나, **부팅할 때마다**
 * 스토어에 가도 받을 것이 없는 모달을 본다.
 *
 * ## 값은 지어내는 것이 아니라 **바이너리에서 읽는다**
 *
 * ```bash
 * cat <archive>/Products/Applications/app.app/EXUpdates.bundle/fingerprint
 * unzip -p app-release.aab base/assets/fingerprint
 * ```
 *
 * `binaryAppVersion` 을 함께 적는 것은 이 지문이 어느 바이너리의 것인지가 값만 봐서는 안 읽히기
 * 때문이다.
 *
 * ## `binaryAppVersion` 이 앱 버전보다 낮아 보이는 것은 정상이다
 *
 * 이 값은 사용자에게 보이는 버전이 아니라 **지문의 출처 바이너리**다. 1.0.7 은 스토어 바이너리가
 * 아니라 OTA 라서, 기기에 깔린 바이너리는 여전히 1.0.6 이다(`android/app/build.gradle` 의
 * `versionName "1.0.6"`). 매니페스트의 `appVersion` 이 1.0.7 이고 여기가 1.0.6 인 것이 맞는
 * 상태이며, OTA 를 낼수록 둘은 더 벌어진다.
 *
 * **스탈해 보인다고 올리지 말 것.** 못박은 값과 지금 발행된 판정값이 어긋나면 스토어 사용자에게
 * 거짓 모달이 뜬다(`describePinMismatch` 가 발행 시점에 막는다).
 *
 * ## 다음 스토어 바이너리가 나오면 **비운다**
 *
 * `release.md` 규칙 1~3 을 지켜 구우면 그때부터 트리 계산값이 곧 바이너리의 값이다. 그리고 이
 * 상수가 살아 있는 동안 **네이티브 변경은 OTA 로 못 나간다** — 못박은 지문은 옛 네이티브를
 * 가리킨다.
 */
export const PINNED_RUNTIME_VERSIONS = {
  ios: { runtimeVersion: 'd304704ee9eeedd73d61383372e00849f830f8fb', binaryAppVersion: '1.0.6' },
  android: { runtimeVersion: '3df849c014ea95bb7b0b9dd506094148b0fdc508', binaryAppVersion: '1.0.6' },
}

/**
 * **심사 중인** 바이너리의 지문 ([[ADR-268]] 결정 4). 발행 지문과 **함께** 받아주는 값이다.
 *
 * ## 왜 필요한가
 *
 * 심사 담당자가 실행하는 것은 아직 스토어에 없는 새 바이너리다. `latest-*.json` 은 그 바이너리가
 * 게시된 **뒤에야** 갱신되므로, 심사 시점에는 자기 지문이 안 맞아 스토어 업데이트 필요로 떨어진다.
 * 모달이 `나중에` 로 닫히던 동안은 아무도 안 밟았는데, 잠금이 되면 그 사람은 켜자마자 못 쓰는
 * 앱을 본다. 반대로 미리 갱신하면 기존 사용자가 받을 것 없는 채로 심사 기간 내내 잠긴다.
 *
 * ## 값은 지어내는 것이 아니라 바이너리에서 읽는다
 *
 * `PINNED_RUNTIME_VERSIONS` 와 같은 자리에서 같은 방식으로 읽는다.
 *
 * ```bash
 * cat <archive>/Products/Applications/app.app/EXUpdates.bundle/fingerprint
 * unzip -p app-release.aab base/assets/fingerprint
 * ```
 *
 * 심사 반려로 네이티브를 고쳐 다시 구우면 지문이 바뀌므로 이 값도 함께 갱신한다.
 *
 * ## 게시가 확인되면 **비운다**
 *
 * 비우는 것이 곧 그 플랫폼의 **잠금 스위치**다([[ADR-268]] 결정 3). 안 비우면 아무도 안 잠기는데,
 * 그 방향이 안전한 쪽이라 조용히 지나간다. 플랫폼마다 따로 비운다 - 두 스토어의 게시 시점이 다르다.
 */
export const IN_REVIEW_RUNTIME_VERSIONS = {
  // 2026-09-12 실기기 스모크용 로컬 릴리스 APK(R8 켠 빌드). 스토어에 올라간 것이 아니라
  // **검증용**이라 여기 있는 것이고, 테스트가 끝나면 뺀다.
  //
  // 이 값이 없으면 그 빌드가 부팅하자마자 잠금 모달에 막혀 앱을 못 쓴다. 실제로 에뮬레이터와
  // 갤럭시(SM-F711N) 두 곳에서 그렇게 막혔고, 그것이 곧 심사 담당자가 겪을 일이다.
  android: ['b6621e0d899c6a12cbb3781630cf6bae75bef895'],
}

/**
 * `latest-<platform>.json` 에 실을 **받는 지문 목록** ([[ADR-268]] 결정 2). 발행 지문이 앞이고
 * 심사 중인 것이 뒤다.
 *
 * 같은 값을 겹쳐 싣지 않는 것은, 그 파일을 읽는 사람이 중복을 **서로 다른 바이너리 둘** 로 읽기
 * 때문이다.
 */
export function resolveAcceptedRuntimeVersions(runtimeVersions, inReview) {
  return Object.fromEntries(
    Object.entries(runtimeVersions).map(([platform, runtimeVersion]) => {
      const extra = (inReview?.[platform] ?? []).filter((value) => value !== runtimeVersion)
      return [platform, [runtimeVersion, ...extra]]
    }),
  )
}

/**
 * 플랫폼마다 «실제로 쓸 지문» 을 정한다 — 못박은 값이 트리 계산값을 이긴다([[ADR-190]] 결정 1).
 *
 * `pinned` 를 결과에 함께 실어 보내는 것은 호출부가 **그 사실을 찍어야** 하기 때문이다. 조용히
 * 못박으면 다음 사람이 트리 계산값으로 나가고 있다고 믿는다.
 */
export function resolveRuntimeVersions(computed, pins) {
  return Object.fromEntries(
    Object.entries(computed).map(([platform, value]) => {
      const pin = pins?.[platform] ?? null
      return [platform, { runtimeVersion: pin?.runtimeVersion ?? value, pinned: pin }]
    }),
  )
}

/**
 * 못박은 값이 **지금 발행돼 있는 판정값**과 같은지 본다([[ADR-190]] 결정 2). 어긋나면 그 문장을,
 * 문제없으면 `null` 을 돌린다.
 *
 * 이 한 줄이 이 장치가 지키려는 것을 그대로 검사한다 — 판정 파일과 다른 값을 못박는 순간
 * 「스토어 업데이트가 필요해요」가 살아나므로, 사람이 값을 잘못 베끼는 경로를 여기서 끊는다.
 *
 * 발행된 파일이 아직 없으면(첫 발행) 통과다 — 비교할 대상이 없는 것이지 어긋난 것이 아니다.
 */
export function describePinMismatch(platform, pin, published) {
  if (!pin) return null
  const current = published?.runtimeVersion
  if (!current) return null
  if (current === pin.runtimeVersion) return null

  return (
    `${platform}: 못박은 지문이 지금 발행된 판정값과 다릅니다 — 이대로 나가면 스토어 사용자에게 ` +
    `「스토어 업데이트가 필요해요」 거짓 모달이 뜹니다.\n` +
    `  못박은 값   ${pin.runtimeVersion} (${platform} ${pin.binaryAppVersion} 바이너리)\n` +
    `  발행된 판정 ${current}\n` +
    `  둘 중 무엇이 맞는지는 바이너리에서 읽어 확인하세요(release.md 규칙 2·5).`
  )
}
