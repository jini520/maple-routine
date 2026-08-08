import { describe, expect, it } from 'vitest'
import { RELEASE_NOTES, findReleaseNote } from '../release-notes'

// 릴리스 노트는 손으로 쓰는 파일이고, 그 형식을 배포 게이트가 읽는다(ADR-119 결정 6) —
// 형식이 어긋난 채 커밋되면 배포 시점에야 드러나므로 여기서 형식 자체를 강제한다.
// 런타임에 정렬·중복 제거를 하지 않는 것도 같은 이유다(잘못 쓴 파일이 조용히 통과한다).

/** `1.0.10 < 1.0.9` 가 되지 않도록 문자열이 아니라 숫자 세 자리로 비교한다. */
function compareVersion(a: string, b: string): number {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] - right[i]
  }
  return 0
}

describe('release-notes 형식', () => {
  it('모든 항목의 version 이 x.y.z 형식이다', () => {
    for (const note of RELEASE_NOTES) {
      expect(note.version, `version "${note.version}" 형식 오류`).toMatch(/^\d+\.\d+\.\d+$/)
    }
  })

  it('모든 항목의 date 가 YYYY-MM-DD 형식이다', () => {
    for (const note of RELEASE_NOTES) {
      expect(note.date, `${note.version} 의 date "${note.date}" 형식 오류`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('version 에 중복이 없다', () => {
    const versions = RELEASE_NOTES.map((note) => note.version)
    expect(new Set(versions).size).toBe(versions.length)
  })

  it('버전 내림차순이다 — 최신이 먼저 온다', () => {
    for (let i = 1; i < RELEASE_NOTES.length; i++) {
      const previous = RELEASE_NOTES[i - 1].version
      const current = RELEASE_NOTES[i].version
      expect(
        compareVersion(previous, current),
        `${previous} 가 ${current} 보다 앞에 있으려면 더 높은 버전이어야 한다`,
      ).toBeGreaterThan(0)
    }
  })

  it('모든 항목이 비어 있지 않은 items 를 갖고, text 가 공백만이 아니다', () => {
    for (const note of RELEASE_NOTES) {
      expect(note.items.length, `${note.version} 의 items 가 비어 있음`).toBeGreaterThan(0)
      for (const item of note.items) {
        expect(item.text.trim(), `${note.version} 에 공백만인 text 가 있음`).not.toBe('')
      }
    }
  })
})

describe('findReleaseNote', () => {
  it('있는 버전의 노트를 찾는다', () => {
    const existing = RELEASE_NOTES[0]
    expect(findReleaseNote(existing.version)).toBe(existing)
  })

  it('없는 버전에는 던지지 않고 undefined 를 돌린다 — "노트가 없다"의 판정은 호출부가 한다', () => {
    expect(findReleaseNote('0.0.1')).toBeUndefined()
  })
})
