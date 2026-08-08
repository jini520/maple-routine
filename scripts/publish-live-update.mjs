#!/usr/bin/env node
// Live Update(OTA) 번들 배포 스크립트 (ADR-022, 베타 채널 지원 ADR-024).
//
// 사용법: node scripts/publish-live-update.mjs [--beta] [--min-native <x.y.z>]
//
// 배포 버전은 CLI 인자로 받지 않고 package.json의 version을 그대로 쓴다 — 버전을 CLI 인자로
// 자유롭게 받으면 package.json을 안 올린 채 OTA만 배포할 수 있어, 빌드된 번들에 박히는
// package.json 버전 표시(설정 화면 하단)가 실제 배포된 OTA 버전과 어긋나는 문제가 있었다.
// 배포 전 package.json의 version부터 올려야 한다.
//
// 사전 준비: `gh auth login`으로 GitHub CLI 인증만 되어 있으면 된다(추가 계정 가입·결제 수단 불필요).
// 이 저장소(REPO)에 고정 릴리스 태그를 하나 만들어 두고(--beta 없으면 live-update-latest,
// 있으면 live-update-beta), 배포할 때마다 그 릴리스에 번들 zip을 추가하고 latest.json을 덮어쓴다.
// src/native/live-update.ts의 LIVE_UPDATE_MANIFEST_URL/LIVE_UPDATE_MANIFEST_URL_BETA가
// 각 릴리스의 latest.json을 가리킨다.
//
// 동작: npm run build → dist/ 압축 → sha256 계산 → latest.json 갱신 → gh release upload

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
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
import { findReleaseNote } from '../src/data/release-notes.ts'

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
 * 이 노트로 배포해도 되는가(ADR-119 결정 6).
 *
 * 버전에 해당하는 노트가 아예 없거나(`undefined`) **항목이 비어 있으면** 안 된다 — 빈 노트는 노트가
 * 아니다. 버전만 적어 두고 내용을 안 쓴 것을 통과시키면, 결정 6이 막으려는 "영영 빈 채로 남는 버전"이
 * 그대로 나간다(결정 4가 사후 재구성을 금지하므로 나중에 채울 방법이 없다).
 *
 * 내용의 품질은 검사하지 않는다 — 검사할 수 없다.
 */
export function isPublishableReleaseNote(note) {
  return note !== undefined && note.items.length > 0
}

/**
 * 노트 항목들을 매니페스트에 실을 한 덩어리 문자열로 합친다.
 *
 * **합치는 규칙을 여기서 고정한다** — 업데이트 모달(이슈 #164)이 이 문자열을 그대로 읽는다.
 *
 * - 항목 하나가 한 줄이고, 줄머리는 `• `. 줄 구분은 `\n` 하나다(읽는 쪽이 줄바꿈을 살려 그린다).
 * - `requiresStoreUpdate` 항목은 줄 끝에 `(스토어 업데이트 필요)` 를 붙인다. 화면은 배지로 그리지만
 *   여긴 평문 한 덩어리라 괄호 꼬리가 자리다 — **표식이 문자열에서 사라지면 모달이 "이 항목은 OTA 로
 *   안 온다"는 사실을 잃는다**(ADR-119 결정 3).
 */
export function formatReleaseNotes(note) {
  return note.items
    .map((item) => `• ${item.text}${item.requiresStoreUpdate === true ? ' (스토어 업데이트 필요)' : ''}`)
    .join('\n')
}

/**
 * 그 버전의 노트를 매니페스트용 문자열로 해석한다. **없으면 `null`** 이고, 그것이 곧 배포 중단
 * 판정이다 — 조회·판정·합치기 셋을 갈라 두고 여기서 잇는다.
 */
export function resolveManifestNotes(version) {
  const note = findReleaseNote(version)
  return isPublishableReleaseNote(note) ? formatReleaseNotes(note) : null
}

export function parseArgs(argv) {
  const isBeta = argv.includes('--beta')
  // --min-native <x.y.z>: 이 번들을 적용하려면 필요한 최소 네이티브 앱 버전. 있으면 매니페스트에 실어,
  // 앱이 설치된 네이티브가 더 낮으면 "스토어 업데이트 필요"로 분기한다(ADR-027 결정 7).
  const minNativeIdx = argv.indexOf('--min-native')
  const minNativeVersion = minNativeIdx >= 0 ? argv[minNativeIdx + 1] : undefined
  return { isBeta, minNativeVersion }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { isBeta, minNativeVersion } = parseArgs(process.argv.slice(2))

  const root = join(import.meta.dirname, '..')
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    console.error(`package.json의 version("${version}")이 x.y.z 형식이 아닙니다. 먼저 버전을 올려주세요.`)
    process.exit(1)
  }

  // 노트 없이는 배포가 나가지 않는다(ADR-119 결정 6). 버전 형식 검사와 같은 자리인 것이 요점이다 —
  // 여기는 빌드(1/5)보다 앞이라 몇 분짜리 빌드를 돌리고 나서 실패하지 않는다. 경고로 두지 않는 이유는
  // 경고가 반드시 무시되고, 노트가 빠진 채 나간 버전은 사후 복구가 불가능하기 때문이다(결정 4).
  const notes = resolveManifestNotes(version)
  if (notes === null) {
    console.error(
      `src/data/release-notes.ts 에 ${version} 노트가 없습니다. 릴리스 노트를 먼저 작성해주세요.`,
    )
    process.exit(1)
  }

  const RELEASE_TAG = resolveReleaseTag(isBeta)

  const workDir = mkdtempSync(join(tmpdir(), 'live-update-'))
  const zipPath = join(workDir, `${version}.zip`)
  const manifestPath = join(workDir, 'latest.json')

  console.log('[1/5] 빌드 중...')
  execFileSync('npm', ['run', resolveBuildScript(isBeta)], { cwd: root, stdio: 'inherit' })

  console.log('[2/5] dist/ 압축 중...')
  execFileSync('zip', ['-r', zipPath, '.'], { cwd: join(root, 'dist'), stdio: 'inherit' })

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
    // 계약과 어긋나는 죽은 분기가 된다. 읽는 쪽에서 선택 필드인 것(결정 5)은 옛 매니페스트를 읽는
    // 기존 설치본 때문이지 이 스크립트가 비워 보낼 수 있어서가 아니다.
    notes,
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

  console.log('[5/5] 번들·latest.json 업로드 중...')
  execFileSync(
    'gh',
    ['release', 'upload', RELEASE_TAG, zipPath, manifestPath, '--repo', REPO, '--clobber'],
    { cwd: root, stdio: 'inherit' },
  )

  rmSync(workDir, { recursive: true, force: true })
  console.log(`완료: ${version} 배포됨 → ${manifest.url}`)
}
