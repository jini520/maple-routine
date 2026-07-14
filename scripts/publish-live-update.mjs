#!/usr/bin/env node
// Live Update(OTA) 번들 배포 스크립트 (ADR-022, 베타 채널 지원 ADR-024).
//
// 사용법: node scripts/publish-live-update.mjs <x.y.z> [--beta]
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
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = 'jini520/maple-routine'

export function resolveReleaseTag(isBeta) {
  return isBeta ? 'live-update-beta' : 'live-update-latest'
}

export function parseArgs(argv) {
  const isBeta = argv.includes('--beta')
  const version = argv.find((arg) => arg !== '--beta')
  return { version, isBeta }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { version, isBeta } = parseArgs(process.argv.slice(2))
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    console.error('사용법: node scripts/publish-live-update.mjs <x.y.z> [--beta]')
    process.exit(1)
  }

  const RELEASE_TAG = resolveReleaseTag(isBeta)

  const root = join(import.meta.dirname, '..')
  const workDir = mkdtempSync(join(tmpdir(), 'live-update-'))
  const zipPath = join(workDir, `${version}.zip`)
  const manifestPath = join(workDir, 'latest.json')

  console.log('[1/5] 빌드 중...')
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' })

  console.log('[2/5] dist/ 압축 중...')
  execFileSync('zip', ['-r', zipPath, '.'], { cwd: join(root, 'dist'), stdio: 'inherit' })

  console.log('[3/5] 체크섬 계산 중...')
  const checksum = createHash('sha256').update(readFileSync(zipPath)).digest('hex')
  const manifest = {
    version,
    url: `https://github.com/${REPO}/releases/download/${RELEASE_TAG}/${version}.zip`,
    checksum,
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  console.log('[4/5] GitHub Release 확인 중...')
  try {
    execFileSync('gh', ['release', 'view', RELEASE_TAG, '--repo', REPO], { stdio: 'ignore' })
  } catch {
    execFileSync(
      'gh',
      [
        'release', 'create', RELEASE_TAG,
        '--repo', REPO,
        '--title', 'Live Update bundles',
        '--notes', 'OTA 번들 저장용 릴리스입니다. 앱이 자동으로 참조하며, 직접 다운로드할 필요는 없습니다.',
        '--prerelease',
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
