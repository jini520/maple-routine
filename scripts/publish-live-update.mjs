#!/usr/bin/env node
// Live Update(OTA) 번들 배포 스크립트 (ADR-022, 베타 채널 지원 ADR-024).
//
// 사용법: node scripts/publish-live-update.mjs [--beta] [--min-native <x.y.z>]
//                                             [--store-required <android[,ios]>] [--highlight <문구> ...]
//
// --store-required / --highlight 는 **캐패시터 앱의 종료**를 위해 붙었다([[ADR-154]]). 이 앱은 RN
// 바이너리로 대체됐고, 갱신이 끝난 플랫폼에 「최신입니다」를 돌려주는 것은 거짓이라 그 플랫폼을
// 스토어로 보낸다. 판정이 버전이 아니라 목록이라 **버전을 안 올려도 켜지고, 빼면 되돌아온다.**
//
//   1단계  node scripts/publish-live-update.mjs --store-required android \
//              --highlight '<문구>' --highlight '<문구>'
//   2단계  latest.json 의 storeRequiredPlatforms 에 "ios" 를 더해 --clobber 로 덮어쓴다.
//          (번들 빌드 불필요 — 그래서 1단계 직후 packages/app-capacitor 를 지워도 된다.)
//
// 배포 버전은 CLI 인자로 받지 않고 packages/app-capacitor/package.json의 version을 그대로 쓴다 —
// 버전을 CLI 인자로 자유롭게 받으면 package.json을 안 올린 채 OTA만 배포할 수 있어, 빌드된 번들에
// 박히는 package.json 버전 표시(설정 화면 하단 — 앱이 같은 파일을 import 한다)가 실제 배포된 OTA
// 버전과 어긋나는 문제가 있었다. 배포 전 그 파일의 version부터 올려야 한다.
//
// 사전 준비: `gh auth login`으로 GitHub CLI 인증만 되어 있으면 된다(추가 계정 가입·결제 수단 불필요).
// 이 저장소(REPO)에 고정 릴리스 태그를 하나 만들어 두고(--beta 없으면 live-update-latest,
// 있으면 live-update-beta), 배포할 때마다 그 릴리스에 번들 zip을 추가하고 latest.json을 덮어쓴다.
// packages/core/src/native/live-update.ts의 LIVE_UPDATE_MANIFEST_URL/LIVE_UPDATE_MANIFEST_URL_BETA가
// 각 릴리스의 latest.json을 가리킨다.
//
// 동작: npm run build → packages/app-capacitor/dist/ 압축 → sha256 계산 → latest.json 갱신 → gh release upload

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
// 릴리스 노트의 진실 원천을 **그대로** 읽는다(ADR-119 결정 1) — 스크립트용 사본을 두면 노트를 고칠 때
// 한쪽만 고쳐지고, 갈라진 순간 어느 쪽이 사실인지 알 방법이 없다.
//
// .mjs 가 .ts 를 그대로 import 하는 것은 Node 의 내장 타입 스트리핑 덕이다(Node 22.18+/23.6+ 부터
// 플래그 없이 켜져 있고, 이 저장소는 24.x 에서 확인했다). 새 의존성(tsx·ts-node)을 들이지 않은 이유는
// 배포 스크립트가 릴리스 경로의 일부라 의존성이 늘수록 릴리스가 깨질 표면이 넓어지기 때문이고,
// 정규식으로 파일을 긁지 않은 이유는 그 방식이 원천의 형식이 바뀌는 순간 조용히 틀린 값을 내기
// 때문이다. release-notes.ts 는 순수 데이터라 타입 선언 말고는 스트리핑할 것도 없다.
import { findReleaseNote } from '../packages/core/src/data/release-notes.ts'

const REPO = 'jini520/maple-routine'

export function resolveReleaseTag(isBeta) {
  return isBeta ? 'live-update-beta' : 'live-update-latest'
}

export function resolveBuildScript(isBeta) {
  return isBeta ? 'build:beta' : 'build'
}

/**
 * 릴리스를 **처음 만들 때** 쓰는 제목·플래그.
 *
 * production 채널까지 `--prerelease` 로 만들던 결함을 고친 자리다 — 두 채널이 같은 저장소의
 * 고정 태그라, production 이 prerelease 로 남으면 GitHub 릴리스 목록에서 어느 쪽이 정식인지
 * 구분되지 않는다. 제목도 채널별로 갈라 같은 이유를 해소한다.
 */
export function resolveReleaseCreateArgs(isBeta) {
  return isBeta
    ? { title: 'Live Update bundles (beta)', flags: ['--prerelease'] }
    : { title: 'Live Update bundles (production)', flags: [] }
}

/**
 * 이 노트로 배포하면 안 되는 이유를 돌려준다. **통과하면 `null`** 이고, 그때 `items` 와
 * `highlights` 가 둘 다 있다(ADR-119 결정 6 + ADR-126 결정 8).
 *
 * 판정이 아니라 **문구**를 돌려주는 이유는 둘이 갈리기 때문이다 — 무엇을 쓰라는 것인지 모르면
 * 가드가 그냥 장애물이 된다.
 *
 * - 노트가 아예 없거나(`undefined`) **항목이 비어 있으면** 안 된다 — 빈 노트는 노트가 아니다.
 *   버전만 적어 두고 내용을 안 쓴 것을 통과시키면, 결정 6이 막으려는 "영영 빈 채로 남는 버전"이
 *   그대로 나간다(결정 4가 사후 재구성을 금지하므로 나중에 채울 방법이 없다).
 * - **핵심 목록이 비어 있어도** 안 된다(ADR-126 결정 8) — 그것이 업데이트 모달이 받기 전에
 *   보여줄 유일한 재료다. 선택 사항으로 두면 안 쓰게 되고, 안 쓰면 모달이 다시 "버전 + 용량"만
 *   말하는 자리로 돌아간다.
 *
 * 내용의 품질은 검사하지 않는다 — 검사할 수 없다.
 */
export function describeReleaseNoteGap(note) {
  if (note === undefined || note.items.length === 0) {
    return '노트가 없습니다. 릴리스 노트를 먼저 작성해주세요.'
  }
  if (note.highlights === undefined || note.highlights.length === 0) {
    return '노트에 highlights 가 없습니다. 업데이트 모달이 받기 전에 보여줄 핵심 목록 3~4줄을 먼저 작성해주세요.'
  }
  return null
}

/** `Capacitor.getPlatform()` 이 돌려주는 값 중 이 앱이 실제로 도는 둘([[ADR-154]] 결정 1). */
const STORE_REQUIRED_PLATFORMS = ['android', 'ios']

export function parseArgs(argv) {
  const isBeta = argv.includes('--beta')
  // --min-native <x.y.z>: 이 번들을 적용하려면 필요한 최소 네이티브 앱 버전. 있으면 매니페스트에 실어,
  // 앱이 설치된 네이티브가 더 낮으면 "스토어 업데이트 필요"로 분기한다(ADR-027 결정 7).
  const minNativeIdx = argv.indexOf('--min-native')
  const minNativeVersion = minNativeIdx >= 0 ? argv[minNativeIdx + 1] : undefined

  // --store-required <android[,ios]>: 이 플랫폼들은 업데이트를 나르는 대신 **스토어로 보낸다**
  // ([[ADR-154]]). 캐패시터 앱이 RN 바이너리로 대체돼 더 이상 갱신되지 않으므로, 갱신이 끝난
  // 플랫폼에 「최신입니다」를 돌려주는 거짓을 없앤다.
  //
  // 판정이 버전이 아니라 목록이라 **양방향이다** — 목록에서 빼면 그대로 되돌아온다.
  const storeRequiredIdx = argv.indexOf('--store-required')
  const storeRequiredPlatforms =
    storeRequiredIdx >= 0
      ? (argv[storeRequiredIdx + 1] ?? '')
          .split(',')
          .map((name) => name.trim())
          .filter((name) => name !== '')
      : undefined
  // 오타(`andriod`)를 통과시키면 «아무도 유도되지 않는» 배포가 나가고, 그 실패는 발행하고 나서야
  // 그것도 «아무 일이 안 일어나는» 형태로 드러난다. 이름을 여기서 못박는 이유다.
  for (const name of storeRequiredPlatforms ?? []) {
    if (!STORE_REQUIRED_PLATFORMS.includes(name)) {
      throw new Error(
        `--store-required 의 플랫폼 이름이 잘못됐습니다: "${name}". 쓸 수 있는 값: ${STORE_REQUIRED_PLATFORMS.join(' · ')}`,
      )
    }
  }

  // --highlight <문구> (여러 번 가능): 매니페스트에 실을 핵심 목록을 **이 배포에 한해** 덮어쓴다
  // ([[ADR-154]] 결정 7). 원천(release-notes.ts)과 배포 가드는 그대로 돌고, 갈리는 것은 매니페스트에
  // 실리는 값 하나다 — 한 버전 번호를 두 앱이 나눠 쓰게 된 이번 배포에만 해당한다.
  const highlightLines = argv.flatMap((arg, i) => (arg === '--highlight' ? [argv[i + 1]] : []))
  const highlights = highlightLines.length > 0 ? highlightLines : undefined

  // --bundle-only: zip 만 릴리스에 올리고 **latest.json 은 건드리지 않는다**([[ADR-154]] 결정 4).
  //
  // 캐패시터 앱의 마지막 번들은 사용자에게 줄 것이 없다 — payload 가 게이트 읽는 코드와 스토어
  // 링크 수정뿐이라 화면에 안 보인다. 그런 것을 위해 6MB 다운로드를 권하면 모달이 «받을 이유가
  // 없는 업데이트» 를 묻는 자리가 되고, 그러면 안 받는다.
  //
  // 대신 매니페스트 초안을 저장소에 남긴다. 그 파일이 있으면 **캐패시터 소스 없이도** 나중에
  // 유도를 켤 수 있다 — 그때는 「스토어에서 업데이트해 주세요」가 참이라 문구도 정직해진다.
  const bundleOnly = argv.includes('--bundle-only')

  return { isBeta, minNativeVersion, storeRequiredPlatforms, highlights, bundleOnly }
}

/**
 * 매니페스트에 실을 핵심 목록. **덮어쓸 값이 있으면 그쪽이 이긴다**([[ADR-154]] 결정 7).
 *
 * 순수 함수로 갈라 둔 이유는 `describeReleaseNoteGap` 과 같다 — 스크립트 본문은 빌드·`gh` 업로드를
 * 부르므로 테스트에서 실행할 수 없지만, 판정은 실행할 수 있다.
 */
export function resolveManifestHighlights(note, override) {
  return override ?? note.highlights
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { isBeta, minNativeVersion, storeRequiredPlatforms, highlights, bundleOnly } =
    parseArgs(process.argv.slice(2))

  const root = join(import.meta.dirname, '..')
  // OTA 번들 버전은 **앱 패키지의** package.json 에서 읽는다([[ADR-024]] — 버전 축은 하나여야 한다).
  // 저장소 루트의 package.json 은 워크스페이스 오케스트레이션용이라 version 자체를 갖지 않는다.
  // 여기가 어긋나면 매니페스트에 실리는 버전과 설정 화면 하단 표시값(앱이 같은 파일을 import 한다)이
  // 갈리는데, 그건 배포되고 나서야 드러난다.
  const appDir = join(root, 'packages', 'app-capacitor')
  const { version } = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf-8'))
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    console.error(
      `packages/app-capacitor/package.json의 version("${version}")이 x.y.z 형식이 아닙니다. 먼저 버전을 올려주세요.`,
    )
    process.exit(1)
  }

  // 노트·핵심 목록 없이는 배포가 나가지 않는다(ADR-119 결정 6 + ADR-126 결정 8). 버전 형식 검사와
  // 같은 자리인 것이 요점이다 — 여기는 빌드(1/5)보다 앞이라 몇 분짜리 빌드를 돌리고 나서 실패하지
  // 않는다. 경고로 두지 않는 이유는 경고가 반드시 무시되고, 노트가 빠진 채 나간 버전은 사후 복구가
  // 불가능하기 때문이다(결정 4).
  const note = findReleaseNote(version)
  const gap = describeReleaseNoteGap(note)
  if (gap !== null) {
    console.error(`packages/core/src/data/release-notes.ts 의 ${version}: ${gap}`)
    process.exit(1)
  }

  const RELEASE_TAG = resolveReleaseTag(isBeta)

  const workDir = mkdtempSync(join(tmpdir(), 'live-update-'))
  const zipPath = join(workDir, `${version}.zip`)
  const manifestPath = join(workDir, 'latest.json')

  // 이 배포가 «무엇을 켜는가» 를 빌드 전에 말한다 — 되돌릴 수는 있지만(ADR-154 결정 5) 사용자
  // 화면이 바뀌는 배포라, 잘못 친 인자가 6MB 를 굽고 나서 드러나면 안 된다.
  if (storeRequiredPlatforms && storeRequiredPlatforms.length > 0) {
    console.log(`⚠️  스토어 유도 대상: ${storeRequiredPlatforms.join(' · ')} — 이 플랫폼은 업데이트 대신 스토어로 보내집니다([[ADR-154]]).`)
  }
  if (bundleOnly) {
    console.log('ℹ️  --bundle-only: zip 만 올리고 latest.json 은 건드리지 않습니다 — 사용자에게 모달이 뜨지 않습니다.')
  }
  if (highlights) {
    console.log(`ℹ️  매니페스트 highlights 를 배포 인자로 덮어씁니다(노트 원천은 그대로):\n${highlights.map((line) => `     · ${line}`).join('\n')}`)
  }

  console.log('[1/5] 빌드 중...')
  execFileSync('npm', ['run', resolveBuildScript(isBeta)], { cwd: root, stdio: 'inherit' })

  console.log('[2/5] dist/ 압축 중...')
  execFileSync('zip', ['-r', zipPath, '.'], { cwd: join(appDir, 'dist'), stdio: 'inherit' })

  console.log('[3/5] 체크섬·용량 계산 중...')
  const checksum = createHash('sha256').update(readFileSync(zipPath)).digest('hex')
  const size = statSync(zipPath).size
  const manifest = {
    version,
    url: `https://github.com/${REPO}/releases/download/${RELEASE_TAG}/${version}.zip`,
    checksum,
    size,
    ...(minNativeVersion ? { minNativeVersion } : {}),
    // minNativeVersion 바로 옆이지만 조건부 전개가 아니다 — 그쪽은 CLI 인자라 정말 없을 수 있고,
    // 이쪽은 위 가드를 통과한 시점에 반드시 있다. 여기서 다시 "없을 수도 있다"고 쓰면 결정 6의
    // 계약과 어긋나는 죽은 분기가 된다. 읽는 쪽에서 선택 필드인 것(ADR-119 결정 5)은 옛 매니페스트를
    // 읽는 기존 설치본 때문이지 이 스크립트가 비워 보낼 수 있어서가 아니다.
    //
    // 싣는 것은 **항목 전체가 아니라 핵심 목록**이다(ADR-126 결정 2) — 모달은 "받을까 말까"를
    // 정하는 자리라 전수 목록이 필요 없고, 전체는 받은 뒤 개발 노트 화면이 보여준다.
    highlights: resolveManifestHighlights(note, highlights),
    // 목록이 비어 있으면 필드를 아예 안 싣는다 — 앱 쪽 파서가 빈 배열을 «없음» 과 같게 다루므로
    // 값은 같지만, 매니페스트를 눈으로 읽을 때 «켜져 있는가» 가 필드의 유무로 바로 보인다.
    ...(storeRequiredPlatforms && storeRequiredPlatforms.length > 0 ? { storeRequiredPlatforms } : {}),
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  console.log('[4/5] GitHub Release 확인 중...')
  try {
    execFileSync('gh', ['release', 'view', RELEASE_TAG, '--repo', REPO], { stdio: 'ignore' })
  } catch {
    const { title, flags } = resolveReleaseCreateArgs(isBeta)
    execFileSync(
      'gh',
      [
        'release', 'create', RELEASE_TAG,
        '--repo', REPO,
        '--title', title,
        '--notes', 'OTA 번들 저장용 릴리스입니다. 앱이 자동으로 참조하며, 직접 다운로드할 필요는 없습니다.',
        ...flags,
      ],
      { cwd: root, stdio: 'inherit' },
    )
  }

  console.log(bundleOnly ? '[5/5] 번들만 업로드 중...' : '[5/5] 번들·latest.json 업로드 중...')
  execFileSync(
    'gh',
    ['release', 'upload', RELEASE_TAG, zipPath, ...(bundleOnly ? [] : [manifestPath]), '--repo', REPO, '--clobber'],
    { cwd: root, stdio: 'inherit' },
  )

  if (bundleOnly) {
    // 초안을 저장소에 남기는 것이 --bundle-only 의 핵심이다 — url·checksum·size 는 **이 빌드에서만**
    // 나오는 값이라, 캐패시터 소스를 지운 뒤에는 다시 계산할 방법이 없다. 이 파일이 그 값을 들고
    // 있으면 나중에 유도를 켜는 일이 «필드 하나 넣고 업로드» 로 끝난다.
    const draftPath = join(root, 'ota', 'latest.json')
    mkdirSync(join(root, 'ota'), { recursive: true })
    writeFileSync(draftPath, `${JSON.stringify(manifest, null, 2)}\n`)
    rmSync(workDir, { recursive: true, force: true })
    console.log(`완료: ${version}.zip 업로드됨(매니페스트 미발행). 초안 → ota/latest.json`)
    console.log('   유도를 켤 때: 그 파일에 "storeRequiredPlatforms" 를 넣고')
    console.log(`   gh release upload ${RELEASE_TAG} ota/latest.json --repo ${REPO} --clobber`)
  } else {
    rmSync(workDir, { recursive: true, force: true })
    console.log(`완료: ${version} 배포됨 → ${manifest.url}`)
  }
}
