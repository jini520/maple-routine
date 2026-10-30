// 발행 뒤 정리. 남길 파일을 잘못 고르면 기기가 받는 중이거나 받아야 할 번들이 지워진다. 그 사고는 발행이 성공한 뒤
// 기기에서만 드러나므로 여기서 고른 결과를 못 박는다.
import { selectRetainedFiles } from '../ota-retention.mjs'

const release = (appVersion, files) => ({ appVersion, createdAt: '2026-10-30T00:00:00Z', platforms: ['ios', 'android'], files })
const manifest = (bundle, assets = []) => ({
  launchAsset: { url: `https://mapleroutine.store/ota/files/${bundle}` },
  assets: assets.map((name) => ({ url: `https://mapleroutine.store/ota/files/${name}` })),
})

describe('selectRetainedFiles', () => {
  it('이번 발행까지 최근 세 번의 발행이 쓴 파일만 남긴다', () => {
    const { releases, keep } = selectRetainedFiles({
      releases: [release('1', ['b1.hbc']), release('2', ['b2.hbc']), release('3', ['b3.hbc'])],
      thisRelease: release('4', ['b4.hbc']),
      manifests: [],
    })

    expect(releases.map((r) => r.appVersion)).toEqual(['2', '3', '4'])
    expect([...keep].sort()).toEqual(['b2.hbc', 'b3.hbc', 'b4.hbc'])
  })

  // 한 플랫폼만 세 번 내면 다른 플랫폼의 마지막 발행이 목록에서 밀린다. 그 기기는 여전히 그 매니페스트를 받는다.
  it('지금 서버에 있는 매니페스트가 가리키는 파일과 그 압축본은 목록에서 밀려도 남긴다', () => {
    const { keep } = selectRetainedFiles({
      releases: [release('1', ['android.hbc', 'android.hbc.gz', 'shared.png'])],
      thisRelease: release('2', ['ios.hbc']),
      manifests: [manifest('android.hbc', ['shared.png'])],
      keepReleases: 1,
    })

    expect([...keep].sort()).toEqual(['android.hbc', 'android.hbc.gz', 'ios.hbc', 'shared.png'])
  })

  it('처음 발행이면 이번 발행만 남는다', () => {
    const { releases } = selectRetainedFiles({ releases: [], thisRelease: release('1', ['b1.hbc']), manifests: [] })

    expect(releases).toHaveLength(1)
  })
})
