import { describe, expect, it } from 'vitest'
import {
  describeReleaseNoteGap,
  parseArgs,
  resolveBuildScript,
  resolveReleaseCreateArgs,
  resolveReleaseTag,
} from '../publish-live-update.mjs'
import { RELEASE_NOTES } from '../../src/data/release-notes.ts'
import { parseLiveUpdateManifest } from '../../src/native/live-update.ts'

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
    expect(parseArgs([])).toEqual({ isBeta: false, minNativeVersion: undefined })
  })

  it('--beta를 인식한다', () => {
    expect(parseArgs(['--beta'])).toEqual({ isBeta: true, minNativeVersion: undefined })
  })

  it('--min-native <x.y.z>를 파싱한다', () => {
    expect(parseArgs(['--beta', '--min-native', '2.0.0'])).toEqual({
      isBeta: true,
      minNativeVersion: '2.0.0',
    })
  })

  it('--min-native가 --beta 앞에 와도 위치 무관하게 파싱한다', () => {
    expect(parseArgs(['--min-native', '2.0.0', '--beta'])).toEqual({
      isBeta: true,
      minNativeVersion: '2.0.0',
    })
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
})

