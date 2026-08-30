// 옛 바이너리 호환 에셋 경로([[ADR-191]]). 이 파일이 지키는 것 둘 —
// ① APK 이름에서 역산한 경로가 **다시 그 이름으로 파생된다**(결정 2)
// ② 하나라도 어긋나면 관문이 그것을 **집어낸다**(결정 3)
//
// 이 둘이 깨지면 나는 사고는 화면에 에러가 안 뜬다 — 그림만 빈칸이 되고 배포는 성공한다.
// 1.0.7 이 그렇게 나갔다.
import plugin from '../ota-legacy-asset-paths.cjs'

const { androidResourceIdentifier, summarizeLegacyAssetCoverage } = plugin

describe('androidResourceIdentifier — RN 의 파생 규칙과 같은 계산', () => {
  // 실측값이다(2026-08-30, 기기 logcat 의 embeddedAssetFileMap).
  it('1.0.6 APK 의 이름을 그대로 낸다', () => {
    expect(androidResourceIdentifier('/assets/_core/src/assets/themes', 'blackmage-background')).toBe(
      '_core_src_assets_themes_blackmagebackground',
    )
  })

  it('지금 트리의 경로는 다른 이름을 낸다 — 이것이 1.0.7 을 깨뜨린 차이다', () => {
    expect(androidResourceIdentifier('/assets/src/assets/themes', 'blackmage-background')).toBe(
      'src_assets_themes_blackmagebackground',
    )
  })

  // 역산의 근거 — 목표 이름의 `_` 를 `/` 로 되돌린 경로는 다시 그 이름으로 파생된다.
  it.each([
    ['_core_src_assets_themes_blackmagebackground', 'blackmage-background'],
    ['__node_modules_reactnavigation_elements_lib_module_assets_backicon', 'back-icon'],
    ['_core_src_assets_bosses_adversary', 'adversary'],
  ])('역산한 경로가 "%s" 로 되돌아온다', (target, name) => {
    const clean = name.toLowerCase().replace(/\//g, '_').replace(/([^a-z0-9_])/g, '')
    const prefix = target.slice(0, -(clean.length + 1))
    expect(androidResourceIdentifier(`/assets/${prefix.replace(/_/g, '/')}`, name)).toBe(target)
  })
})

describe('summarizeLegacyAssetCoverage — 발행 관문', () => {
  const apk = {
    aaa: { ext: 'webp', name: '_core_src_assets_themes_blackmagebackground' },
    bbb: { ext: 'png', name: '_core_src_assets_bosses_adversary' },
  }
  const row = (hashes, identifier) => JSON.stringify({ hashes, identifier })

  it('전부 맞으면 통과다', () => {
    const result = summarizeLegacyAssetCoverage(apk, [
      row(['aaa'], '_core_src_assets_themes_blackmagebackground'),
      row(['bbb'], '_core_src_assets_bosses_adversary'),
    ])
    expect(result).toEqual({ matched: 2, mismatched: [], missing: [] })
  })

  // 이것이 1.0.7 의 상태다 — 이름이 새 트리 것으로 파생돼 APK 에 없는 것을 찾는다.
  it('이름이 어긋나면 무엇이 어긋났는지 집어낸다', () => {
    const result = summarizeLegacyAssetCoverage(apk, [
      row(['aaa'], 'src_assets_themes_blackmagebackground'),
      row(['bbb'], '_core_src_assets_bosses_adversary'),
    ])
    expect(result.matched).toBe(1)
    expect(result.mismatched).toEqual([
      {
        hash: 'aaa',
        expected: '_core_src_assets_themes_blackmagebackground',
        actual: 'src_assets_themes_blackmagebackground',
      },
    ])
  })

  // APK 에 있는 그림이 번들에서 사라졌다면 그 자리도 빈칸이 된다 — 어긋남과 같이 막는다.
  it('APK 에 있는데 번들에 없으면 잡는다', () => {
    const result = summarizeLegacyAssetCoverage(apk, [row(['aaa'], '_core_src_assets_themes_blackmagebackground')])
    expect(result.matched).toBe(1)
    expect(result.missing).toEqual([{ hash: 'bbb', expected: '_core_src_assets_bosses_adversary' }])
  })

  // 같은 에셋이 워커·플랫폼마다 여러 줄로 나온다 — 접어서 세지 않으면 수가 부풀거나 어긋난다.
  it('같은 해시가 여러 줄로 와도 한 번만 센다', () => {
    const result = summarizeLegacyAssetCoverage(apk, [
      row(['aaa'], '_core_src_assets_themes_blackmagebackground'),
      row(['aaa'], '_core_src_assets_themes_blackmagebackground'),
      row(['bbb'], '_core_src_assets_bosses_adversary'),
      '',
    ])
    expect(result.matched).toBe(2)
  })
})
