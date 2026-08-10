import { describe, expect, it } from 'vitest'
import { RELEASE_NOTES } from '../release-notes'
import { RELEASE_NOTE_GUIDES, findReleaseNoteGuide } from '../release-note-guides'

// 가이드는 노트 항목과 **다른 파일**에 산다(ADR-125 결정 2) — 배포 스크립트가 `release-notes.ts` 를
// Node 에서 직접 import 하는데(`scripts/publish-live-update.mjs`) 가이드가 들고 오는 `.webp` import 를
// Node 가 해석하지 못하기 때문이다. 파일이 갈린 대가로 **둘이 어긋날 자리**가 생기고, 그 방어선이
// 이 파일이다. 타입은 `guideId` 가 실재하는 id 인지 모른다 — 문자열일 뿐이다.

describe('release-note-guides 형식', () => {
  it('id 에 중복이 없다', () => {
    const ids = RELEASE_NOTE_GUIDES.map((guide) => guide.id)
    expect(new Set(ids).size, `중복된 id: ${ids.join(', ')}`).toBe(ids.length)
  })

  it('모든 가이드가 공백 아닌 제목을 갖는다', () => {
    for (const guide of RELEASE_NOTE_GUIDES) {
      expect(guide.title.trim(), `${guide.id} 의 title 이 비어 있음`).not.toBe('')
    }
  })

  it('모든 가이드가 블록을 최소 하나 갖는다', () => {
    for (const guide of RELEASE_NOTE_GUIDES) {
      expect(guide.blocks.length, `${guide.id} 에 블록이 없음`).toBeGreaterThan(0)
    }
  })

  // 이미지도 문단도 없는 블록은 그릴 것이 없다 — 타입은 둘 다 선택이라 통과시킨다.
  it('이미지도 문단도 없는 빈 블록이 없다', () => {
    for (const guide of RELEASE_NOTE_GUIDES) {
      guide.blocks.forEach((block, index) => {
        const hasText = block.text !== undefined && block.text.trim() !== ''
        expect(
          hasText || block.image !== undefined,
          `${guide.id} 의 ${index}번 블록이 비어 있음`,
        ).toBe(true)
      })
    }
  })

  // 안내 화면에서 이미지는 장식이 아니라 **정보를 나른다**(ADR-125 결정 6).
  it('이미지 블록에는 공백 아닌 대체 텍스트가 있다', () => {
    for (const guide of RELEASE_NOTE_GUIDES) {
      for (const block of guide.blocks) {
        if (block.image === undefined) continue
        expect(block.image.alt.trim(), `${guide.id} 에 대체 텍스트 없는 이미지가 있음`).not.toBe('')
        expect(block.image.src.trim(), `${guide.id} 에 src 가 빈 이미지가 있음`).not.toBe('')
      }
    }
  })
})

describe('노트 항목 ↔ 가이드 참조 무결성 (ADR-125 결정 2)', () => {
  const linkedIds = RELEASE_NOTES.flatMap((note) =>
    note.items.map((item) => item.guideId).filter((id): id is string => id !== undefined),
  )

  it('모든 guideId 에 대응하는 가이드가 있다 — 미아 참조 금지', () => {
    const guideIds = new Set(RELEASE_NOTE_GUIDES.map((guide) => guide.id))
    for (const id of linkedIds) {
      expect(guideIds.has(id), `노트 항목이 없는 가이드 "${id}" 를 가리킨다`).toBe(true)
    }
  })

  it('모든 가이드가 어느 노트 항목엔가 물려 있다 — 고아 가이드 금지', () => {
    const linked = new Set(linkedIds)
    for (const guide of RELEASE_NOTE_GUIDES) {
      expect(linked.has(guide.id), `가이드 "${guide.id}" 를 가리키는 노트 항목이 없다`).toBe(true)
    }
  })

  // 같은 안내가 두 항목에 붙으면 목록에서 같은 화면으로 가는 `›` 가 둘이 되고,
  // 어느 항목의 설명인지가 흐려진다.
  it('한 가이드가 두 항목에 물리지 않는다', () => {
    expect(new Set(linkedIds).size, `중복 참조: ${linkedIds.join(', ')}`).toBe(linkedIds.length)
  })
})

describe('findReleaseNoteGuide', () => {
  it('있는 id 의 가이드를 찾는다', () => {
    const existing = RELEASE_NOTE_GUIDES[0]
    expect(existing, '가이드가 하나도 없으면 이 테스트가 뜻을 잃는다').toBeDefined()
    expect(findReleaseNoteGuide(existing.id)).toBe(existing)
  })

  // `findReleaseNote` 와 같은 계약이다 — "없다"의 판정은 호출부가 한다(화면은 목록으로 되돌린다).
  it('없는 id 에는 던지지 않고 undefined 를 돌린다', () => {
    expect(findReleaseNoteGuide('없는-가이드')).toBeUndefined()
  })
})
