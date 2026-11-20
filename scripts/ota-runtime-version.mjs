// OTA 발행 지문 못박기. 순수 로직이라 `publish-rn-ota.mjs` 에서 갈라 나왔다.
//
// 갈라낸 이유는 **테스트**다. 발행 스크립트 본문은 최상위 `await` 를 쓰는 ESM 이라 jest 가
// import 하지 못하는데, 여기서 걸러야 하는 사고(스토어 사용자 전원에게 거짓 모달)는 사후에
// 알아채기 가장 어려운 종류라 반드시 테스트가 붙어 있어야 한다.

/**
 * 발행 지문을 **못박는 자리**.
 *
 * ## 왜 여기서만 `runtimeVersion` 을 우리가 적나
 *
 * 평소에는 fingerprint 정책이 트리에서 계산한 값을 그대로 쓰고, `runtimeVersion` 을 우리가 적지 않는다.
 * 우리가 적는 경우는 하나, **트리가 스토어 바이너리의 지문을 재현하지 못할 때**다. 1.0.6 이 그랬다.
 * 그때의 아카이브가 GUI 로 구워져 사후에 재현되지 않았다(`docs/foundation/release.md` 의 `아카이브`).
 * 그 위에 모노레포를 풀면서 `android/`·`ios/`·`modules/` 를 저장소 루트로 옮겨 격차가 **영구화**됐다.
 *
 * ## 못박지 않으면 무슨 일이 일어나나
 *
 * 발행 스크립트는 매니페스트와 **`latest-*.json` 을 함께** 쓰는데, 그 파일은 배달이 아니라
 * **`스토어 업데이트가 필요해요` 판정 파일**이다. 트리 계산값으로 덮이는 순간 스토어 사용자는
 * 매니페스트도 못 받고(이름이 다르다) 판정에서도 어긋난다. 그러면 스토어에 가도 받을 것이 없는데
 * 닫을 수 없는 스토어 업데이트 모달에 막힌다.
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
 * 아니라 OTA 라서, 그때 기기에 깔린 바이너리는 여전히 1.0.6 이었다. 매니페스트의 `appVersion` 이
 * 1.0.7 이고 여기가 1.0.6 인 것이 맞는 상태이며, OTA 를 낼수록 둘은 더 벌어진다.
 *
 * **스탈해 보인다고 올리지 말 것.** 못박은 값과 지금 발행된 판정값이 어긋나면 스토어 사용자에게
 * 거짓 모달이 뜬다(`describePinMismatch` 가 발행 시점에 막는다).
 *
 * ## 다음 스토어 바이너리가 나오면 **비운다**
 *
 * `docs/foundation/release.md` 의 `빌드하기 전에` 를 지켜 구우면 그때부터 트리 계산값이 곧 바이너리의
 * 값이다. 그리고 이 상수에 발행하는 플랫폼의 값이 있는 동안은 **OTA 를 아예 낼 수 없다**. 발행
 * 스크립트가 빌드 전에 멈춘다(이유는 아래 상수 안의 주석).
 */
export const PINNED_RUNTIME_VERSIONS = {
  // 비었다(2026-09-14). 두 스토어의 1.0.8 이 트리 계산값과 같은 지문으로 게시됐다. 여기 값을 넣으면
  // 발행 스크립트가 발행을 거부한다. 안드로이드 이미지 리소스 이름을 옛 바이너리에 맞추는 장치가 없다.
}

/**
 * **심사 중인** 바이너리의 지문. 발행 지문과 **함께** 받아주는 값이다.
 *
 * ## 왜 필요한가
 *
 * 심사 담당자와 TestFlight 가 실행하는 것은 아직 스토어에 없는 새 바이너리다. 그 지문이
 * `latest-*.json` 의 받는 지문 목록에 없으면, 켜자마자 닫을 수 없는 스토어 업데이트 모달에 막힌다.
 * 업로드한 자리에서 서버 목록에 손으로 더하지만, 발행 스크립트는 발행할 때마다 그 파일을 통째로
 * 다시 쓴다. 이 상수에 없으면 다음 발행이 손으로 더한 값을 지운다.
 *
 * 받는 지문을 새 바이너리의 것 하나로 바꾸면, 반대로 기존 사용자가 받을 것 없는 채로 심사 기간
 * 내내 잠긴다. 그래서 발행 지문과 함께 받는다.
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
 * ## 게시가 확인되면 새 바이너리의 트리에서 **비운다**
 *
 * 비우는 것은 잠금 스위치가 아니다. 옛 바이너리는 새 바이너리의 트리에서 발행할 때 잠긴다. 발행 지문이 새 지문이라
 * 목록에서 옛 지문이 빠지기 때문이다. 그 트리에서 이 값은 발행 지문과 같아 한 번만 실리므로 비우는 것은 정리다.
 *
 * **옛 트리에서 비우면 안 된다.** 목록이 옛 지문 하나가 되어 업로드한 새 바이너리가 잠긴다. 플랫폼마다 따로 한다.
 * 두 스토어의 게시 시점이 다르다.
 */
export const IN_REVIEW_RUNTIME_VERSIONS = {
  // 비었다(2026-11-20). 두 스토어의 1.0.14 게시를 조회로 확인하고 비웠다(App Store 2026-11-20 · Play 상세 1.0.14).
  // 비운 것이 곧 그 플랫폼 1.0.13 기기의 잠금이다.
}

/**
 * `latest-<platform>.json` 에 실을 **받는 지문 목록**. 발행 지문이 앞이고
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
 * 플랫폼마다 **실제로 쓸 지문**을 정한다. 못박은 값이 트리 계산값을 이긴다.
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
 * 못박은 값이 **지금 발행돼 있는 판정값**과 같은지 본다. 어긋나면 그 문장을,
 * 문제없으면 `null` 을 돌린다.
 *
 * 이 한 줄이 이 장치가 지키려는 것을 그대로 검사한다. 판정 파일과 다른 값을 못박는 순간
 * `스토어 업데이트가 필요해요` 가 살아나므로, 사람이 값을 잘못 베끼는 경로를 여기서 끊는다.
 *
 * 발행된 파일이 아직 없으면(첫 발행) 통과다. 비교할 대상이 없는 것이지 어긋난 것이 아니다.
 */
export function describePinMismatch(platform, pin, published) {
  if (!pin) return null
  const current = published?.runtimeVersion
  if (!current) return null
  if (current === pin.runtimeVersion) return null

  return (
    `${platform}: 못박은 지문이 지금 발행된 판정값과 다릅니다. 이대로 나가면 스토어 사용자에게 ` +
    `닫을 수 없는 스토어 업데이트 모달이 거짓으로 뜹니다.\n` +
    `  못박은 값   ${pin.runtimeVersion} (${platform} ${pin.binaryAppVersion} 바이너리)\n` +
    `  발행된 판정 ${current}\n` +
    `  둘 중 무엇이 맞는지는 바이너리에서 읽어 확인하세요(release.md 의 \`업로드하면 곧바로: 지문 등록\` 1).`
  )
}

/** 발행 스크립트가 아는 플랫폼. 순서가 발행 순서다. */
export const PUBLISH_PLATFORMS = ['ios', 'android']

/**
 * 발행할 플랫폼. `--platform ios` 나 `--platform=ios` 를 주면 그 플랫폼만, 안 주면 둘 다.
 *
 * 모르는 값이면 던진다. 오타가 둘 다 발행으로 떨어지면 못 받는 기기가 있는 플랫폼에 번들이 나간다.
 *
 * @param argv `process.argv.slice(2)`
 */
export function resolvePublishPlatforms(argv) {
  const picked = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    let value = null
    if (arg === '--platform') {
      value = argv[i + 1]
      i += 1
      if (value === undefined) throw new Error('--platform 뒤에 ios 나 android 를 주세요.')
    } else if (arg.startsWith('--platform=')) {
      value = arg.slice('--platform='.length)
    } else {
      continue
    }
    if (!PUBLISH_PLATFORMS.includes(value)) {
      throw new Error(`모르는 플랫폼 "${value}" 입니다. ios 나 android 를 주세요.`)
    }
    if (!picked.includes(value)) picked.push(value)
  }
  return picked.length === 0 ? [...PUBLISH_PLATFORMS] : PUBLISH_PLATFORMS.filter((platform) => picked.includes(platform))
}

/** 발행하는 플랫폼의 못박기만 남긴 표. 안 내는 플랫폼의 못박기가 검사와 발행 거부를 걸면 안 된다. */
export function pinsForPlatforms(pins, platforms) {
  return Object.fromEntries(Object.entries(pins ?? {}).filter(([platform]) => platforms.includes(platform)))
}
