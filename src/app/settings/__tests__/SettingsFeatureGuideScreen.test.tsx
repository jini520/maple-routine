// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReleaseNoteGuide } from '../../../types'
import { SettingsFeatureGuideScreen } from '../SettingsFeatureGuideScreen'

// 가이드 데이터는 화면이 아니라 데이터 파일이 소유한다(ADR-119 결정 4 와 같은 규칙) — 블록 조합을
// 훑는 케이스를 위해 `src/data/release-note-guides.ts` 를 늘리지 않고 여기서 픽스처를 주입한다.
let fixture: ReleaseNoteGuide[] | null = null

vi.mock('../../../data/release-note-guides', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/release-note-guides')>()
  return {
    ...actual,
    get RELEASE_NOTE_GUIDES(): ReleaseNoteGuide[] {
      return fixture ?? actual.RELEASE_NOTE_GUIDES
    },
    findReleaseNoteGuide(id: string): ReleaseNoteGuide | undefined {
      return (fixture ?? actual.RELEASE_NOTE_GUIDES).find((guide) => guide.id === id)
    },
  }
})

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

function renderGuideScreen(
  guideId: string,
  before: string[] = [],
): ReturnType<typeof render> {
  return render(
    <MemoryRouter
      initialEntries={[...before, `/settings/release-notes/${guideId}`]}
      initialIndex={before.length}
    >
      <BackProbe />
      <Routes>
        <Route path="/설정-바깥" element={<div>설정 바깥 프로브</div>} />
        <Route path="/settings/release-notes" element={<div>개발 노트 프로브</div>} />
        <Route path="/settings/release-notes/:guideId" element={<SettingsFeatureGuideScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  fixture = [
    {
      id: '파티-모달',
      title: '보스 카드에서 파티 인원 고치기',
      blocks: [
        { image: { src: '/guide/party-1.webp', alt: '보스 카드를 탭해 연 파티 모달' } },
        { text: '보스 카드를 탭하면 파티 인원과 난이도를 그 자리에서 고칠 수 있습니다.' },
        {
          image: { src: '/guide/party-2.webp', alt: '난이도 세그먼트' },
          text: '난이도를 바꾸면 파티 인원도 그 난이도의 값으로 갈아탑니다.',
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
  // 골격은 `/settings/about/privacy` 와 같다 — 부모 화면의 행에서 열리는 2단 스택(ADR-125 결정 3).
  it('가이드 제목을 머리말로 그리고, 뒤로를 누르면 개발 노트로 돌아간다', () => {
    renderGuideScreen('파티-모달')

    expect(
      screen.getByRole('heading', { name: '보스 카드에서 파티 인원 고치기' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '뒤로' }))
    expect(screen.getByText('개발 노트 프로브')).toBeInTheDocument()
  })

  // ADR-125 결정 6: 블록은 이미지만·문단만·둘 다를 모두 허용한다.
  it('블록을 데이터 순서대로 그린다 — 이미지만·문단만·둘 다', () => {
    renderGuideScreen('파티-모달')

    const blocks = screen.getAllByTestId('guide-block')
    expect(blocks).toHaveLength(3)

    expect(
      screen.getByText('보스 카드를 탭하면 파티 인원과 난이도를 그 자리에서 고칠 수 있습니다.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('난이도를 바꾸면 파티 인원도 그 난이도의 값으로 갈아탑니다.'),
    ).toBeInTheDocument()
  })

  // 안내 화면에서 이미지는 정보를 나른다 — 대체 텍스트가 곧 그 정보다.
  it('이미지를 대체 텍스트와 함께 그린다', () => {
    renderGuideScreen('파티-모달')

    const first = screen.getByAltText('보스 카드를 탭해 연 파티 모달')
    expect(first).toHaveAttribute('src', '/guide/party-1.webp')
    expect(screen.getByAltText('난이도 세그먼트')).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })

  it('문단만 있는 블록에는 이미지를 만들지 않는다', () => {
    fixture = [{ id: '글만', title: '글만 있는 안내', blocks: [{ text: '설명 한 줄' }] }]
    renderGuideScreen('글만')

    expect(screen.getByText('설명 한 줄')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  // ADR-125 결정 3: 옛 딥링크·오타의 착지점이 빈 화면이면 안 되고, 히스토리에 남겨 뒤로가기가
  // 다시 그리로 가게 둘 이유도 없다 — 그래서 push 가 아니라 replace 다.
  it('없는 guideId 로 들어오면 개발 노트로 되돌린다', () => {
    renderGuideScreen('없는-가이드')

    expect(screen.getByText('개발 노트 프로브')).toBeInTheDocument()
    expect(screen.queryByTestId('guide-block')).not.toBeInTheDocument()
  })

  // 되돌리기가 `push` 였다면 히스토리는 `[바깥, 없는-가이드, 개발 노트]` 가 되어 뒤로 갈 때 없는
  // 안내를 한 번 더 밟는다(그리고 또 되돌려져 개발 노트에 갇힌다). `replace` 면 그 칸이 덮여
  // `[바깥, 개발 노트]` 이므로 **한 번에 바깥으로 나간다.**
  it('되돌리기는 push 가 아니라 replace 다 — 뒤로가기가 없는 안내를 다시 밟지 않는다', () => {
    renderGuideScreen('없는-가이드', ['/설정-바깥'])
    expect(screen.getByText('개발 노트 프로브')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '히스토리 뒤로' }))
    expect(screen.getByText('설정 바깥 프로브')).toBeInTheDocument()
  })
})
