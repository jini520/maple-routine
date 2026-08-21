import {
  RELEASE_NOTES,
  RELEASE_NOTE_CATEGORY_LABELS,
  RELEASE_NOTE_CATEGORY_ORDER,
  findReleaseNote,
} from '../release-notes'

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

  // ADR-119 결정 9: 카테고리는 화면의 묶음 제목이자 매니페스트의 줄머리다. 값이 어긋나면 화면에서는
  // 묶음이 통째로 사라지고(순서 상수에 없는 값은 안 그려진다) 매니페스트에는 `[undefined]` 가 실린다.
  it('모든 항목의 category 가 정해진 셋 중 하나다', () => {
    for (const note of RELEASE_NOTES) {
      for (const item of note.items) {
        expect(
          RELEASE_NOTE_CATEGORY_ORDER,
          `${note.version} 의 "${item.text}" 에 알 수 없는 category "${item.category}"`,
        ).toContain(item.category)
      }
    }
  })

  it('모든 카테고리에 라벨이 있다', () => {
    for (const category of RELEASE_NOTE_CATEGORY_ORDER) {
      expect(RELEASE_NOTE_CATEGORY_LABELS[category]?.trim()).toBeTruthy()
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

  // ADR-126 결정 2·3: 매니페스트에 실려 업데이트 모달이 그리는 유일한 재료다. 있으면서 비어
  // 있거나 공백만인 줄이 섞이면 모달이 빈 아코디언을 연다.
  it('highlights 가 있으면 비어 있지 않고 공백만인 줄이 없다', () => {
    for (const note of RELEASE_NOTES) {
      if (note.highlights === undefined) continue
      expect(note.highlights.length, `${note.version} 의 highlights 가 빈 배열`).toBeGreaterThan(0)
      for (const line of note.highlights) {
        expect(line.trim(), `${note.version} 에 공백만인 highlights 줄이 있음`).not.toBe('')
      }
    }
  })

  // 배포 스크립트가 막는 것과 같은 조건이지만(ADR-126 결정 8) **여기서 먼저 걸린다** — 배포
  // 직전이 아니라 커밋 시점에 알아야 고칠 시간이 있다. 과거 버전에는 없는 것이 정상이라
  // (이미 발행됐고 다시 매니페스트에 실리지 않는다) 맨 앞 하나만 본다.
  it('최신 노트에는 highlights 가 있다 — 다음 배포가 그것을 싣는다', () => {
    expect(RELEASE_NOTES[0].highlights?.length ?? 0).toBeGreaterThan(0)
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
