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
