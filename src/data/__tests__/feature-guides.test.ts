import { describe, expect, it } from 'vitest'
import { RELEASE_NOTES } from '../release-notes'
import {
  FEATURE_GUIDES,
  FEATURE_GUIDE_GROUP_LABELS,
  FEATURE_GUIDE_GROUP_ORDER,
  findFeatureGuide,
} from '../feature-guides'

// 안내는 노트 항목과 **다른 파일**에 산다(ADR-125 결정 2) — 배포 스크립트가 `release-notes.ts` 를
// Node 에서 직접 import 하는데(`scripts/publish-live-update.mjs`) 안내가 들고 오는 `.webp` import 를
// Node 가 해석하지 못하기 때문이다. 파일이 갈린 대가로 **둘이 어긋날 자리**가 생기고, 그 방어선이
// 이 파일이다. 타입은 `guideId` 가 실재하는 id 인지 모른다 — 문자열일 뿐이다.

describe('feature-guides 형식', () => {
  it('id 에 중복이 없다', () => {
    const ids = FEATURE_GUIDES.map((guide) => guide.id)
    expect(new Set(ids).size, `중복된 id: ${ids.join(', ')}`).toBe(ids.length)
  })

  it('모든 안내가 공백 아닌 제목을 갖는다', () => {
    for (const guide of FEATURE_GUIDES) {
      expect(guide.title.trim(), `${guide.id} 의 title 이 비어 있음`).not.toBe('')
    }
  })

  it('모든 안내가 블록을 최소 하나 갖는다', () => {
    for (const guide of FEATURE_GUIDES) {
      expect(guide.blocks.length, `${guide.id} 에 블록이 없음`).toBeGreaterThan(0)
    }
  })

  // 순서 상수에 없는 그룹은 화면에서 **탭째 사라져** 그 안내에 닿을 길이 없어진다
  // (`RELEASE_NOTE_CATEGORY_ORDER` 가 카테고리에서 겪는 것과 같은 실패다).
  it('모든 안내의 group 이 정해진 셋 중 하나다', () => {
    for (const guide of FEATURE_GUIDES) {
      expect(
        FEATURE_GUIDE_GROUP_ORDER,
        `${guide.id} 에 알 수 없는 group "${guide.group}"`,
      ).toContain(guide.group)
    }
  })

  it('모든 그룹에 라벨이 있다', () => {
    for (const group of FEATURE_GUIDE_GROUP_ORDER) {
      expect(FEATURE_GUIDE_GROUP_LABELS[group]?.trim()).toBeTruthy()
    }
  })

  // 이미지도 문단도 없는 블록은 그릴 것이 없다 — 타입은 둘 다 선택이라 통과시킨다.
  it('이미지도 문단도 없는 빈 블록이 없다', () => {
    for (const guide of FEATURE_GUIDES) {
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
    for (const guide of FEATURE_GUIDES) {
      for (const block of guide.blocks) {
        if (block.image === undefined) continue
        expect(block.image.alt.trim(), `${guide.id} 에 대체 텍스트 없는 이미지가 있음`).not.toBe('')
        expect(block.image.src.trim(), `${guide.id} 에 src 가 빈 이미지가 있음`).not.toBe('')
      }
    }
  })
})

describe('노트 항목 → 안내 참조 (ADR-125 결정 1 정정)', () => {
  const linkedIds = RELEASE_NOTES.flatMap((note) =>
    note.items.map((item) => item.guideId).filter((id): id is string => id !== undefined),
  )

  it('모든 guideId 에 대응하는 안내가 있다 — 미아 참조 금지', () => {
    const guideIds = new Set(FEATURE_GUIDES.map((guide) => guide.id))
    for (const id of linkedIds) {
      expect(guideIds.has(id), `노트 항목이 없는 안내 "${id}" 를 가리킨다`).toBe(true)
    }
  })

  // **반대 방향은 강제하지 않는다** — 이것이 결정 1 정정의 핵심이다. 원천이 기능 카탈로그로
  // 옮겨갔으므로 "노트에 안 걸린 안내"는 결함이 아니라 **정상**이다: 옛 기능은 릴리스 노트가
  // 남아 있지 않아도 사용법은 있어야 하고, 안내는 그 기능이 살아 있는 한 계속 산다.
  // (버전 축이던 시절엔 이것이 "고아 안내"라 금지 대상이었다.)
  it('노트가 가리키지 않는 안내가 있어도 된다 — 카탈로그가 원천이다', () => {
    const linked = new Set(linkedIds)
    const unlinked = FEATURE_GUIDES.filter((guide) => !linked.has(guide.id))
    expect(Array.isArray(unlinked)).toBe(true)
  })

  // 같은 안내가 두 항목에 붙으면 목록에서 같은 화면으로 가는 `›` 가 둘이 되고,
  // 어느 항목의 설명인지가 흐려진다.
  it('한 안내가 두 노트 항목에 물리지 않는다', () => {
    expect(new Set(linkedIds).size, `중복 참조: ${linkedIds.join(', ')}`).toBe(linkedIds.length)
  })
})

describe('findFeatureGuide', () => {
  it('있는 id 의 안내를 찾는다', () => {
    const existing = FEATURE_GUIDES[0]
    expect(existing, '안내가 하나도 없으면 이 테스트가 뜻을 잃는다').toBeDefined()
    expect(findFeatureGuide(existing.id)).toBe(existing)
  })

  // `findReleaseNote` 와 같은 계약이다 — "없다"의 판정은 호출부가 한다(화면은 목록으로 되돌린다).
  it('없는 id 에는 던지지 않고 undefined 를 돌린다', () => {
    expect(findFeatureGuide('없는-안내')).toBeUndefined()
  })
})
