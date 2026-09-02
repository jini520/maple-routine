// 웹판(169줄)의 명세를 읽어 다시 쓴 것.
//
// 갈린 것 셋
// ① **라우터 프로브가 없다** — 안내를 누르면 `navigate('SettingsFeatureGuide', { guideId })` 가
//    불리는지를 본다(웹이 경로를 조립하던 자리 · `routes.ts`).
// ② `getByRole('tab', { name })` → **탭 글자에서 위로 올라가** 잡고, `aria-selected` 는
//    `accessibilityState.selected` 로 읽는다(RN 에 `tablist` 컨테이너 역할이 없다 —
//    `SettingsFeatureGuideListScreen.tsx` 파일 머리 ②).
// ③ 픽스처는 **배열 정체성을 고정해 내용만 갈아 끼운다**(`SettingsReleaseNotesScreen` 테스트
//    파일 머리 ④ 와 같은 이유·같은 처방).
import { act, fireEvent } from '@testing-library/react-native'

import type { FeatureGuide } from '../../../types'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { SettingsFeatureGuideListScreen } from '../SettingsFeatureGuideListScreen'
import { useSettingsNavigation } from '../use-settings-navigation'

// 안내 데이터는 화면이 아니라 데이터 파일이 소유한다 — 그룹 조합을 훑는 케이스를 위해
// `src/data/feature-guides/` 를 늘리지 않고 여기서 픽스처를 주입한다.
jest.mock('../../../data/feature-guides', () => ({
  ...jest.requireActual('../../../data/feature-guides'),
  FEATURE_GUIDES: [],
}))
jest.mock('../use-settings-navigation', () => ({ useSettingsNavigation: jest.fn() }))

const mockGuides = jest.requireMock<typeof import('../../../data/feature-guides')>(
  '../../../data/feature-guides',
).FEATURE_GUIDES as FeatureGuide[]

function setGuides(guides: FeatureGuide[]): void {
  mockGuides.length = 0
  mockGuides.push(...guides)
}

const mockedUseSettingsNavigation = jest.mocked(useSettingsNavigation)
const navigate = jest.fn()
const goBack = jest.fn()

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

function climbTo(view: Rendered, text: string, role: string): AtomElement {
  let node: AtomElement | null = view.getByText(text)
  while (node !== null && node.props.role !== role) node = node.parent
  if (node === null) throw new Error(`${role} 을 찾지 못했다: ${text}`)
  return node
}

/** 서브트리의 글자를 이어 붙인 것 — 웹 테스트의 `node.textContent` 자리다. */
function labelOf(node: AtomElement): string {
  let label = ''
  const walk = (current: AtomElement): void => {
    for (const child of current.children) {
      if (typeof child === 'string') label += child
      else walk(child)
    }
  }
  walk(node)
  return label
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
  setGuides([수익안내, 보스안내, 공통안내])
  mockedUseSettingsNavigation.mockReturnValue({ navigate, goBack } as unknown as ReturnType<
    typeof useSettingsNavigation
  >)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('SettingsFeatureGuideListScreen', () => {
  it('"기능 설명" 제목과 뒤로 버튼을 그리고, 뒤로를 누르면 pop 한다', async () => {
    const view = await renderOverlay(<SettingsFeatureGuideListScreen />)

    expect(view.getByText('기능 설명')).toBeTruthy()

    await press(view.getByLabelText('뒤로'))

    expect(goBack).toHaveBeenCalledTimes(1)
  })

  // 탭 순서는 데이터가 아니라 FEATURE_GUIDE_GROUP_ORDER 가 정한다 — 안내를 쓰는 사람이 어떤
  // 순서로 적든 화면은 늘 같아야 한다(RELEASE_NOTE_CATEGORY_ORDER 와 같은 규칙).
  it('탭 순서는 데이터 순서가 아니라 정해진 순서다', async () => {
    const view = await renderOverlay(<SettingsFeatureGuideListScreen />)

    expect(view.getAllByTestId('guide-group-tab').map(labelOf)).toEqual(['컨텐츠', '보스', '수익'])
  })

  // `ThemeSelector`·개발 노트의 카테고리 섹션과 같은 규칙 — 거른 결과가 0이면 탭째 감춘다.
  // 빈 탭을 열면 아무것도 없는 화면을 만난다.
  it('안내가 없는 그룹은 탭째 그리지 않는다', async () => {
    const view = await renderOverlay(<SettingsFeatureGuideListScreen />)

    // 실제 데이터에서 `유틸리티` 가 이 처지다.
    expect(view.queryByText('유틸리티')).toBeNull()
    expect(view.queryByText('설정')).toBeNull()
  })

  // 한 안내가 여러 그룹에 선다(정정) — 「캐릭터 관리」가 컨텐츠·보스 양쪽에
  // 같은 글로 서야 한다. 사본을 두면 갈라진다.
  it('여러 그룹에 속한 안내는 그 그룹 탭마다 나온다', async () => {
    const view = await renderOverlay(<SettingsFeatureGuideListScreen />)

    expect(view.getByText('캐릭터 관리')).toBeTruthy()

    await press(climbTo(view, '보스', 'tab'))

    expect(view.getByText('캐릭터 관리')).toBeTruthy()
    expect(view.getByText('파티 인원 관리')).toBeTruthy()
  })

  it('첫 탭이 처음부터 선택돼 있고, 그 그룹의 안내만 보인다', async () => {
    const view = await renderOverlay(<SettingsFeatureGuideListScreen />)

    expect(climbTo(view, '컨텐츠', 'tab').props.accessibilityState?.selected).toBe(true)
    // 첫 탭은 `컨텐츠` 이고 거기엔 공통 안내만 있다.
    expect(view.getByText('캐릭터 관리')).toBeTruthy()
    expect(view.queryByText('아이템 가격 기록 방법')).toBeNull()
  })

  it('탭을 바꾸면 그 그룹의 안내로 갈아탄다', async () => {
    const view = await renderOverlay(<SettingsFeatureGuideListScreen />)

    await press(climbTo(view, '수익', 'tab'))

    expect(view.getByText('아이템 가격 기록 방법')).toBeTruthy()
    expect(view.queryByText('파티 인원 관리')).toBeNull()
    expect(climbTo(view, '수익', 'tab').props.accessibilityState?.selected).toBe(true)
    expect(climbTo(view, '보스', 'tab').props.accessibilityState?.selected).toBe(false)
  })

  it('안내를 누르면 그 상세를 민다', async () => {
    const view = await renderOverlay(<SettingsFeatureGuideListScreen />)

    await press(climbTo(view, '보스', 'tab'))
    await press(climbTo(view, '파티 인원 관리', 'button'))

    expect(navigate).toHaveBeenCalledWith('SettingsFeatureGuide', { guideId: 'boss-party' })
  })

  it('안내가 하나도 없으면 빈 상태를 그리고 탭도 만들지 않는다', async () => {
    setGuides([])
    const view = await renderOverlay(<SettingsFeatureGuideListScreen />)

    expect(view.getByText('아직 준비된 기능 설명이 없습니다')).toBeTruthy()
    expect(view.queryAllByTestId('guide-group-tab')).toHaveLength(0)
  })

  // 그룹이 하나뿐이면 고를 것이 없다 — 탭 줄은 선택지가 둘 이상일 때만 뜻이 있다.
  it('그룹이 하나뿐이면 탭 줄을 그리지 않는다', async () => {
    setGuides([보스안내])
    const view = await renderOverlay(<SettingsFeatureGuideListScreen />)

    expect(view.queryAllByTestId('guide-group-tab')).toHaveLength(0)
    expect(view.getByText('파티 인원 관리')).toBeTruthy()
  })

  it('한 그룹에 여러 안내가 있으면 데이터 순서대로 나열한다', async () => {
    setGuides([
      { ...수익안내, id: 'first', title: '먼저 것' },
      { ...수익안내, id: 'second', title: '나중 것' },
    ])
    const view = await renderOverlay(<SettingsFeatureGuideListScreen />)

    expect(view.getAllByTestId('guide-row-title').map((node) => node.props.children)).toEqual([
      '먼저 것',
      '나중 것',
    ])
  })
})
