import { describe, expect, it } from 'vitest'
import {
  describeReleaseNoteGap,
  parseArgs,
  resolveManifestHighlights,
  resolveBuildScript,
  resolveReleaseCreateArgs,
  resolveReleaseTag,
} from '../publish-live-update.mjs'
import { readFileSync } from 'node:fs'
import { RELEASE_NOTES } from '../../packages/core/src/data/release-notes.ts'
// 이 왕복 검사가 보는 것은 «capacitor 배포 스크립트가 쓴 매니페스트를 capacitor 앱이 읽는가» 라,
// 파서가 core 에서 그 앱의 어댑터로 내려간 뒤에도([[ADR-137]] 결정 6) 대상은 그대로다.
import { parseLiveUpdateManifest } from '../../packages/app-capacitor/src/native/adapters/capacitor-live-update.ts'

describe('resolveReleaseTag', () => {
  it('isBeta가 true면 live-update-beta를 반환한다', () => {
    expect(resolveReleaseTag(true)).toBe('live-update-beta')
  })

  it('isBeta가 false면 live-update-latest를 반환한다', () => {
    expect(resolveReleaseTag(false)).toBe('live-update-latest')
  })
})

describe('resolveBuildScript', () => {
  it('isBeta가 true면 build:beta를 반환한다', () => {
    expect(resolveBuildScript(true)).toBe('build:beta')
  })

  it('isBeta가 false면 build를 반환한다', () => {
    expect(resolveBuildScript(false)).toBe('build')
  })
})

// production 채널까지 --prerelease로 만들던 결함을 고친 자리다(2026-08-04). 두 채널이 같은
// 저장소의 고정 태그라, production이 prerelease로 남으면 GitHub 목록에서 어느 쪽이 정식인지
// 구분되지 않는다.
describe('resolveReleaseCreateArgs', () => {
  it('production 채널은 prerelease가 아니다', () => {
    expect(resolveReleaseCreateArgs(false).flags).not.toContain('--prerelease')
  })

  it('베타 채널은 prerelease다', () => {
    expect(resolveReleaseCreateArgs(true).flags).toContain('--prerelease')
  })

  it('채널마다 제목이 다르다 — 목록에서 구분되어야 한다', () => {
    expect(resolveReleaseCreateArgs(false).title).not.toBe(resolveReleaseCreateArgs(true).title)
  })
})

// ADR-030(라이브 업데이트 후속): 배포 버전은 더 이상 CLI 인자로 받지 않는다 — package.json의
// version과 실제 배포 버전이 어긋날 수 있었던 근본 원인이라, package.json에서만 읽도록 통일했다.
describe('parseArgs', () => {
  it('아무 인자가 없으면 isBeta는 false다', () => {
    expect(parseArgs([])).toEqual({ isBeta: false, minNativeVersion: undefined, bundleOnly: false })
  })

  it('--beta를 인식한다', () => {
    expect(parseArgs(['--beta'])).toEqual({ isBeta: true, minNativeVersion: undefined, bundleOnly: false })
  })

  it('--min-native <x.y.z>를 파싱한다', () => {
    expect(parseArgs(['--beta', '--min-native', '2.0.0'])).toEqual({
      isBeta: true,
      minNativeVersion: '2.0.0',
      bundleOnly: false,
    })
  })

  it('--min-native가 --beta 앞에 와도 위치 무관하게 파싱한다', () => {
    expect(parseArgs(['--min-native', '2.0.0', '--beta'])).toEqual({
      isBeta: true,
      minNativeVersion: '2.0.0',
      bundleOnly: false,
    })
  })

  // ── ADR-154: 캐패시터 앱의 종료 ──────────────────────────────────────────────

  it('--store-required를 쉼표로 갈라 플랫폼 목록으로 만든다', () => {
    expect(parseArgs(['--store-required', 'android']).storeRequiredPlatforms).toEqual(['android'])
    expect(parseArgs(['--store-required', 'android,ios']).storeRequiredPlatforms).toEqual(['android', 'ios'])
    expect(parseArgs(['--store-required', 'android, ios']).storeRequiredPlatforms).toEqual(['android', 'ios'])
  })

  it('--store-required가 없으면 undefined다 — 종전 배포와 한 글자도 안 달라진다', () => {
    expect(parseArgs([]).storeRequiredPlatforms).toBeUndefined()
  })

  // 오타는 조용히 «아무도 유도되지 않는» 배포가 된다 — 그 실패는 발행하고 나서야, 그것도
  // 아무 일이 안 일어나는 형태로 드러난다. 그래서 파싱 단계에서 이름을 못박는다.
  it('알 수 없는 플랫폼 이름은 던진다', () => {
    expect(() => parseArgs(['--store-required', 'andriod'])).toThrow(/andriod/)
    expect(() => parseArgs(['--store-required', 'web'])).toThrow()
  })

  it('--highlight는 여러 번 줄 수 있고 순서대로 쌓인다', () => {
    expect(parseArgs(['--highlight', '첫 줄', '--highlight', '둘째 줄']).highlights).toEqual([
      '첫 줄',
      '둘째 줄',
    ])
  })

  it('--highlight가 없으면 undefined다 — 원천(release-notes.ts)이 그대로 이긴다', () => {
    expect(parseArgs([]).highlights).toBeUndefined()
  })

  // 1단계의 payload 는 사용자 눈에 안 보이는 배선뿐이라(게이트 읽는 코드 + 스토어 링크) 지금
  // 6MB 를 권할 이유가 없다. zip 만 올려 두면 매니페스트는 «유도가 실제로 필요한 시점» 에 한 번
  // 발행하면 되고, 그때는 캐패시터 소스가 없어도 된다([[ADR-154]] 결정 4).
  it('--bundle-only를 인식한다', () => {
    expect(parseArgs(['--bundle-only']).bundleOnly).toBe(true)
    expect(parseArgs([]).bundleOnly).toBe(false)
  })
})

// ADR-154 결정 7 — 매니페스트에 싣는 값만 덮어쓴다. 원천 한 벌([[ADR-119]] 결정 1)과 배포
// 가드는 그대로 돌고, 여기서 갈리는 것은 «이 배포의 매니페스트에 무엇이 실리는가» 뿐이다.
describe('resolveManifestHighlights', () => {
  it('덮어쓸 값이 없으면 노트의 highlights를 그대로 쓴다', () => {
    expect(resolveManifestHighlights({ highlights: ['노트 줄'] }, undefined)).toEqual(['노트 줄'])
  })

  it('덮어쓸 값이 있으면 그쪽이 이긴다', () => {
    expect(resolveManifestHighlights({ highlights: ['노트 줄'] }, ['배포 인자 줄'])).toEqual(['배포 인자 줄'])
  })
})

// ADR-119 결정 6 + ADR-126 결정 8: 노트도 핵심 목록도 없이는 배포가 나가지 않는다. 판정을 순수
// 함수로 갈라 둔 이유가 이 블록이다 — 스크립트 본문은 실행해 볼 수 없지만(빌드·gh 업로드를
// 부른다) 판정은 테스트할 수 있다.
describe('describeReleaseNoteGap', () => {
  const full = {
    version: '9.9.9',
    date: '2026-01-01',
    items: [{ category: 'feature', text: '무언가 바뀌었다' }],
    highlights: ['핵심 한 줄'],
  }

  it('항목과 핵심 목록이 다 있으면 null — 그것이 배포 통과 판정이다', () => {
    expect(describeReleaseNoteGap(full)).toBeNull()
  })

  it('그 버전의 노트가 아예 없으면(undefined) 중단 판정이다', () => {
    expect(describeReleaseNoteGap(undefined)).not.toBeNull()
  })

  // 빈 노트는 노트가 아니다 — 버전만 적어 두고 내용을 안 쓴 것을 통과시키면 결정 6이 막으려는
  // "영영 빈 채로 남는 버전"이 그대로 나간다.
  it('items가 비어 있으면 중단 판정이다', () => {
    expect(describeReleaseNoteGap({ ...full, items: [] })).not.toBeNull()
  })

  // ADR-126 결정 8: 핵심 목록을 선택 사항으로 두면 안 쓰게 되고, 안 쓰면 모달이 다시 "버전 +
  // 용량"만 말하는 자리로 돌아간다 — 이 ADR 이 고치려던 상태 그 자체다.
  it('highlights가 없거나 비어 있으면 중단 판정이다', () => {
    expect(describeReleaseNoteGap({ ...full, highlights: undefined })).not.toBeNull()
    expect(describeReleaseNoteGap({ ...full, highlights: [] })).not.toBeNull()
  })

  it('문구가 어느 쪽이 비었는지 갈라 말한다 — 무엇을 쓰라는 것인지 알 수 있어야 한다', () => {
    const itemsGap = describeReleaseNoteGap({ ...full, items: [] })
    const highlightsGap = describeReleaseNoteGap({ ...full, highlights: [] })

    expect(itemsGap).not.toBe(highlightsGap)
    expect(highlightsGap).toContain('highlights')
  })

  // 배포 직전이 아니라 지금 걸리게 한다 — 목록 맨 앞은 다음에 나갈 버전의 노트다.
  it('데이터 파일의 최신 노트는 그대로 배포 가능하다', () => {
    expect(describeReleaseNoteGap(RELEASE_NOTES[0])).toBeNull()
  })
})

// ADR-125 결정 2 의 존재 이유 그 자체 — 이 스크립트는 `release-notes.ts` 를 **Node 에서 직접**
// import 한다(타입 스트리핑). 그 파일에 `.webp` import 가 들어오면 Node 가 해석하지 못해 배포가
// 그 자리에서 죽는다. 안내 본문을 기능 카탈로그로 가른 것이 그것을 막고 있고, 이 테스트가 그
// 경계를 지킨다 — 여기가 깨지면 릴리스 경로가 깨진 것이다.
describe('release-notes.ts 는 Node 가 읽을 수 있는 순수 데이터로 남는다', () => {
  it('노트 항목이 안내를 id 문자열로만 들고 있다 — 본문·이미지를 들고 있지 않다', () => {
    for (const note of RELEASE_NOTES) {
      for (const item of note.items) {
        if (item.guideId === undefined) continue
        expect(typeof item.guideId).toBe('string')
      }
    }

    // 노트 전체가 JSON 으로 왕복 가능하다 = 모듈 참조·번들 URL 같은 것이 섞여 있지 않다.
    expect(() => JSON.parse(JSON.stringify(RELEASE_NOTES))).not.toThrow()
  })
})

// ADR-126 결정 2: highlights 는 읽는 쪽에서 선택 필드라 파싱의 필수 검사에 없다. 실어 보낸 값이
// 실제로 읽히는지는 스크립트 쪽 형식과 앱 쪽 파서를 한 번에 이어 봐야 알 수 있다.
describe('매니페스트 왕복', () => {
  it('highlights를 실은 매니페스트가 parseLiveUpdateManifest를 통과하고 값이 그대로 읽힌다', () => {
    const { highlights } = RELEASE_NOTES[0]

    const parsed = parseLiveUpdateManifest({
      version: '9.9.9',
      url: 'https://example.com/9.9.9.zip',
      checksum: 'abc',
      size: 123,
      highlights,
    })

    expect(parsed?.highlights).toEqual(highlights)
  })

  // ADR-154 — 같은 이유로 같은 확인이 필요하다. 이 배포는 «올렸다» 가 아니라 «앱이 그걸 보고
  // 스토어로 간다» 가 성공이라, 스크립트가 쓰는 형식과 앱 파서를 한 번에 이어 본다.
  it('--store-required가 만든 목록이 파서를 통과하고 값이 그대로 읽힌다', () => {
    const { storeRequiredPlatforms } = parseArgs(['--store-required', 'android'])

    const parsed = parseLiveUpdateManifest({
      version: '9.9.9',
      url: 'https://example.com/9.9.9.zip',
      checksum: 'abc',
      size: 123,
      storeRequiredPlatforms,
    })

    expect(parsed?.storeRequiredPlatforms).toEqual(['android'])
  })

  // 2단계가 실제로 «한 줄 고치기» 인지 — 1단계 매니페스트에 "ios" 만 더한 형태가 그대로 읽힌다.
  it('2단계 형태(android,ios)도 그대로 읽힌다', () => {
    const { storeRequiredPlatforms } = parseArgs(['--store-required', 'android,ios'])

    const parsed = parseLiveUpdateManifest({
      version: '9.9.9',
      url: 'https://example.com/9.9.9.zip',
      checksum: 'abc',
      size: 123,
      storeRequiredPlatforms,
    })

    expect(parsed?.storeRequiredPlatforms).toEqual(['android', 'ios'])
  })
})

// ADR-154 결정 4 — `ota/latest.json` 은 캐패시터 소스를 지운 뒤 **유도를 켜는 유일한 재료**다.
// url·checksum·size 는 그 빌드에서만 나오는 값이라 다시 계산할 방법이 없고, 이 파일이 깨지면
// 이미 올라간 1.0.6.zip 이 «아무도 못 받는 번들» 이 된다. 그래서 형식을 테스트가 지킨다.
describe('ota/latest.json — 캐패시터 최종 매니페스트 초안', () => {
  const draft = JSON.parse(readFileSync(new URL('../../ota/latest.json', import.meta.url), 'utf-8'))

  it('앱의 파서를 그대로 통과한다', () => {
    expect(parseLiveUpdateManifest(draft)).not.toBeNull()
    // 매니페스트는 GitHub CDN 이 octet-stream 으로 내려줘 문자열로 도착하는 경로가 실재한다.
    expect(parseLiveUpdateManifest(JSON.stringify(draft))).not.toBeNull()
  })

  it('아직 게이트가 꺼져 있다 — 켜는 것은 스토어 게시를 확인한 사람이다', () => {
    expect(draft.storeRequiredPlatforms).toBeUndefined()
  })

  it('업로드된 zip 을 가리키고 버전이 x.y.z 다', () => {
    expect(draft.url).toContain(`/${draft.version}.zip`)
    expect(draft.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(draft.checksum).toMatch(/^[0-9a-f]{64}$/)
    expect(draft.size).toBeGreaterThan(0)
  })
})

