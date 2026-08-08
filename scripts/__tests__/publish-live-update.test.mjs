import { describe, expect, it } from 'vitest'
import {
  formatReleaseNotes,
  isPublishableReleaseNote,
  parseArgs,
  resolveBuildScript,
  resolveManifestNotes,
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

// ADR-119 결정 6: 노트 없이는 배포가 나가지 않는다. 판정을 순수 함수로 갈라 둔 이유가 이 블록이다 —
// 스크립트 본문은 실행해 볼 수 없지만(빌드·gh 업로드를 부른다) 판정은 테스트할 수 있다.
describe('isPublishableReleaseNote', () => {
  it('항목이 있는 노트는 배포 가능하다', () => {
    expect(isPublishableReleaseNote({ version: '9.9.9', date: '2026-01-01', items: [{ text: 'a' }] })).toBe(
      true,
    )
  })

  it('그 버전의 노트가 아예 없으면(undefined) 중단 판정이다', () => {
    expect(isPublishableReleaseNote(undefined)).toBe(false)
  })

  // 빈 노트는 노트가 아니다 — 버전만 적어 두고 내용을 안 쓴 것을 통과시키면 결정 6이 막으려는
  // "영영 빈 채로 남는 버전"이 그대로 나간다.
  it('items가 비어 있으면 중단 판정이다', () => {
    expect(isPublishableReleaseNote({ version: '9.9.9', date: '2026-01-01', items: [] })).toBe(false)
  })
})

describe('formatReleaseNotes', () => {
  it('모든 항목의 text가 한 덩어리 문자열에 줄 단위로 들어간다', () => {
    const notes = formatReleaseNotes({
      version: '9.9.9',
      date: '2026-01-01',
      items: [{ text: '첫째 변경' }, { text: '둘째 변경' }],
    })

    expect(notes).toContain('첫째 변경')
    expect(notes).toContain('둘째 변경')
    expect(notes.split('\n')).toHaveLength(2)
  })

  // ADR-119 결정 3: 표식이 문자열에서 사라지면 모달이 "이 항목은 OTA 로 안 온다"는 사실을 잃는다.
  it('requiresStoreUpdate 항목의 표식이 문자열에 남고, 아닌 항목에는 붙지 않는다', () => {
    const notes = formatReleaseNotes({
      version: '9.9.9',
      date: '2026-01-01',
      items: [{ text: 'OTA 변경' }, { text: '네이티브 변경', requiresStoreUpdate: true }],
    })

    const [otaLine, nativeLine] = notes.split('\n')
    expect(nativeLine).toContain('스토어 업데이트 필요')
    expect(otaLine).not.toContain('스토어 업데이트 필요')
  })
})

describe('resolveManifestNotes', () => {
  // 버전을 하드코딩하지 않는다 — 노트가 쌓이면 값이 바뀌는데, 검사하려는 것은 "실재하는 버전이
  // 문자열로 해석된다"이지 특정 릴리스의 내용이 아니다.
  it('노트가 있는 버전은 그 항목이 전부 담긴 문자열이 된다', () => {
    const latest = RELEASE_NOTES[0]

    const notes = resolveManifestNotes(latest.version)

    expect(notes).not.toBeNull()
    for (const item of latest.items) expect(notes).toContain(item.text)
  })

  it('노트가 없는 버전은 null이다 — 그것이 배포 중단 판정이다', () => {
    expect(resolveManifestNotes('0.0.0')).toBeNull()
  })

  // 결정 5: notes 는 선택 필드라 파싱의 필수 검사에 없다. 실어 보낸 값이 실제로 읽히는지는
  // 스크립트 쪽 형식과 앱 쪽 파서를 한 번에 이어 봐야 알 수 있다.
  it('합쳐진 문자열을 실은 매니페스트가 parseLiveUpdateManifest를 통과한다', () => {
    const notes = resolveManifestNotes(RELEASE_NOTES[0].version)

    const parsed = parseLiveUpdateManifest({
      version: '1.0.3',
      url: 'https://example.com/1.0.3.zip',
      checksum: 'abc',
      size: 123,
      notes,
    })

    expect(parsed?.notes).toBe(notes)
  })
})
