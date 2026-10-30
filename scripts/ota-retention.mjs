// 발행 뒤 서버 `files/` 에 남길 파일을 고르는 순수 로직. 발행 스크립트가 최상위 `await` 를 쓰는 ESM 이라 테스트가 import 하지
// 못해서 따로 산다.

import { basename } from 'node:path'

/**
 * 남길 파일과 새 발행 목록. 최근 `keepReleases` 번의 발행이 쓴 파일과, 지금 서버에 있는 매니페스트가 가리키는 파일(번들은
 * 그 `.gz` 까지)을 남긴다. 바로 지난 발행을 받던 기기가 아직 내려받는 중일 수 있어 기본값은 셋이다.
 *
 * @returns `releases` 는 서버의 `releases.json` 에 새로 쓸 목록, `keep` 은 지우지 않을 파일 이름
 */
export function selectRetainedFiles({ releases, thisRelease, manifests, keepReleases = 3 }) {
  const kept = [...releases, thisRelease].slice(-keepReleases)
  const keep = new Set(kept.flatMap((release) => release.files))
  const nameOf = (asset) => basename(new URL(asset.url).pathname)
  for (const manifest of manifests) {
    // 압축본은 번들에만 있다. nginx 가 같은 주소로 그것을 내준다.
    keep.add(nameOf(manifest.launchAsset))
    keep.add(`${nameOf(manifest.launchAsset)}.gz`)
    for (const asset of manifest.assets) keep.add(nameOf(asset))
  }
  return { releases: kept, keep }
}
