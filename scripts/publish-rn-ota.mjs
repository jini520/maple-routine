#!/usr/bin/env node
// RN OTA 배포 스크립트 ([[ADR-137]]). capacitor 쪽 `publish-live-update.mjs` 의 짝이고, 두 앱이
// **서로 다른 프로토콜**을 쓰는 동안 둘 다 산다([[ADR-137]] 대가 4).
//
// 사용법: node scripts/publish-rn-ota.mjs
//
// 배포 버전은 CLI 인자로 받지 않고 packages/app-rn/app.json 의 expo.version 을 그대로 쓴다 —
// capacitor 스크립트가 같은 이유를 적어 두었다(버전을 인자로 받으면 앱에 박히는 표시값과 실제
// 배포된 버전이 어긋나고, 그것은 배포되고 나서야 드러난다).
//
// 동작: 노트 가드 → expo export → runtimeVersion 해석 → 에셋 업로드(없는 것만) → 매니페스트 생성·업로드
//
// ## capacitor 스크립트와 갈리는 지점 셋
//
// 1. **zip 한 덩이가 아니라 파일 여럿**이다. `expo-updates` 는 매니페스트 + 에셋 목록 모델이고,
//    에셋 이름이 이미 내용의 md5 라 «릴리스에 이미 있는 이름은 건너뛴다» 하나로 증분 업로드가 된다
//    ([[ADR-137]] 결정 8). 실측 293개 중 JS 만 고친 배포는 번들 2개만 오른다.
// 2. **버전 축이 둘**이다. 프로토콜의 정체성은 매니페스트 `id`(UUID)이고, 사용자에게 보이는
//    `1.0.6` 은 우리 축이라 `extra.appVersion` 으로 싣는다([[ADR-137]] 결정 5).
// 3. **`runtimeVersion` 을 우리가 안 적는다.** fingerprint 정책이라 네이티브 그래프에서 계산되고,
//    여기서는 그 값을 CLI 에 물어 파일 이름에 넣기만 한다([[ADR-137]] 결정 3).

import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
// 릴리스 노트의 진실 원천을 **그대로** 읽는다([[ADR-119]] 결정 1) — capacitor 스크립트와 같은 파일을
// 같은 이유로 읽는다. 노트가 두 벌이 되면 갈라진 순간 어느 쪽이 사실인지 알 방법이 없다.
import { findReleaseNote } from '../packages/core/src/data/release-notes.ts'
// 노트 가드도 한 벌이다 — «무엇이 비었는지 문구로 말한다»는 판단([[ADR-126]] 결정 8)을 두 스크립트가
// 나눠 가지면 한쪽만 고쳐진다.
import { describeReleaseNoteGap } from './publish-live-update.mjs'

const REPO = 'jini520/maple-routine'
const RELEASE_TAG = 'live-update-rn'
const PLATFORMS = ['ios', 'android']

/** 스토어 이동 대상([[ADR-027]] 결정 7 · `extra.storeUrl`). */
const STORE_URLS = {
  ios: 'https://apps.apple.com/app/id6797579391',
  android: 'https://play.google.com/store/apps/details?id=com.mapleroutine.app',
}

/**
 * 릴리스에 **이미 올라가 있는** 자산 이름 집합.
 *
 * 에셋 이름이 내용의 md5 라 «같은 이름 = 같은 내용» 이고, 그래서 이 집합에 있으면 올릴 이유가 없다
 * ([[ADR-137]] 결정 8). 매니페스트처럼 내용이 바뀌는 파일만 `--clobber` 로 덮는다.
 */
export function existingAssetNames(releaseJson) {
  const parsed = typeof releaseJson === 'string' ? JSON.parse(releaseJson) : releaseJson
  return new Set((parsed?.assets ?? []).map((asset) => asset.name))
}

/**
 * `dist/` 의 파일 하나를 릴리스 자산 이름으로 바꾼다.
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
  const urlFor = (name) => `https://github.com/${REPO}/releases/download/${RELEASE_TAG}/${name}`
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
      sizeBytes: bundle.size,
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
  const root = join(import.meta.dirname, '..')
  const appDir = join(root, 'packages', 'app-rn')
  const distDir = join(appDir, 'dist')

  // 버전 축이 **둘**이라 여기서 먼저 묶는다.
  //   · `package.json` — 앱이 읽는다(`SettingsScreen` · `rn-live-update.ts` 의 내장 폴백).
  //   · `app.json` — 네이티브 빌드가 읽는다(`CFBundleShortVersionString` 등).
  // 갈리면 «화면에 보이는 버전»과 «스토어에 올라간 버전»이 달라지는데, 그것은 배포되고 나서야
  // 드러난다(capacitor 스크립트 머리가 같은 종류의 사고를 적어 두었다). 그래서 **일치를 강제**한다.
  const { version: appVersion } = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf-8'))
  const appConfig = JSON.parse(readFileSync(join(appDir, 'app.json'), 'utf-8'))
  if (!appVersion || !/^\d+\.\d+\.\d+$/.test(appVersion)) {
    console.error(`packages/app-rn/package.json 의 version("${appVersion}")이 x.y.z 형식이 아닙니다.`)
    process.exit(1)
  }
  if (appConfig?.expo?.version !== appVersion) {
    console.error(
      `버전이 갈렸습니다 — package.json="${appVersion}" vs app.json="${appConfig?.expo?.version}". 둘을 맞춰주세요.`,
    )
    process.exit(1)
  }

  // 노트·핵심 목록 없이는 배포가 나가지 않는다([[ADR-119]] 결정 6 + [[ADR-126]] 결정 8).
  // 빌드(몇 분)보다 **앞**인 것이 요점이다 — capacitor 스크립트가 같은 자리에 둔 이유와 같다.
  const note = findReleaseNote(appVersion)
  const gap = describeReleaseNoteGap(note)
  if (gap !== null) {
    console.error(`packages/core/src/data/release-notes.ts 의 ${appVersion}: ${gap}`)
    process.exit(1)
  }

  console.log('[1/5] expo export 중...')
  execFileSync('npx', ['expo', 'export', '--platform', 'ios', '--platform', 'android', '--output-dir', 'dist'], {
    cwd: appDir,
    stdio: 'inherit',
  })

  const metadata = JSON.parse(readFileSync(join(distDir, 'metadata.json'), 'utf-8'))

  console.log('[2/5] runtimeVersion 해석 중...')
  // fingerprint 정책이라 값이 **계산된다**([[ADR-137]] 결정 3). 우리가 적지 않는 것이 요점이다.
  // 출력은 **JSON** 이다(`{"runtimeVersion":"…","fingerprintSources":[…]}`) — 맨 줄을 그대로
  // 쓰면 JSON 통째로 파일 이름에 들어간다. 실측으로 확인한 형식이고, 형식이 바뀌면 아래 가드가
  // 파일 이름을 만들기 전에 막는다.
  const runtimeVersions = Object.fromEntries(
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
  for (const platform of PLATFORMS) {
    const resolved = runtimeVersions[platform]
    if (!/^[A-Za-z0-9._-]+$/.test(resolved)) {
      console.error(`${platform} 의 runtimeVersion 해석 결과가 파일 이름으로 쓸 수 없습니다: "${resolved}"`)
      process.exit(1)
    }
  }
  console.log(`      ios=${runtimeVersions.ios} android=${runtimeVersions.android}`)

  console.log('[3/5] 릴리스에 이미 있는 자산 확인 중...')
  let existing
  try {
    existing = existingAssetNames(
      execFileSync('gh', ['release', 'view', RELEASE_TAG, '--repo', REPO, '--json', 'assets'], { encoding: 'utf-8' }),
    )
  } catch {
    execFileSync(
      'gh',
      [
        'release', 'create', RELEASE_TAG,
        '--repo', REPO,
        '--title', 'OTA bundles (RN, expo-updates)',
        '--notes', 'RN 앱(expo-updates)의 OTA 번들·에셋 저장소입니다(ADR-137). 앱이 자동으로 참조합니다.',
      ],
      { stdio: 'inherit' },
    )
    existing = new Set()
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
    return {
      platform,
      bundle: {
        localPath: bundlePath,
        // 내용에서 파생된 이름 — 위 사고를 구조적으로 불가능하게 만드는 한 줄이다.
        name: `bundle-${platform}-${createHash('sha256').update(bundleBuffer).digest('hex')}.hbc`,
        key: md5Hex(bundleBuffer),
        hash: sha256Base64Url(bundleBuffer),
        size: statSync(bundlePath).size,
      },
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
    for (const entry of [plan.bundle, ...plan.assets]) {
      if (!uploadTargets.has(entry.name)) uploadTargets.set(entry.name, entry.localPath)
    }
  }

  const toUpload = []
  for (const [name, localPath] of uploadTargets) {
    if (existing.has(name)) continue
    // `gh release upload` 는 **파일 이름을 그대로 자산 이름으로 쓴다** — 이름을 바꾸려면 그 이름으로
    // 복사해서 올리는 수밖에 없다(자산의 `label` 은 다운로드 URL 에 안 쓰인다).
    const staged = join(workDir, name)
    if (staged !== localPath) copyFileSync(localPath, staged)
    toUpload.push(staged)
  }

  console.log(`[4/5] 자산 ${uploadTargets.size}개 중 ${toUpload.length}개 업로드 중...`)
  // 한 번에 다 넘기면 인자 길이 한계에 걸리므로 나눠 올린다. `--clobber` 가 필요 없는 것은 이제
  // 규칙이 아니라 구조다 — 이름이 내용에서 나오므로 같은 이름이면 반드시 같은 내용이다.
  for (let i = 0; i < toUpload.length; i += 40) {
    const batch = toUpload.slice(i, i + 40)
    execFileSync('gh', ['release', 'upload', RELEASE_TAG, ...batch, '--repo', REPO], { stdio: 'inherit' })
  }

  console.log('[5/5] 매니페스트 생성·업로드 중...')
  const createdAt = new Date().toISOString()
  const manifestFiles = []

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

    const manifestPath = join(workDir, `manifest-${platform}-${runtimeVersions[platform]}.json`)
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    manifestFiles.push(manifestPath)

    // `/latest` 가 읽는 파일([[ADR-137]] 결정 4) — 프로토콜이 204 로 삼키는 «스토어 업데이트 필요»
    // 를 되살리는 유일한 재료다.
    const latestPath = join(workDir, `latest-${platform}.json`)
    writeFileSync(
      latestPath,
      JSON.stringify({ runtimeVersion: runtimeVersions[platform], appVersion, storeUrl: STORE_URLS[platform] }, null, 2),
    )
    manifestFiles.push(latestPath)
  }

  // 매니페스트는 이름 고정·내용 가변이라 여기만 덮는다.
  execFileSync('gh', ['release', 'upload', RELEASE_TAG, ...manifestFiles, '--repo', REPO, '--clobber'], {
    stdio: 'inherit',
  })

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
    const launchAsset = served.launchAsset
    const downloaded = Buffer.from(await (await fetch(launchAsset.url)).arrayBuffer())
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

  console.log(`완료: ${appVersion} 배포됨 (runtime ios=${runtimeVersions.ios} android=${runtimeVersions.android})`)
}
