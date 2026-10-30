#!/usr/bin/env node
// RN OTA 배포 스크립트 ([[ADR-137]]). capacitor 쪽 `publish-live-update.mjs` 의 짝이고, 두 앱이
// **서로 다른 프로토콜**을 쓰는 동안 둘 다 산다([[ADR-137]] 대가 4).
//
// 사용법: node scripts/publish-rn-ota.mjs [--platform ios|android]
//   --platform 을 주면 그 플랫폼만 발행한다(release.md 규칙 4-1). 안 주면 둘 다.
//
// 배포 버전은 CLI 인자로 받지 않고 app.json 의 expo.version 을 그대로 쓴다 —
// capacitor 스크립트가 같은 이유를 적어 두었다(버전을 인자로 받으면 앱에 박히는 표시값과 실제
// 배포된 버전이 어긋나고, 그것은 배포되고 나서야 드러난다).
//
// 동작: 노트 가드 → expo export → runtimeVersion 해석 → 에셋 업로드(없는 것만) → 매니페스트 생성·업로드 → 옛 파일 정리 → 왕복 확인
//
// ## capacitor 스크립트와 갈리는 지점 셋
//
// 1. **zip 한 덩이가 아니라 파일 여럿**이다. `expo-updates` 는 매니페스트 + 에셋 목록 모델이고,
//    에셋 이름이 이미 내용의 md5 라 «서버에 이미 있는 이름은 건너뛴다» 하나로 증분 업로드가 된다
//    ([[ADR-137]] 결정 8). 실측 293개 중 JS 만 고친 배포는 번들 2개만 오른다.
// 2. **버전 축이 둘**이다. 프로토콜의 정체성은 매니페스트 `id`(UUID)이고, 사용자에게 보이는
//    `1.0.6` 은 우리 축이라 `extra.appVersion` 으로 싣는다([[ADR-137]] 결정 5).
// 3. **`runtimeVersion` 을 우리가 안 적는다.** fingerprint 정책이라 네이티브 그래프에서 계산되고,
//    여기서는 그 값을 CLI 에 물어 파일 이름에 넣기만 한다([[ADR-137]] 결정 3).

import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
// 릴리스 노트의 진실 원천을 **그대로** 읽는다([[ADR-119]] 결정 1) — capacitor 스크립트와 같은 파일을
// 같은 이유로 읽는다. 노트가 두 벌이 되면 갈라진 순간 어느 쪽이 사실인지 알 방법이 없다.
import { findReleaseNote } from '../src/data/release-notes.ts'
import { baseAppVersion, parseAppVersion } from '../src/lib/app-version.ts'
// 노트 가드([[ADR-126]] 결정 8). **캐패시터 스크립트에 살던 것을 옮겨 왔다** — [[ADR-155]] 가 그
// 패키지를 지우면서 이 import 가 고아가 됐고, 그때부터 이 파일은 첫 줄에서 죽어 있었다.
import { describeReleaseNoteGap } from './release-note-gap.mjs'
import { selectRetainedFiles } from './ota-retention.mjs'
// 지문 못박기는 **순수 로직이라 따로 산다**([[ADR-190]]) — 이 파일이 최상위 `await` 를 쓰는 ESM
// 이라 테스트가 import 하지 못하기 때문이다. 그쪽에는 테스트가 붙어 있다.
import {
  IN_REVIEW_RUNTIME_VERSIONS,
  PINNED_RUNTIME_VERSIONS,
  describePinMismatch,
  pinsForPlatforms,
  resolveAcceptedRuntimeVersions,
  resolvePublishPlatforms,
  resolveRuntimeVersions,
} from './ota-runtime-version.mjs'

// 1.0.13 바이너리부터 OTA 는 앱 박스가 내준다. 1.0.12 바이너리가 묻는 GitHub Releases 와 Worker 에는 더 이상 쓰지 않는다.
const OTA_HOST = 'ubuntu@158.179.175.230'
const OTA_DIR = '/srv/maple-routine-ota'
/** 번들과 에셋을 nginx 가 내주는 주소. 서버의 `files/` 디렉터리다. */
const FILES_BASE = 'https://mapleroutine.store/ota/files'
/** 파일을 남기는 최근 발행 수. 바로 지난 발행을 받던 기기가 아직 내려받는 중일 수 있어 하나가 아니라 셋이다. */
const KEEP_RELEASES = 3

/** 앱 박스에서 명령 하나를 돌리고 출력을 돌려준다. */
function onBox(command) {
  return execFileSync('ssh', ['-o', 'BatchMode=yes', OTA_HOST, command], { encoding: 'utf-8' })
}

/** 스토어 이동 대상([[ADR-027]] 결정 7 · `extra.storeUrl`). */
const STORE_URLS = {
  ios: 'https://apps.apple.com/app/id6797579391',
  android: 'https://play.google.com/store/apps/details?id=com.mapleroutine.app',
}

/**
 * `dist/` 의 파일 하나를 서버 `files/` 의 이름으로 바꾼다.
 *
 * 평평한 이름 공간에 넣어도 안전한 근거는 실측이다 — `expo export` 산출물의 기본 이름 충돌이
 * **0건**이었다(에셋은 내용 md5, 번들 이름엔 플랫폼이 들어간다).
 */
export function releaseAssetName(distRelativePath) {
  return basename(distRelativePath)
}

/**
 * 매니페스트 한 장([[ADR-137]] 결정 5).
 *
 * `extra` 에 넣는 넷은 프로토콜에 자리가 없어서 넣는 것이지 곁다리가 아니다 — 모달이 «버전 + 용량»
 * 을 말하고([[ADR-027]]) 「자세히 보기」가 핵심 목록을 펼치고([[ADR-126]] 결정 1) 설정 화면이
 * 「사용 중」을 판정하는 재료가 전부 여기서 온다.
 */
export function buildManifest({ id, createdAt, runtimeVersion, platform, bundle, assets, appVersion, highlights }) {
  // 번들은 같은 주소로 내도 nginx 의 `gzip_static` 이 옆의 `.gz` 를 압축된 채 내준다. 해시는 압축하지 않은 번들의 것이다.
  // 기기는 응답을 풀어서 저장하고 푼 내용으로 확인한다.
  const urlFor = (name) => `${FILES_BASE}/${name}`
  return {
    id,
    createdAt,
    runtimeVersion,
    launchAsset: {
      key: bundle.key,
      contentType: 'application/javascript',
      url: urlFor(bundle.name),
      hash: bundle.hash,
    },
    assets: assets.map((asset) => ({
      key: asset.key,
      contentType: asset.contentType,
      fileExtension: `.${asset.ext}`,
      url: urlFor(asset.name),
      hash: asset.hash,
    })),
    metadata: {},
    extra: {
      appVersion,
      highlights,
      // 이 번들을 받는 데 드는 바이트. 프로토콜엔 용량 필드가 없는데 [[ADR-027]] 이 모달의 재료를
      // «버전 + 용량» 으로 정했다. 이미 기기에 있는 에셋은 안 받으므로(`path.exists()` →
      // ALREADY_EXISTS) **번들 크기**가 사용자가 실제로 기다리는 양에 가장 가깝다.
      // 압축한 크기를 싣는다. 실제로 받는 양이고, 앱은 이 값이 5MB 이하면 묻지 않고 받는다.
      sizeBytes: bundle.compressedSize,
      storeUrl: STORE_URLS[platform],
    },
  }
}

/**
 * `expo-updates` 가 에셋 파일을 저장할 때 쓰는 키.
 *
 * 클라이언트가 «같은 key 면 같은 에셋» 으로 취급하므로(`guides/general.md`), 내용 해시를 그대로
 * 쓰는 것이 그 가정과 정확히 맞는다.
 */
function sha256Base64Url(buffer) {
  return createHash('sha256').update(buffer).digest('base64url')
}

function md5Hex(buffer) {
  return createHash('md5').update(buffer).digest('hex')
}

const CONTENT_TYPES = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  ttf: 'font/ttf',
  otf: 'font/otf',
  json: 'application/json',
}

function contentTypeFor(ext) {
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // 저장소 루트가 곧 앱 프로젝트다([[ADR-155]] 결정 2) — 종전 `packages/app-rn` 자리다.
  const appDir = join(import.meta.dirname, '..')
  const distDir = join(appDir, 'dist')

  let PLATFORMS
  try {
    PLATFORMS = resolvePublishPlatforms(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
  // 안 내는 플랫폼의 못박기는 검사도 이름표 요구도 걸지 않는다.
  const pins = pinsForPlatforms(PINNED_RUNTIME_VERSIONS, PLATFORMS)
  console.log(`발행 플랫폼: ${PLATFORMS.join(', ')}`)

  // OTA 버전은 `package.json` 이 든다. 스토어 버전(`app.json` 의 `expo.version`)과 **맞추지 않는다**.
  // `app.json` 은 지문 재료라, OTA 버전을 올리려고 건드리면 스토어 바이너리가 이 번들을 못 받는다.
  const { version: appVersion } = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf-8'))
  const appConfig = JSON.parse(readFileSync(join(appDir, 'app.json'), 'utf-8'))
  // 같은 버전의 버그 수정은 패치 번호를 붙인다(`1.0.10+1`, 화면은 `1.0.10(1)`).
  if (!appVersion || parseAppVersion(appVersion) === null) {
    console.error(`package.json 의 version("${appVersion}")이 x.y.z 또는 x.y.z+n 형식이 아닙니다.`)
    process.exit(1)
  }

  // 노트·핵심 목록 없이는 배포가 나가지 않는다([[ADR-119]] 결정 6 + [[ADR-126]] 결정 8).
  // 빌드(몇 분)보다 **앞**인 것이 요점이다 — capacitor 스크립트가 같은 자리에 둔 이유와 같다.
  // 패치 노트는 기본 버전 노트에 이어 붙인다. `1.0.10+1` 은 `1.0.10` 노트를 쓴다.
  const noteVersion = baseAppVersion(appVersion)
  const note = findReleaseNote(noteVersion)
  const gap = describeReleaseNoteGap(note)
  if (gap !== null) {
    console.error(`src/data/release-notes.ts 의 ${noteVersion}: ${gap}`)
    process.exit(1)
  }

  // ── 못박은 지문 대조 ([[ADR-190]] 결정 2) ────────────────────────────────────────
  //
  // **노트 가드와 같은 자리**에 둔다 — 빌드(몇 분) 앞이라야 고칠 시간이 있고, 여기서 걸리는
  // 사고는 «배포는 성공했는데 스토어 사용자 전원에게 거짓 모달» 이라 사후에 알아채기 가장 어렵다.
  const latestBaseUrl = `${appConfig.expo.updates.url.replace(/\/manifest$/, '')}/latest`
  for (const platform of PLATFORMS) {
    const pin = pins[platform]
    if (!pin) continue

    let published = null
    try {
      const response = await fetch(`${latestBaseUrl}?platform=${platform}&t=${Date.now()}`, {
        headers: { 'cache-control': 'no-cache' },
      })
      published = response.ok ? await response.json() : null
    } catch {
      // 조회 자체가 실패하면 «어긋났다» 를 말할 근거가 없다 — 그때는 못 막는다(앱의
      // `checkStoreRequired` 가 같은 이유로 실패를 삼킨다).
      published = null
    }

    const mismatch = describePinMismatch(platform, pin, published)
    if (mismatch !== null) {
      console.error(mismatch)
      process.exit(1)
    }
  }

  // 못박은 번들은 옛 바이너리를 겨냥하는데, 안드로이드는 이미지를 소스 경로에서 파생한 리소스 이름으로
  // 들고 있어 트리가 갈리면 그 이름도 갈린다(1.0.7 에서 이미지 273개가 빈칸). 그 이름을 맞추던 장치를
  // 걷었으므로 못박은 발행은 나가지 않는다.
  if (Object.keys(pins).length > 0) {
    console.error(
      `지문을 못박은 발행입니다(${Object.keys(pins).join(', ')}). 에셋 이름을 옛 바이너리에 맞추는 장치가 없어 나갈 수 없습니다.\n` +
        '  git log -- scripts/ota-legacy-asset-paths.cjs 에서 되살리세요(docs/foundation/release.md 규칙 6).',
    )
    process.exit(1)
  }

  console.log('[1/5] expo export 중...')
  execFileSync('npx', ['expo', 'export', ...PLATFORMS.flatMap((platform) => ['--platform', platform]), '--output-dir', 'dist'], {
    cwd: appDir,
    stdio: 'inherit',
  })

  const metadata = JSON.parse(readFileSync(join(distDir, 'metadata.json'), 'utf-8'))

  console.log('[2/5] runtimeVersion 해석 중...')
  // fingerprint 정책이라 값이 **계산된다**([[ADR-137]] 결정 3). 우리가 적지 않는 것이 요점이다.
  // 출력은 **JSON** 이다(`{"runtimeVersion":"…","fingerprintSources":[…]}`) — 맨 줄을 그대로
  // 쓰면 JSON 통째로 파일 이름에 들어간다. 실측으로 확인한 형식이고, 형식이 바뀌면 아래 가드가
  // 파일 이름을 만들기 전에 막는다.
  const computedRuntimeVersions = Object.fromEntries(
    PLATFORMS.map((platform) => [
      platform,
      JSON.parse(
        execFileSync('npx', ['expo-updates', 'runtimeversion:resolve', '--platform', platform], {
          cwd: appDir,
          encoding: 'utf-8',
        }),
      ).runtimeVersion,
    ]),
  )

  // 못박은 값이 있으면 그것이 이긴다([[ADR-190]] 결정 1) — 트리가 스토어 바이너리의 지문을
  // 재현하지 못하는 동안의 상태다.
  const resolved = resolveRuntimeVersions(computedRuntimeVersions, pins)
  const runtimeVersions = Object.fromEntries(
    Object.entries(resolved).map(([platform, entry]) => [platform, entry.runtimeVersion]),
  )

  for (const platform of PLATFORMS) {
    const value = runtimeVersions[platform]
    if (!/^[A-Za-z0-9._-]+$/.test(value)) {
      console.error(`${platform} 의 runtimeVersion 해석 결과가 파일 이름으로 쓸 수 없습니다: "${value}"`)
      process.exit(1)
    }
  }

  for (const platform of PLATFORMS) {
    const { pinned } = resolved[platform]
    // **조용히 못박지 않는다** — 다음 사람이 트리 계산값으로 나가고 있다고 믿으면 안 된다.
    console.log(
      pinned
        ? `      ${platform}=${runtimeVersions[platform]} ⚑ 못박음(${pinned.binaryAppVersion} 스토어 바이너리) · 트리 계산값 ${computedRuntimeVersions[platform]} 은 안 씀`
        : `      ${platform}=${runtimeVersions[platform]}`,
    )
  }

  console.log('[3/5] 서버에 이미 있는 파일 확인 중...')
  let existing
  try {
    existing = new Set(onBox(`ls -1 ${OTA_DIR}/files`).split('\n').filter(Boolean))
  } catch {
    console.error(
      `${OTA_HOST}:${OTA_DIR}/files 를 읽지 못했습니다. 디렉터리가 없다면 서버 README 의 OTA 절대로 만드세요.\n` +
        `  sudo install -d -o ubuntu -g ubuntu -m 755 ${OTA_DIR} ${OTA_DIR}/files`,
    )
    process.exit(1)
  }

  const workDir = mkdtempSync(join(tmpdir(), 'rn-ota-'))

  // ── 올릴 것을 **`metadata.json` 에서** 정한다(디렉터리를 훑지 않는다) ──────────────────
  //
  // 훑던 코드가 실제 사고를 냈다(2026-08-14). 전제는 «파일 이름이 곧 내용» 이었는데 **번들에는
  // 그것이 거짓**이다:
  //   · `assets/<md5>` — 이름이 내용의 md5 다(293/293 실측 확인). 전제가 참이다.
  //   · `_expo/static/js/<platform>/index-<hash>.hbc` — 그 `<hash>` 는 Hermes **이전** 단계의
  //     것이라, **같은 이름으로 다른 바이트**가 나온다.
  //
  // 그래서 두 번째 배포에서 «이미 있는 이름» 으로 걸러져 번들이 안 올라갔고, 매니페스트에는 새로
  // 계산한 sha256 이 실렸다. 앱은 받아서 해시를 대조하다 실패한다 —
  // `AssetsFailedToLoad ... SHA-256 did not match expected`. 배포도 성공하고 매니페스트도 멀쩡해
  // **앱을 실제로 실행하기 전에는 아무 데서도 안 드러난다.**
  //
  // 처방은 번들을 **자기 sha256 으로 이름 지어** 전제를 참으로 만드는 것이다. 이름이 내용에서
  // 파생되면 «같은 이름 = 같은 내용» 이 규칙이 아니라 **구조**가 된다.
  const plans = PLATFORMS.map((platform) => {
    const fileMetadata = metadata.fileMetadata[platform]
    const bundlePath = join(distDir, fileMetadata.bundle)
    const bundleBuffer = readFileSync(bundlePath)
    // 내용에서 파생된 이름 — 위 사고를 구조적으로 불가능하게 만드는 한 줄이다.
    const bundleName = `bundle-${platform}-${createHash('sha256').update(bundleBuffer).digest('hex')}.hbc`
    // nginx 가 그대로 내줄 압축본. 이름이 원본 이름에서 나오므로 같은 이름이면 같은 내용이다.
    const compressed = gzipSync(bundleBuffer, { level: 9 })
    const compressedPath = `${bundlePath}.gz`
    writeFileSync(compressedPath, compressed)
    return {
      platform,
      bundle: {
        localPath: bundlePath,
        name: bundleName,
        key: md5Hex(bundleBuffer),
        hash: sha256Base64Url(bundleBuffer),
        size: statSync(bundlePath).size,
        compressedSize: compressed.length,
      },
      compressedBundle: { localPath: compressedPath, name: `${bundleName}.gz` },
      assets: fileMetadata.assets.map((asset) => {
        const localPath = join(distDir, asset.path)
        const buffer = readFileSync(localPath)
        return {
          localPath,
          // 에셋은 Metro 가 이미 내용 md5 로 이름 짓는다 — 그대로 쓴다.
          name: releaseAssetName(asset.path),
          key: md5Hex(buffer),
          ext: asset.ext,
          contentType: contentTypeFor(asset.ext),
          hash: sha256Base64Url(buffer),
        }
      }),
    }
  })

  // 두 플랫폼이 같은 에셋을 공유하므로 이름으로 합친다.
  const uploadTargets = new Map()
  for (const plan of plans) {
    for (const entry of [plan.bundle, plan.compressedBundle, ...plan.assets]) {
      if (!uploadTargets.has(entry.name)) uploadTargets.set(entry.name, entry.localPath)
    }
  }

  // 올릴 파일만 모은 디렉터리를 rsync 로 넘긴다. rsync 는 임시 이름에 쓰고 옮기므로 nginx 가 반쯤 쓴 파일을 내지 않는다.
  // `--delete` 를 주지 않는다. 지우는 일은 맨 끝의 정리가 최근 발행을 보고 한다.
  const filesDir = join(workDir, 'files')
  mkdirSync(filesDir)
  let uploadCount = 0
  for (const [name, localPath] of uploadTargets) {
    if (existing.has(name)) continue
    copyFileSync(localPath, join(filesDir, name))
    uploadCount += 1
  }

  console.log(`[4/5] 파일 ${uploadTargets.size}개 중 ${uploadCount}개 업로드 중...`)
  execFileSync('rsync', ['-a', '--chmod=F644', `${filesDir}/`, `${OTA_HOST}:${OTA_DIR}/files/`], { stdio: 'inherit' })

  console.log('[5/5] 매니페스트 생성·업로드 중...')
  const createdAt = new Date().toISOString()
  const manifestFiles = []
  const metaDir = join(workDir, 'meta')
  mkdirSync(metaDir)

  for (const plan of plans) {
    const { platform } = plan
    const manifest = buildManifest({
      id: randomUUID(),
      createdAt,
      runtimeVersion: runtimeVersions[platform],
      platform,
      bundle: plan.bundle,
      assets: plan.assets,
      appVersion,
      highlights: note.highlights,
    })

    const manifestPath = join(metaDir, `manifest-${platform}-${runtimeVersions[platform]}.json`)
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    manifestFiles.push(manifestPath)

    // `/latest` 가 읽는 파일([[ADR-137]] 결정 4) — 프로토콜이 204 로 삼키는 «스토어 업데이트 필요»
    // 를 되살리는 유일한 재료다.
    // 받는 지문 목록([[ADR-268]] 결정 2). 발행 지문 + 심사 중인 바이너리. 값 하나로 두면 심사
    // 담당자가 아직 갱신되지 않은 이 파일 때문에 잠긴다.
    const accepted = resolveAcceptedRuntimeVersions(runtimeVersions, IN_REVIEW_RUNTIME_VERSIONS)[platform]
    const latestPath = join(metaDir, `latest-${platform}.json`)
    writeFileSync(
      latestPath,
      JSON.stringify(
        {
          runtimeVersion: runtimeVersions[platform],
          acceptedRuntimeVersions: accepted,
          appVersion,
          storeUrl: STORE_URLS[platform],
        },
        null,
        2,
      ),
    )
    manifestFiles.push(latestPath)
  }

  // 매니페스트는 이름 고정·내용 가변이라 덮어쓴다. 파일보다 뒤라야 기기가 아직 없는 번들을 가리키는 매니페스트를 받지 않는다.
  execFileSync('rsync', ['-a', '--chmod=F644', ...manifestFiles, `${OTA_HOST}:${OTA_DIR}/`], { stdio: 'inherit' })

  // ── 정리. 최근 세 번의 발행과 지금 서버에 있는 매니페스트가 쓰는 파일만 남긴다 ──────────────
  //
  // 지금 매니페스트를 함께 보는 것은 한 플랫폼만 발행할 때 때문이다. iOS 만 세 번 내면 안드로이드의 마지막 발행이 목록에서
  // 밀려나지만, 안드로이드 기기는 여전히 그 매니페스트를 받는다.
  const releasesDir = join(workDir, 'server')
  mkdirSync(releasesDir)
  execFileSync('rsync', ['-a', '--include=*.json', '--exclude=*', `${OTA_HOST}:${OTA_DIR}/`, `${releasesDir}/`], { stdio: 'inherit' })
  const releasesPath = join(releasesDir, 'releases.json')
  const { releases: kept, keep } = selectRetainedFiles({
    releases: existsSync(releasesPath) ? JSON.parse(readFileSync(releasesPath, 'utf-8')) : [],
    thisRelease: {
      appVersion,
      createdAt,
      platforms: PLATFORMS,
      files: [...new Set(plans.flatMap((plan) => [plan.bundle.name, plan.compressedBundle.name, ...plan.assets.map((a) => a.name)]))],
    },
    manifests: readdirSync(releasesDir)
      .filter((name) => name.startsWith('manifest-'))
      .map((name) => JSON.parse(readFileSync(join(releasesDir, name), 'utf-8'))),
    keepReleases: KEEP_RELEASES,
  })
  writeFileSync(releasesPath, JSON.stringify(kept, null, 2))
  execFileSync('rsync', ['-a', '--chmod=F644', releasesPath, `${OTA_HOST}:${OTA_DIR}/`], { stdio: 'inherit' })
  const stale = onBox(`ls -1 ${OTA_DIR}/files`).split('\n').filter((name) => name && !keep.has(name))
  for (let i = 0; i < stale.length; i += 100) {
    onBox(`cd ${OTA_DIR}/files && rm -f -- ${stale.slice(i, i + 100).map((name) => `'${name}'`).join(' ')}`)
  }
  console.log(`      최근 ${kept.length}번의 발행이 쓰지 않는 파일 ${stale.length}개를 지웠습니다.`)

  rmSync(workDir, { recursive: true, force: true })

  // [6/6] **왕복 확인** — 클라이언트가 묻는 그대로 물어본다.
  //
  // 이 단계가 있는 이유는 실제로 당한 사고 때문이다(2026-08-14). `runtimeVersion` 은 fingerprint 라
  // **네이티브 트리의 함수**인데, 배포한 뒤 `expo prebuild` 를 돌리자 값이 바뀌었다
  // (`2f68d187…` → `d1111d84…`). 매니페스트는 **아무도 묻지 않을 이름**으로 릴리스에 남았고,
  // 앱은 204(업데이트 없음)를 받는다. **어디에서도 에러가 나지 않는다** — 배포도 성공하고 앱도
  // 안 죽고, 그저 영원히 업데이트가 없다.
  //
  // 그래서 «올렸다» 로 끝내지 않고 **«받아진다»** 까지 확인한다. 파일 이름·Worker 주소·헤더 중
  // 하나라도 어긋나면 여기서 걸린다.
  //
  // 순서 규칙: **네이티브를 건드렸으면 `expo prebuild` 를 먼저 끝내고 배포하라.**
  const manifestUrl = JSON.parse(readFileSync(join(appDir, 'app.json'), 'utf-8')).expo?.updates?.url
  console.log('[6/6] 왕복 확인 중...')
  for (const platform of PLATFORMS) {
    const response = await fetch(manifestUrl, {
      headers: {
        'expo-platform': platform,
        'expo-protocol-version': '1',
        'expo-runtime-version': runtimeVersions[platform],
      },
    })
    const served = response.status === 200 ? await response.json() : null
    if (served?.extra?.appVersion !== appVersion) {
      console.error(
        `${platform}: 방금 올린 매니페스트가 안 받아집니다(status=${response.status}, appVersion=${served?.extra?.appVersion}).\n` +
          `  runtimeVersion=${runtimeVersions[platform]} 로 물었습니다. 네이티브 트리를 배포 후에 바꾸지 않았는지 확인하세요.`,
      )
      process.exit(1)
    }

    // **매니페스트가 받아지는 것만으로는 부족하다** — 앱이 실패한 지점은 그 다음이었다.
    // 번들을 실제로 내려받아 매니페스트가 약속한 해시와 대조한다. 이 대조가 없어서
    // *"배포 성공 · 매니페스트 정상 · 앱만 못 받음"* 이 나왔다(위 [4/5] 주석).
    // 기기와 같은 `accept-encoding` 을 보낸다. `fetch` 는 응답을 풀어서 주므로 해시는 푼 내용으로 잰다.
    const launchAsset = served.launchAsset
    const bundleResponse = await fetch(launchAsset.url, { headers: { 'accept-encoding': 'zstd, br, gzip' } })
    if (bundleResponse.headers.get('content-encoding') !== 'gzip') {
      console.error(
        `${platform}: 번들이 압축되지 않고 옵니다(status=${bundleResponse.status}, content-encoding=${bundleResponse.headers.get('content-encoding')}).\n` +
          `  url=${launchAsset.url}\n  nginx 의 location /ota/files/ 에 gzip_static on 이 있는지 확인하세요.`,
      )
      process.exit(1)
    }
    const downloaded = Buffer.from(await bundleResponse.arrayBuffer())
    const actualHash = sha256Base64Url(downloaded)
    if (actualHash !== launchAsset.hash) {
      console.error(
        `${platform}: 번들 해시가 어긋납니다 — 앱이 받아서 버립니다.\n` +
          `  url=${launchAsset.url}\n  매니페스트=${launchAsset.hash}\n  실제=${actualHash}`,
      )
      process.exit(1)
    }
    console.log(`      ${platform} ✓ (runtime ${runtimeVersions[platform]} · 번들 해시 일치)`)
  }

  console.log(
    `완료: ${appVersion} 배포됨 (${PLATFORMS.map((platform) => `${platform}=${runtimeVersions[platform]}`).join(' ')})`,
  )
}
