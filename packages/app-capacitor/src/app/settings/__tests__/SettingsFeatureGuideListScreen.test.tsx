// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FeatureGuide } from '@core/types'
import { SettingsFeatureGuideListScreen } from '../SettingsFeatureGuideListScreen'

// 안내 데이터는 화면이 아니라 데이터 파일이 소유한다 — 그룹 조합을 훑는 케이스를 위해
// `src/data/feature-guides.ts` 를 늘리지 않고 여기서 픽스처를 주입한다.
let fixture: FeatureGuide[] | null = null

vi.mock('@core/data/feature-guides', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@core/data/feature-guides')>()
  return {
    ...actual,
    get FEATURE_GUIDES(): FeatureGuide[] {
      return fixture ?? actual.FEATURE_GUIDES
    },
  }
})

function GuideProbe(): React.JSX.Element {
  const { guideId } = useParams()
  return <div>안내 프로브 {guideId}</div>
}

function renderListScreen(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/settings/guide']}>
      <Routes>
        <Route path="/settings" element={<div>설정 프로브</div>} />
        <Route path="/settings/guide" element={<SettingsFeatureGuideListScreen />} />
        <Route path="/settings/guide/:guideId" element={<GuideProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

const 보스안내: FeatureGuide = {
  id: 'boss-party',
  title: '파티 인원 관리',
  groups: ['boss'],
  sections: [{ id: 'a', title: '마디', blocks: [{ text: '보스 설명' }] }],
}
const 수익안내: FeatureGuide = {
  id: 'drop-item-price',
  title: '아이템 가격 기록 방법',
  groups: ['profit'],
  sections: [{ id: 'a', title: '마디', blocks: [{ text: '수익 설명' }] }],
}
// 「캐릭터 관리」처럼 **두 그룹에 서는** 안내 — 사본이 아니라 같은 글 한 벌이다.
const 공통안내: FeatureGuide = {
  id: 'character-manage',
  title: '캐릭터 관리',
  groups: ['content', 'boss'],
  sections: [{ id: 'a', title: '마디', blocks: [{ text: '공통 설명' }] }],
}

beforeEach(() => {
  fixture = [수익안내, 보스안내, 공통안내]
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SettingsFeatureGuideListScreen', () => {
  it('"기능 설명" 제목과 뒤로 버튼을 그리고, 뒤로를 누르면 설정으로 돌아간다', () => {
    renderListScreen()

    expect(screen.getByRole('heading', { name: '기능 설명' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '뒤로' }))
    expect(screen.getByText('설정 프로브')).toBeInTheDocument()
  })

  // 탭 순서는 데이터가 아니라 FEATURE_GUIDE_GROUP_ORDER 가 정한다 — 안내를 쓰는 사람이 어떤
  // 순서로 적든 화면은 늘 같아야 한다(RELEASE_NOTE_CATEGORY_ORDER 와 같은 규칙).
  it('탭 순서는 데이터 순서가 아니라 정해진 순서다', () => {
    renderListScreen()

    const tabs = screen.getAllByTestId('guide-group-tab').map((node) => node.textContent)
    expect(tabs).toEqual(['컨텐츠', '보스', '수익'])
  })

  // ThemeSelector·개발 노트의 카테고리 섹션과 같은 규칙 — 거른 결과가 0이면 탭째 감춘다.
  // 지금 「컨텐츠」·「설정」에는 안내가 없고, 빈 탭을 열면 아무것도 없는 화면을 만난다.
  it('안내가 없는 그룹은 탭째 그리지 않는다', () => {
    renderListScreen()

    // 지금 실제 데이터에서 `유틸리티` 가 이 처지다.
    expect(screen.queryByText('유틸리티')).not.toBeInTheDocument()
    expect(screen.queryByText('설정')).not.toBeInTheDocument()
  })

  // 한 안내가 여러 그룹에 선다(ADR-125 결정 1 정정) — 「캐릭터 관리」가 컨텐츠·보스 양쪽에
  // 같은 글로 서야 한다. 사본을 두면 갈라진다.
  it('여러 그룹에 속한 안내는 그 그룹 탭마다 나온다', () => {
    renderListScreen()

    expect(screen.getByText('캐릭터 관리')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '보스' }))
    expect(screen.getByText('캐릭터 관리')).toBeInTheDocument()
    expect(screen.getByText('파티 인원 관리')).toBeInTheDocument()
  })

  it('첫 탭이 처음부터 선택돼 있고, 그 그룹의 안내만 보인다', () => {
    renderListScreen()

    const tabs = screen.getAllByTestId('guide-group-tab')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    // 첫 탭은 `컨텐츠` 이고 거기엔 공통 안내만 있다.
    expect(screen.getByText('캐릭터 관리')).toBeInTheDocument()
    expect(screen.queryByText('아이템 가격 기록 방법')).not.toBeInTheDocument()
  })

  it('탭을 바꾸면 그 그룹의 안내로 갈아탄다', () => {
    renderListScreen()

    fireEvent.click(screen.getByRole('tab', { name: '수익' }))

    expect(screen.getByText('아이템 가격 기록 방법')).toBeInTheDocument()
    expect(screen.queryByText('파티 인원 관리')).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '수익' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '보스' })).toHaveAttribute('aria-selected', 'false')
  })

  it('안내를 누르면 그 상세로 간다', () => {
    renderListScreen()

    fireEvent.click(screen.getByRole('tab', { name: '보스' }))
    fireEvent.click(screen.getByRole('button', { name: /파티 인원 관리/ }))
    expect(screen.getByText('안내 프로브 boss-party')).toBeInTheDocument()
  })

  it('안내가 하나도 없으면 빈 상태를 그리고 탭도 만들지 않는다', () => {
    fixture = []
    renderListScreen()

    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.queryAllByTestId('guide-group-tab')).toHaveLength(0)
  })

  // 그룹이 하나뿐이면 고를 것이 없다 — 탭 줄은 선택지가 둘 이상일 때만 뜻이 있다.
  it('그룹이 하나뿐이면 탭 줄을 그리지 않는다', () => {
    fixture = [보스안내]
    renderListScreen()

    expect(screen.queryAllByTestId('guide-group-tab')).toHaveLength(0)
    expect(screen.getByText('파티 인원 관리')).toBeInTheDocument()
  })

  it('한 그룹에 여러 안내가 있으면 데이터 순서대로 나열한다', () => {
    fixture = [
      { ...수익안내, id: 'first', title: '먼저 것' },
      { ...수익안내, id: 'second', title: '나중 것' },
    ]
    renderListScreen()

    const rows = screen.getAllByTestId('guide-row')
    expect(rows.map((row) => within(row).getByTestId('guide-row-title').textContent)).toEqual([
      '먼저 것',
      '나중 것',
    ])
  })
})
