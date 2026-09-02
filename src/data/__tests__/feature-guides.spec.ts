import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { RELEASE_NOTES } from '../release-notes'
import {
  FEATURE_GUIDES,
  FEATURE_GUIDE_GROUP_LABELS,
  FEATURE_GUIDE_GROUP_ORDER,
  findFeatureGuide,
} from '../feature-guides'

// 안내는 노트 항목과 **다른 파일**에 산다. 배포 스크립트가 `release-notes.ts` 를
// Node 에서 직접 import 하는데(`scripts/publish-live-update.mjs`) 안내가 들고 오는 `.webp` import 를
// Node 가 해석하지 못하기 때문이다. 파일이 갈린 대가로 **둘이 어긋날 자리**가 생기고, 그 방어선이
// 이 파일이다. 타입은 `guideId`·`guideSectionId` 가 실재하는지 모른다. 문자열일 뿐이다.

// 안내 하나가 파일 하나다(2026-08-11). 그래서 **파일은 만들었는데 `index.ts` 에 안 넣는** 실패가
// 새로 생긴다. 화면에 안 나오는데 파일은 멀쩡히 있어 눈으로는 알아채기 어렵다.
describe('안내 파일과 index 가 어긋나지 않는다', () => {
  // 폴더를 **직접 훑는다**. vitest 시절엔 `import.meta.glob` 이 이 자리였는데 그것은
  // Vite 의 컴파일 타임 API 라 jest 에는 짝이 없다. 대신 `readdirSync` + `require` 로 같은 일을
  // 한다(묻는 것은 그대로다: 폴더의 파일과 `index.ts` 가 어긋나지 않는가).
  const guidesDir = join(__dirname, '../feature-guides')
  const modules = Object.fromEntries(
    readdirSync(guidesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((dir) =>
        readdirSync(join(guidesDir, dir.name))
          .filter((file) => file.endsWith('.ts'))
          .map((file) => [
            `../feature-guides/${dir.name}/${file}`,
            require(join(guidesDir, dir.name, file)) as Record<string, unknown>,
          ]),
      ),
  )

  it('폴더의 모든 안내 파일이 FEATURE_GUIDES 에 들어 있다', () => {
    const listed = new Set(FEATURE_GUIDES.map((guide) => guide.id))

    for (const [path, module] of Object.entries(modules)) {
      const exported = Object.values(module).filter(
        (value): value is { id: string } =>
          typeof value === 'object' && value !== null && 'id' in value,
      )
      expect(exported.length, `${path} 가 안내를 export 하지 않는다`).toBeGreaterThan(0)
      for (const guide of exported) {
        expect(listed.has(guide.id), `${path} 의 "${guide.id}" 가 index.ts 에 없다`).toBe(true)
      }
    }
  })

  it('FEATURE_GUIDES 의 안내 수가 파일 수와 같다 — 한 파일에 몰아 넣지 않는다', () => {
    expect(FEATURE_GUIDES.length).toBe(Object.keys(modules).length)
  })
})

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

  // 순서 상수에 없는 그룹은 화면에서 **탭째 사라져** 그 안내에 닿을 길이 없어진다.
  it('모든 안내가 정해진 그룹에만 속하고, 최소 하나를 갖는다', () => {
    for (const guide of FEATURE_GUIDES) {
      expect(guide.groups.length, `${guide.id} 에 group 이 없음`).toBeGreaterThan(0)
      for (const group of guide.groups) {
        expect(FEATURE_GUIDE_GROUP_ORDER, `${guide.id} 에 알 수 없는 group "${group}"`).toContain(
          group,
        )
      }
    }
  })

  // 같은 그룹을 두 번 적으면 그 탭에서 같은 행이 두 번 나온다.
  it('한 안내의 groups 에 중복이 없다', () => {
    for (const guide of FEATURE_GUIDES) {
      expect(new Set(guide.groups).size, `${guide.id} 의 groups 에 중복`).toBe(guide.groups.length)
    }
  })

  it('모든 그룹에 라벨이 있다', () => {
    for (const group of FEATURE_GUIDE_GROUP_ORDER) {
      expect(FEATURE_GUIDE_GROUP_LABELS[group]?.trim()).toBeTruthy()
    }
  })

  it('모든 안내가 섹션을 최소 하나 갖고, 섹션마다 제목이 있다', () => {
    for (const guide of FEATURE_GUIDES) {
      expect(guide.sections.length, `${guide.id} 에 섹션이 없음`).toBeGreaterThan(0)
      for (const section of guide.sections) {
        expect(section.title.trim(), `${guide.id}/${section.id} 의 title 이 비어 있음`).not.toBe('')
        expect(section.id.trim(), `${guide.id} 에 id 가 빈 섹션이 있음`).not.toBe('')
      }
    }
  })

  // 섹션 id 는 목차 링크이자 `?s=` 의 값이다. 겹치면 노트가 가리킨 마디가 어디인지 정해지지 않는다.
  it('한 안내 안에서 섹션 id 가 겹치지 않는다', () => {
    for (const guide of FEATURE_GUIDES) {
      const ids = guide.sections.map((section) => section.id)
      expect(new Set(ids).size, `${guide.id} 의 섹션 id 중복: ${ids.join(', ')}`).toBe(ids.length)
    }
  })

  it('모든 섹션이 블록을 최소 하나 갖는다', () => {
    for (const guide of FEATURE_GUIDES) {
      for (const section of guide.sections) {
        expect(
          section.blocks.length,
          `${guide.id}/${section.id} 에 블록이 없음`,
        ).toBeGreaterThan(0)
      }
    }
  })

  // 이미지도 문단도 없는 블록은 그릴 것이 없다. 타입은 둘 다 선택이라 통과시킨다.
  it('이미지도 문단도 없는 빈 블록이 없다', () => {
    for (const guide of FEATURE_GUIDES) {
      for (const section of guide.sections) {
        section.blocks.forEach((block, index) => {
          const hasText = block.text !== undefined && block.text.trim() !== ''
          expect(
            hasText || block.image !== undefined,
            `${guide.id}/${section.id} 의 ${index}번 블록이 비어 있음`,
          ).toBe(true)
        })
      }
    }
  })

  // 안내 화면에서 이미지는 장식이 아니라 **정보를 나른다**.
  it('이미지 블록에는 공백 아닌 대체 텍스트가 있다', () => {
    for (const guide of FEATURE_GUIDES) {
      for (const section of guide.sections) {
        for (const block of section.blocks) {
          if (block.image === undefined) continue
          expect(block.image.alt.trim(), `${guide.id} 에 대체 텍스트 없는 이미지`).not.toBe('')
          // `src` 의 타입은 이제 **RN 기준**이다(`ImageAssetRef` = 모듈 id 숫자). 웹 프로그램이
          // 사라지면서 `image-asset.ts`(문자열 URL) 쪽을 보는 tsc 가 없어졌다.
          // 정작 이 테스트가 도는 vitest 에서는 Vite 가 같은 import 를 URL 문자열로 준다. 어느
          // 쪽이든 여기서 묻는 것은 **비어 있지 않은가** 하나라 표현을 문자열로 눕혀서 본다.
          expect(String(block.image.src).trim(), `${guide.id} 에 src 가 빈 이미지`).not.toBe('')
        }
      }
    }
  })
})

describe('노트 항목 → 안내 참조 (정정 · 결정 7)', () => {
  const links = RELEASE_NOTES.flatMap((note) =>
    note.items
      .filter((item) => item.guideId !== undefined)
      .map((item) => ({ guideId: item.guideId as string, sectionId: item.guideSectionId })),
  )

  it('모든 guideId 에 대응하는 안내가 있다 — 미아 참조 금지', () => {
    const guideIds = new Set(FEATURE_GUIDES.map((guide) => guide.id))
    for (const link of links) {
      expect(guideIds.has(link.guideId), `노트 항목이 없는 안내 "${link.guideId}" 를 가리킨다`).toBe(
        true,
      )
    }
  })

  // 섹션까지 가리켰는데 그 마디가 없으면 **화면은 조용히 첫머리로 떨어진다**. 링크가 깨진 것을
  // 아무도 눈치채지 못한다. 그래서 여기서 막는다.
  it('guideSectionId 가 있으면 그 안내 안에 실재하는 섹션이다', () => {
    for (const link of links) {
      if (link.sectionId === undefined) continue
      const guide = findFeatureGuide(link.guideId)
      expect(
        guide?.sections.some((section) => section.id === link.sectionId),
        `"${link.guideId}" 에 "${link.sectionId}" 마디가 없다`,
      ).toBe(true)
    }
  })

  it('guideSectionId 만 있고 guideId 가 없는 항목은 없다', () => {
    for (const note of RELEASE_NOTES) {
      for (const item of note.items) {
        if (item.guideSectionId === undefined) continue
        expect(item.guideId, `"${item.text}" 가 guideId 없이 마디만 가리킨다`).toBeDefined()
      }
    }
  })

  // **반대 방향은 강제하지 않는다**. 이것이 결정 1 정정의 핵심이다. 원천이 기능 카탈로그로
  // 옮겨갔으므로 "노트에 안 걸린 안내"는 결함이 아니라 **정상**이다: 옛 기능은 릴리스 노트가
  // 남아 있지 않아도 사용법은 있어야 한다. (버전 축이던 시절엔 "고아 안내"라 금지 대상이었다.)
  it('노트가 가리키지 않는 안내가 있어도 된다 — 카탈로그가 원천이다', () => {
    const linked = new Set(links.map((link) => link.guideId))
    expect(FEATURE_GUIDES.some((guide) => !linked.has(guide.id))).toBe(true)
  })

  // 막는 것은 "같은 안내"가 아니라 **같은 (안내, 마디)** 쌍이다. 한 릴리스가 같은 기능의 서로
  // 다른 마디를 건드리는 것은 정상이고(예: 가격 입력과 갈라 보기), 그때 두 항목은 각자 다른
  // 자리로 가야 한다. 같은 자리로 가는 `›` 가 둘이면 어느 항목의 설명인지 흐려진다.
  it('같은 (안내, 마디) 를 두 노트 항목이 가리키지 않는다', () => {
    const keys = links.map((link) => `${link.guideId}#${link.sectionId ?? ''}`)
    expect(new Set(keys).size, `중복 참조: ${keys.join(', ')}`).toBe(keys.length)
  })
})

describe('findFeatureGuide', () => {
  it('있는 id 의 안내를 찾는다', () => {
    const existing = FEATURE_GUIDES[0]
    expect(existing, '안내가 하나도 없으면 이 테스트가 뜻을 잃는다').toBeDefined()
    expect(findFeatureGuide(existing.id)).toBe(existing)
  })

  // `findReleaseNote` 와 같은 계약이다. "없다"의 판정은 호출부가 한다(화면은 목록으로 되돌린다).
  it('없는 id 에는 던지지 않고 undefined 를 돌린다', () => {
    expect(findFeatureGuide('없는-안내')).toBeUndefined()
  })
})
