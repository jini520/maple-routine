// 안드로이드 «옛 바이너리 호환» 에셋 경로 플러그인 ([[ADR-191]]).
//
// ## 왜 있나
//
// 안드로이드는 APK 에 박힌 이미지를 파일이 아니라 **드로어블 리소스**로 들고, 그 리소스 이름을
// Metro 의 `httpServerLocation` 에서 파생한다(`@react-native/assets-registry/path-support` 의
// `getAndroidResourceIdentifier`). 그래서 **에셋의 소스 경로가 곧 리소스 이름**이다.
//
// [[ADR-155]] 가 `packages/core` 를 `src` 로 녹이면서 그 경로가 바뀌었다:
//
//   1.0.6 APK  : /assets/_core/src/assets/themes  →  _core_src_assets_themes_…
//   지금 트리   : /assets/src/assets/themes       →  src_assets_themes_…
//
// 1.0.7 OTA 를 그대로 보냈더니 1.0.6 바이너리가 **자기 APK 에 없는 이름**을 찾게 되어 앱 이미지
// 273개가 전부 빈칸이 됐다(2026-08-30 실기기 확인).
//
// ## 어떻게 고치나 — 추정이 아니라 **역산**이다
//
// 경로를 손으로 짜맞추지 않는다. 기기에서 읽어 온 **APK 의 실제 이름표**(md5 → 리소스 이름)를
// 받아서, 파생 결과가 그 이름과 **글자까지 같아지는** `httpServerLocation` 을 만든다.
//
// 파생 규칙이 `.replace(/\//g,'_')` 이므로, 목표 이름의 `_` 를 `/` 로 되돌린 것이 곧 답이다 —
// 다시 파생시키면 원래 이름으로 돌아온다. `_core…` 처럼 밑줄로 시작하면 `/` 로 시작하는 경로가
// 되는데, 그것이 정확히 모노레포 시절 `../core` 가 남긴 모양이다.
//
// **표에 없는 에셋은 안 건드린다.** APK 에 없다는 뜻이고, 그런 것은 파일로 내려받아
// `localUri` 로 풀리므로 경로와 무관하다.
//
// ## 언제 쓰나 — 못박기와 **함께 살고 함께 죽는다**
//
// 이 플러그인은 «번들이 옛 바이너리를 겨냥한다» 는 뜻이다. 새 스토어 바이너리가 나오면 그쪽
// 드로어블은 `src_assets_…` 라 이 플러그인이 켜져 있으면 **정확히 같은 사고가 거울처럼 뒤집혀**
// 일어난다. `PINNED_RUNTIME_VERSIONS` 를 비우는 날 이것도 함께 끈다([[ADR-190]] 정정 1).
//
// 환경변수로만 켜진다 — 평소 빌드는 이 파일을 지나가지 않는다.

const { createHash } = require('node:crypto')
const { appendFileSync, readFileSync } = require('node:fs')

const MAP_PATH = process.env.OTA_LEGACY_ASSET_MAP
const REPORT_PATH = process.env.OTA_ASSET_REPORT

/**
 * APK 이름표. 한 번만 읽는다(트랜스폼 워커마다 한 벌).
 *
 * 커밋된 파일(`ota/apk-embedded-map-android-1.0.6.json`)은 어느 바이너리의 표인지 적어 두려고
 * `assets` 아래에 감싸 두었다 — 맨 표를 그대로 줘도 받는다.
 */
let legacyMap = null
function getLegacyMap() {
  if (legacyMap === null) {
    const raw = MAP_PATH ? JSON.parse(readFileSync(MAP_PATH, 'utf-8')) : {}
    legacyMap = raw.assets ?? raw
  }
  return legacyMap
}

/**
 * `@react-native/assets-registry/path-support` 의 `getAndroidResourceIdentifier` 와 **같은 계산**.
 * 베끼는 것이 아니라 **대조하는 자**다 — 아래 검증이 이 함수로 APK 이름표와 맞춰 본다.
 */
function androidResourceIdentifier(httpServerLocation, name) {
  const base = httpServerLocation.startsWith('/') ? httpServerLocation.slice(1) : httpServerLocation
  return `${base}/${name}`
    .toLowerCase()
    .replace(/\//g, '_')
    .replace(/([^a-z0-9_])/g, '')
    .replace(/^(?:assets|assetsunstable_path)_/, '')
}

function md5File(path) {
  return createHash('md5').update(readFileSync(path)).digest('hex')
}

module.exports = function legacyAssetPaths(asset) {
  const map = getLegacyMap()

  // `fileHashes` 는 이 시점에 아직 없다(expo 가 export 단계에서 붙인다) — 그래서 직접 잰다.
  let target = null
  for (const file of asset.files ?? []) {
    const entry = map[md5File(file)]
    if (entry) {
      target = entry.name
      break
    }
  }

  const before = asset.httpServerLocation
  let after = before

  if (target !== null) {
    // 이름만 같은 규칙으로 씻는다 — `androidResourceIdentifier` 를 빈 경로로 부르면 앞에 `/` 가
    // 붙어 밑줄이 하나 더 생긴다.
    const cleanName = asset.name
      .toLowerCase()
      .replace(/\//g, '_')
      .replace(/([^a-z0-9_])/g, '')
    const suffix = `_${cleanName}`
    if (!target.endsWith(suffix)) {
      // 이름의 꼬리가 안 맞으면 역산이 성립하지 않는다. **조용히 넘어가지 않는다** — 그대로 두면
      // 그 에셋 하나가 화면에서 빈칸이 되고, 그것이 이 파일이 막으려는 바로 그 사고다.
      throw new Error(
        `[ota-legacy-asset-paths] 역산 실패: APK 이름 "${target}" 이 에셋 이름 "${asset.name}" 으로 안 끝난다`,
      )
    }
    // `_` 를 `/` 로 되돌리면, 파생이 그것을 다시 `_` 로 만들어 원래 이름이 나온다.
    after = `/assets/${target.slice(0, -suffix.length).replace(/_/g, '/')}`
    asset.httpServerLocation = after
  }

  if (REPORT_PATH) {
    appendFileSync(
      REPORT_PATH,
      `${JSON.stringify({
        name: asset.name,
        type: asset.type,
        hashes: (asset.files ?? []).map(md5File),
        before,
        after,
        identifier: androidResourceIdentifier(after, asset.name),
        target,
      })}\n`,
    )
  }

  return asset
}

module.exports.androidResourceIdentifier = androidResourceIdentifier

/**
 * 발행 관문 ([[ADR-191]] 결정 3). APK 이름표의 **모든** 항목이 이번 번들에서 같은 이름으로
 * 파생되는지 본다 — 하나라도 어긋나면 그 그림은 기기에서 빈칸이 된다.
 *
 * `reportLines` 는 플러그인이 남긴 JSONL 이다. 같은 에셋이 워커·플랫폼마다 여러 번 나오므로
 * 해시로 접는다.
 */
function summarizeLegacyAssetCoverage(apkMap, reportLines) {
  const byHash = new Map()
  for (const line of reportLines) {
    if (!line.trim()) continue
    const row = JSON.parse(line)
    for (const hash of row.hashes) byHash.set(hash, row)
  }

  const mismatched = []
  const missing = []
  let matched = 0
  let unembedded = 0
  for (const [hash, entry] of Object.entries(apkMap)) {
    const row = byHash.get(hash)

    // **일부러 뺀 것** — 원본 바이트를 바꿔 APK 드로어블 대신 파일로 내려받게 만든 에셋을 위한
    // 갈래다. 번들에 **없어야** 정상이고, 도로 나타났다면 그 바이트 변경이 풀렸다는 뜻이므로
    // «있음» 쪽을 막는다(예외를 «무시» 가 아니라 반대 방향의 검사로 둔다).
    //
    // **지금 이 표식을 단 항목은 없다.** 처음 쓴 자리([[ADR-192]])가 반증돼 되돌아갔고, 갈래만
    // 남겨 둔다 — 임베드에서 빼는 판단이 다시 필요해지면 그때 표에 표식을 단다.
    if (entry.replacedByDownload === true) {
      if (row === undefined) unembedded += 1
      else mismatched.push({ hash, expected: '(번들에 없어야 한다 — ADR-192)', actual: row.identifier })
      continue
    }

    if (row === undefined) {
      missing.push({ hash, expected: entry.name })
    } else if (row.identifier !== entry.name) {
      mismatched.push({ hash, expected: entry.name, actual: row.identifier })
    } else {
      matched += 1
    }
  }

  return { matched, mismatched, missing, unembedded }
}

module.exports.summarizeLegacyAssetCoverage = summarizeLegacyAssetCoverage
