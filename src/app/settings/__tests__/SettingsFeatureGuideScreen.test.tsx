// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FeatureGuide } from '../../../types'
import { SettingsFeatureGuideScreen } from '../SettingsFeatureGuideScreen'

// 안내 데이터는 화면이 아니라 데이터 파일이 소유한다 — 블록 조합을 훑는 케이스를 위해
// `src/data/feature-guides.ts` 를 늘리지 않고 여기서 픽스처를 주입한다.
let fixture: FeatureGuide[] | null = null

vi.mock('../../../data/feature-guides', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/feature-guides')>()
  return {
    ...actual,
    get FEATURE_GUIDES(): FeatureGuide[] {
      return fixture ?? actual.FEATURE_GUIDES
    },
    findFeatureGuide(id: string): FeatureGuide | undefined {
      return (fixture ?? actual.FEATURE_GUIDES).find((guide) => guide.id === id)
    },
  }
})

// `scrollIntoView` 는 jsdom 에 없어 setup 이 빈 함수로 채워 둔다 — 여기서 spy 로 덮어
// **무엇이 스크롤됐는지**까지 본다(호출 여부만 보면 엉뚱한 마디로 가도 통과한다).
const scrollSpy = vi.fn()
Element.prototype.scrollIntoView = scrollSpy

// 히스토리를 한 칸 되돌리는 프로브 — `replace` 와 `push` 는 **뒤로 갔을 때** 갈리므로,
// 그 차이를 재려면 테스트가 뒤로 갈 수단을 들고 있어야 한다.
function BackProbe(): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => {
        navigate(-1)
      }}
    >
      히스토리 뒤로
    </button>
  )
}

/**
 * 이 화면은 **두 부모 아래 각각 라우팅된다**(ADR-125 결정 3 정정) — 기능 설명 목록에서도,
 * 개발 노트에서도 열린다. `from` 은 그중 어느 쪽으로 들어왔는지다.
 */
function renderGuideScreen(
  guideId: string,
  from: '/settings/guide' | '/settings/release-notes' = '/settings/guide',
  before: string[] = [],
  search = '',
): ReturnType<typeof render> {
  return render(
    <MemoryRouter
      initialEntries={[...before, `${from}/${guideId}${search}`]}
      initialIndex={before.length}
    >
      <BackProbe />
      <Routes>
        <Route path="/설정-바깥" element={<div>설정 바깥 프로브</div>} />
        <Route path="/settings/guide" element={<div>기능 설명 프로브</div>} />
        <Route path="/settings/guide/:guideId" element={<SettingsFeatureGuideScreen />} />
        <Route path="/settings/release-notes" element={<div>개발 노트 프로브</div>} />
        <Route path="/settings/release-notes/:guideId" element={<SettingsFeatureGuideScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  scrollSpy.mockClear()
  fixture = [
    {
      id: '파티-모달',
      title: '파티 인원 관리',
      groups: ['boss'],
      sections: [
        {
          id: 'card',
          title: '카드에서 바로 고치기',
          blocks: [
            { image: { src: '/guide/party-1.webp', alt: '보스 카드를 탭해 연 파티 모달' } },
            { text: '보스 카드를 탭하면 파티 인원과 난이도를 그 자리에서 고칠 수 있습니다.' },
          ],
        },
        {
          id: 'difficulty',
          title: '난이도마다 따로 기억됩니다',
          blocks: [
            {
              image: { src: '/guide/party-2.webp', alt: '난이도 세그먼트' },
              text: '난이도를 바꾸면 파티 인원도 그 난이도의 값으로 갈아탑니다.',
            },
          ],
        },
      ],
    },
  ]
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SettingsFeatureGuideScreen', () => {
  it('안내 제목을 머리말로 그린다', () => {
    renderGuideScreen('파티-모달')

    expect(screen.getByRole('heading', { name: '파티 인원 관리', level: 1 })).toBeInTheDocument()
  })

  // ADR-125 결정 3 정정: 같은 화면이 두 부모 아래 각각 라우팅된다. **어디서 왔든 그리로 돌아가야
  // 한다** — 개발 노트에서 들어왔는데 기능 설명 목록으로 튀면 읽던 자리를 잃는다.
  // 부모를 상수로 박지 않고 **현재 경로에서 깎아** 쓰는 이유가 이것이다.
  it('기능 설명에서 들어오면 기능 설명으로 돌아간다', () => {
    renderGuideScreen('파티-모달', '/settings/guide')

    fireEvent.click(screen.getByRole('button', { name: '뒤로' }))
    expect(screen.getByText('기능 설명 프로브')).toBeInTheDocument()
  })

  it('개발 노트에서 들어오면 개발 노트로 돌아간다', () => {
    renderGuideScreen('파티-모달', '/settings/release-notes')

    fireEvent.click(screen.getByRole('button', { name: '뒤로' }))
    expect(screen.getByText('개발 노트 프로브')).toBeInTheDocument()
  })

  // ADR-125 결정 6: 블록은 이미지만·문단만·둘 다를 모두 허용한다.
  it('마디와 블록을 데이터 순서대로 그린다', () => {
    renderGuideScreen('파티-모달')

    const sections = screen.getAllByTestId('guide-section')
    expect(sections.map((node) => within(node).getByRole('heading').textContent)).toEqual([
      '카드에서 바로 고치기',
      '난이도마다 따로 기억됩니다',
    ])
    expect(screen.getAllByTestId('guide-block')).toHaveLength(3)
    expect(
      screen.getByText('보스 카드를 탭하면 파티 인원과 난이도를 그 자리에서 고칠 수 있습니다.'),
    ).toBeInTheDocument()
  })

  // ADR-125 결정 7 — 목차가 곧 개발 노트의 착지점 목록이다.
  it('마디가 둘 이상이면 목차를 그린다', () => {
    renderGuideScreen('파티-모달')

    const toc = screen.getByRole('navigation', { name: '목차' })
    expect(within(toc).getAllByTestId('guide-toc-item').map((n) => n.textContent)).toEqual([
      '카드에서 바로 고치기',
      '난이도마다 따로 기억됩니다',
    ])
  })

  // 마디가 하나뿐이면 목차는 아래 소제목과 같은 말을 두 번 하는 것이다.
  it('마디가 하나뿐이면 목차를 그리지 않는다', () => {
    fixture = [
      {
        id: '한마디',
        title: '한 마디짜리',
        groups: ['utility'],
        sections: [{ id: 'only', title: '유일한 마디', blocks: [{ text: '설명' }] }],
      },
    ]
    renderGuideScreen('한마디')

    expect(screen.queryByRole('navigation', { name: '목차' })).not.toBeInTheDocument()
    expect(screen.getByTestId('guide-section')).toBeInTheDocument()
  })

  // 릴리스에서 바뀐 것은 보통 기능 전체가 아니라 그중 한 마디다 — 첫머리에 떨어뜨리면
  // 읽는 사람이 그 마디를 다시 찾아야 한다(ADR-125 결정 7).
  it('?s= 로 들어오면 그 마디로 스크롤한다', () => {
    renderGuideScreen('파티-모달', '/settings/guide', [], '?s=difficulty')

    expect(scrollSpy).toHaveBeenCalledTimes(1)
    const scrolled = scrollSpy.mock.instances[0] as HTMLElement
    expect(scrolled.id).toBe('guide-파티-모달-difficulty')
  })

  it('없는 마디를 가리키면 스크롤하지 않고 첫머리에 선다', () => {
    renderGuideScreen('파티-모달', '/settings/guide', [], '?s=없는마디')

    expect(scrollSpy).not.toHaveBeenCalled()
    expect(screen.getAllByTestId('guide-section')).toHaveLength(2)
  })

  it('?s= 가 없으면 스크롤하지 않는다', () => {
    renderGuideScreen('파티-모달')

    expect(scrollSpy).not.toHaveBeenCalled()
  })

  // 목차는 **같은 화면 안의 이동**이다 — 스택이 움직이면 안 되므로 경로가 아니라 `?s=` 만 바뀐다.
  it('목차를 누르면 그 마디로 스크롤한다', () => {
    renderGuideScreen('파티-모달')

    fireEvent.click(screen.getByRole('button', { name: '난이도마다 따로 기억됩니다' }))

    expect(scrollSpy).toHaveBeenCalledTimes(1)
    const scrolled = scrollSpy.mock.instances[0] as HTMLElement
    expect(scrolled.id).toBe('guide-파티-모달-difficulty')
    // 화면은 그대로다 — 상세가 사라지거나 목록으로 튀지 않는다.
    expect(screen.getByRole('heading', { name: '파티 인원 관리', level: 1 })).toBeInTheDocument()
  })

  // 안내 화면에서 이미지는 정보를 나른다 — 대체 텍스트가 곧 그 정보다.
  it('이미지를 대체 텍스트와 함께 그린다', () => {
    renderGuideScreen('파티-모달')

    expect(screen.getByAltText('보스 카드를 탭해 연 파티 모달')).toHaveAttribute(
      'src',
      '/guide/party-1.webp',
    )
    expect(screen.getByAltText('난이도 세그먼트')).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })

  it('문단만 있는 블록에는 이미지를 만들지 않는다', () => {
    fixture = [
      {
        id: '글만',
        title: '글만 있는 안내',
        groups: ['settings'],
        sections: [{ id: 'only', title: '마디', blocks: [{ text: '설명 한 줄' }] }],
      },
    ]
    renderGuideScreen('글만')

    expect(screen.getByText('설명 한 줄')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  // 옛 딥링크·오타의 착지점이 빈 화면이면 안 된다 — **들어온 쪽 목록으로** 되돌린다.
  it('없는 guideId 로 들어오면 들어온 쪽 목록으로 되돌린다', () => {
    renderGuideScreen('없는-안내', '/settings/release-notes')
    expect(screen.getByText('개발 노트 프로브')).toBeInTheDocument()
    expect(screen.queryByTestId('guide-block')).not.toBeInTheDocument()

    cleanup()

    renderGuideScreen('없는-안내', '/settings/guide')
    expect(screen.getByText('기능 설명 프로브')).toBeInTheDocument()
  })

  // 되돌리기가 `push` 였다면 히스토리는 `[바깥, 없는-안내, 목록]` 이 되어 뒤로 갈 때 없는 안내를
  // 한 번 더 밟는다(그리고 또 되돌려져 목록에 갇힌다). `replace` 면 그 칸이 덮여 `[바깥, 목록]`
  // 이므로 **한 번에 바깥으로 나간다.**
  it('되돌리기는 push 가 아니라 replace 다 — 뒤로가기가 없는 안내를 다시 밟지 않는다', () => {
    renderGuideScreen('없는-안내', '/settings/guide', ['/설정-바깥'])
    expect(screen.getByText('기능 설명 프로브')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '히스토리 뒤로' }))
    expect(screen.getByText('설정 바깥 프로브')).toBeInTheDocument()
  })
})
