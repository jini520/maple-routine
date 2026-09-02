// 웹판(275줄)의 명세를 읽어 다시 쓴 것.
//
// 갈린 것 다섯
// ① **부모를 계산하지 않는다.** 웹은 라우트가 둘이라 돌아갈 곳을 경로에서 깎아 썼고, 그래서
//    `기능 설명에서 들어오면 기능 설명으로`·`개발 노트에서 들어오면 개발 노트로` 두 케이스가
//    있었다. RN 의 pop 은 스택이 이미 알고 있어 **한 케이스로 접힌다**(`use-settings-navigation.ts`).
// ② **마디는 쿼리가 아니라 파라미터**다. 목차를 누르면 `setParams` 이고, 그것이 웹의
//  `replace` 와 같은 뜻(스택을 안 건드린다)이다.
// ③ **스크롤 검사가 `scrollIntoView` 스파이에서 `scrollTo` 스파이 + `onLayout` 주입으로** 바뀐다.
//    RN 에는 문서도 id 도 없어 마디가 자기 y 를 알려 줘야 하고(그 배선이 곧 이 화면의 계약이다),
//    jest 는 레이아웃을 계산하지 않으므로 **테스트가 그 y 를 넣어 준다.**
// ④ 없는 안내의 되돌리기는 `<Navigate replace>` → `goBack()`. 뜻(히스토리를 남기지 않는다)은 같다.
//    웹의 `push 가 아니라 replace 다` 케이스는 **스택을 우리가 미는 RN 에서 성립하지 않는다.**
// ⑤ `getByAltText` → `getByLabelText`(`alt` 의 짝은 `accessibilityLabel`), `src` → `source`.
//  그리고 그 값은 URL 문자열이 아니라 **번들 에셋 참조**다.
import { act, fireEvent } from '@testing-library/react-native'
import { ScrollView } from 'react-native'

import type { FeatureGuide } from '../../../types'

import { flattenStyle, renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { SettingsFeatureGuideScreen } from '../SettingsFeatureGuideScreen'
import { useSettingsNavigation } from '../use-settings-navigation'

// 안내 데이터는 화면이 아니라 데이터 파일이 소유한다. 블록 조합을 훑는 케이스를 위해
// `src/data/feature-guides/` 를 늘리지 않고 여기서 픽스처를 주입한다.
jest.mock('../../../data/feature-guides', () => {
  const guides: unknown[] = []
  return {
    ...jest.requireActual('../../../data/feature-guides'),
    FEATURE_GUIDES: guides,
    findFeatureGuide: (id: string): unknown =>
      guides.find((guide) => (guide as { id: string }).id === id),
  }
})
jest.mock('../use-settings-navigation', () => ({ useSettingsNavigation: jest.fn() }))

const mockGuides = jest.requireMock<typeof import('../../../data/feature-guides')>(
  '../../../data/feature-guides',
).FEATURE_GUIDES as FeatureGuide[]

function setGuides(guides: FeatureGuide[]): void {
  mockGuides.length = 0
  mockGuides.push(...guides)
}

// 라우트 파라미터는 `useRoute` 가 준다. 두 라우트가 같은 모양이라 이름만 갈아 끼운다.
let mockRoute: { name: string; params: { guideId: string; section?: string } } = {
  name: 'SettingsFeatureGuide',
  params: { guideId: '파티-모달' },
}
jest.mock('@react-navigation/native', () => ({
  useRoute: () => mockRoute,
}))

// `scrollTo` 는 **프로토타입에서** 잡는다. RNTL 이 주는 host 요소에는 그 메서드가 없고
// (`instance.scrollTo === undefined`, 실측) 화면은 셸이 넘긴 ref 를 통해 그것을 부른다.
const scrollTo = jest.spyOn(
  ScrollView.prototype as unknown as { scrollTo: (options?: unknown) => void },
  'scrollTo',
)

const mockedUseSettingsNavigation = jest.mocked(useSettingsNavigation)
const navigate = jest.fn()
const goBack = jest.fn()
const setParams = jest.fn()

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

/**
 * 그 글자를 담은 `role` 요소. **`getAllByText` 로 시작한다**. 마디 제목은 목차와 본문 소제목에
 * 두 번 나오므로(그것이 목차의 존재 이유다) 단수 질의로는 잡히지 않는다.
 */
function climbTo(view: Rendered, text: string, role: string): AtomElement {
  for (const found of view.getAllByText(text)) {
    let node: AtomElement | null = found
    while (node !== null && node.props.role !== role) node = node.parent
    if (node !== null) return node
  }
  throw new Error(`${role} 을 찾지 못했다: ${text}`)
}

/** 서브트리의 글자를 나온 순서대로. */
function textsIn(node: AtomElement): string[] {
  const texts: string[] = []
  const walk = (current: AtomElement): void => {
    for (const child of current.children) {
      if (typeof child === 'string') texts.push(child)
      else walk(child)
    }
  }
  walk(node)
  return texts
}

/**
 * 마디 위치를 알려 준다. jest 는 레이아웃을 계산하지 않으므로 **`onLayout` 을 우리가 쏜다.**
 * 순서는 화면이 그린 순서 그대로이고, 래퍼(0) 다음에 마디들이 온다.
 */
async function layout(view: Rendered, ys: number[]): Promise<void> {
  await act(async () => {
    fireEvent(view.getByTestId(`screen-${mockRoute.name}`), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 600 } },
    })
    view.getAllByTestId('guide-section').forEach((section, index) => {
      fireEvent(section, 'layout', {
        nativeEvent: { layout: { x: 0, y: ys[index] ?? 0, width: 390, height: 200 } },
      })
    })
  })
}

const 안내: FeatureGuide = {
  id: '파티-모달',
  title: '파티 인원 관리',
  groups: ['boss'],
  sections: [
    {
      id: 'card',
      title: '카드에서 바로 고치기',
      blocks: [
        { image: { src: 1 as never, alt: '보스 카드를 탭해 연 파티 모달' } },
        { text: '보스 카드를 탭하면 파티 인원과 난이도를 그 자리에서 고칠 수 있습니다.' },
      ],
    },
    {
      id: 'difficulty',
      title: '난이도마다 따로 기억됩니다',
      blocks: [
        {
          image: { src: 2 as never, alt: '난이도 세그먼트' },
          text: '난이도를 바꾸면 파티 인원도 그 난이도의 값으로 갈아탑니다.',
        },
      ],
    },
  ],
}

beforeEach(() => {
  setGuides([안내])
  mockRoute = { name: 'SettingsFeatureGuide', params: { guideId: '파티-모달' } }
  mockedUseSettingsNavigation.mockReturnValue({
    navigate,
    goBack,
    setParams,
  } as unknown as ReturnType<typeof useSettingsNavigation>)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('SettingsFeatureGuideScreen', () => {
  it('안내 제목을 머리말로 그린다', async () => {
    const view = await renderOverlay(<SettingsFeatureGuideScreen />)

    expect(view.getByText('파티 인원 관리')).toBeTruthy()
  })

  // : 같은 화면이 두 라우트에 걸린다. **어디서 왔든 그리로 돌아간다**. RN 은
  // 스택이 그것을 알고 있어 계산이 사라지고 `goBack()` 하나만 남는다.
  it.each(['SettingsFeatureGuide', 'SettingsReleaseNoteGuide'])(
    '%s 로 들어와도 뒤로는 그냥 pop 이다',
    async (name) => {
      mockRoute = { name, params: { guideId: '파티-모달' } }
      const view = await renderOverlay(<SettingsFeatureGuideScreen />)

      await press(view.getByLabelText('뒤로'))

      expect(goBack).toHaveBeenCalledTimes(1)
      expect(navigate).not.toHaveBeenCalled()
    },
  )

  // : 블록은 이미지만·문단만·둘 다를 모두 허용한다.
  it('마디와 블록을 데이터 순서대로 그린다', async () => {
    const view = await renderOverlay(<SettingsFeatureGuideScreen />)

    expect(view.getAllByTestId('guide-section')).toHaveLength(2)
    expect(view.getAllByTestId('guide-block')).toHaveLength(3)
    expect(
      view.getByText('보스 카드를 탭하면 파티 인원과 난이도를 그 자리에서 고칠 수 있습니다.'),
    ).toBeTruthy()
  })

  // 목차가 곧 개발 노트의 착지점 목록이다.
  it('마디가 둘 이상이면 목차를 그린다', async () => {
    const view = await renderOverlay(<SettingsFeatureGuideScreen />)

    expect(view.getByText('목차')).toBeTruthy()
    expect(view.getAllByTestId('guide-toc-item')).toHaveLength(2)
  })

  // 번호는 **버튼 밖**이라 누를 수 있는 이름이 제목 그대로 남는다. 개발 노트가 가리키는 이름과
  // 어긋나면 안 된다(2026-08-11 사용자 지정).
  it('목차는 `목차` 제목 + 번호 목록이고 번호는 버튼 밖이다', async () => {
    const view = await renderOverlay(<SettingsFeatureGuideScreen />)

    // 목차 덩이 전체. 번호가 있고, **버튼 안에는 제목만** 있다.
    const toc = view.getByText('목차').parent as AtomElement
    expect(textsIn(toc)).toEqual([
      '목차',
      '1',
      '.',
      '카드에서 바로 고치기',
      '2',
      '.',
      '난이도마다 따로 기억됩니다',
    ])
    expect(view.getAllByTestId('guide-toc-item').map(textsIn)).toEqual([
      ['카드에서 바로 고치기'],
      ['난이도마다 따로 기억됩니다'],
    ])
  })

  // 마디가 하나뿐이면 목차는 아래 소제목과 같은 말을 두 번 하는 것이다.
  it('마디가 하나뿐이면 목차를 그리지 않는다', async () => {
    setGuides([
      {
        id: '파티-모달',
        title: '한 마디짜리',
        groups: ['utility'],
        sections: [{ id: 'only', title: '유일한 마디', blocks: [{ text: '설명' }] }],
      },
    ])
    const view = await renderOverlay(<SettingsFeatureGuideScreen />)

    expect(view.queryByText('목차')).toBeNull()
    expect(view.getAllByTestId('guide-section')).toHaveLength(1)
  })

  // 릴리스에서 바뀐 것은 보통 기능 전체가 아니라 그중 한 마디다. 첫머리에 떨어뜨리면 읽는
  // 사람이 그 마디를 다시 찾아야 한다. **`scroll-mt-4` 몫 16px 을 뺀 자리**다.
  it('section 파라미터로 들어오면 그 마디로 스크롤한다', async () => {
    mockRoute = {
      name: 'SettingsFeatureGuide',
      params: { guideId: '파티-모달', section: 'difficulty' },
    }
    const view = await renderOverlay(<SettingsFeatureGuideScreen />)

    await layout(view, [0, 300])

    expect(scrollTo.mock.calls.map((call) => call[0])).toEqual([{ y: 284, animated: false }])
  })

  it('없는 마디를 가리키면 스크롤하지 않고 첫머리에 선다', async () => {
    mockRoute = {
      name: 'SettingsFeatureGuide',
      params: { guideId: '파티-모달', section: '없는마디' },
    }
    const view = await renderOverlay(<SettingsFeatureGuideScreen />)

    await layout(view, [0, 300])

    expect(scrollTo).not.toHaveBeenCalled()
    expect(view.getAllByTestId('guide-section')).toHaveLength(2)
  })

  it('section 이 없으면 스크롤하지 않는다', async () => {
    const view = await renderOverlay(<SettingsFeatureGuideScreen />)

    await layout(view, [0, 300])

    expect(scrollTo).not.toHaveBeenCalled()
  })

  // 목차는 **같은 화면 안의 이동**이다. 스택이 움직이면 안 되므로 `setParams` 다.
  it('목차를 누르면 파라미터만 갈아 끼우고 화면은 그대로다', async () => {
    const view = await renderOverlay(<SettingsFeatureGuideScreen />)

    await press(climbTo(view, '난이도마다 따로 기억됩니다', 'button'))

    expect(setParams).toHaveBeenCalledWith({ guideId: '파티-모달', section: 'difficulty' })
    expect(navigate).not.toHaveBeenCalled()
    expect(view.getByText('파티 인원 관리')).toBeTruthy()
  })

  // 안내 화면에서 이미지는 정보를 나른다. 대체 텍스트가 곧 그 정보다.
  it('이미지를 대체 텍스트와 함께 그린다', async () => {
    const view = await renderOverlay(<SettingsFeatureGuideScreen />)

    expect(view.getByLabelText('보스 카드를 탭해 연 파티 모달').props.source).toBe(1)
    expect(view.getByLabelText('난이도 세그먼트')).toBeTruthy()
  })

  // 웹은 `w-full` 한 줄이었다. 높이는 preflight 의 `img { height: auto }` 가 정했다. RN 에 그
  // 짝이 없어 **높이를 이름 부르지 않으면** 스크린샷의 고유 픽셀 높이가 상자 높이로 남고,
  // `contain` 이 그 안에 그림을 넣어 **위아래로 큰 여백**이 생긴다(746×274 안내는 각 71px, 세로로
  // 긴 780×1438 안내는 각 389px. 보고 ②).
  it('이미지는 폭을 채우고 높이를 그림에 맡긴다. 두 축의 이름이 다 나온다', async () => {
    const view = await renderOverlay(<SettingsFeatureGuideScreen />)

    const style = flattenStyle(view.getByLabelText('보스 카드를 탭해 연 파티 모달').props.style)

    expect(style.width).toBe('100%')
    expect(Object.keys(style)).toContain('height')
    expect(style.height).toBeUndefined()
    expect(style.aspectRatio).toBeDefined()
  })

  it('문단만 있는 블록에는 이미지를 만들지 않는다', async () => {
    setGuides([
      {
        id: '파티-모달',
        title: '글만 있는 안내',
        groups: ['settings'],
        sections: [{ id: 'only', title: '마디', blocks: [{ text: '설명 한 줄' }] }],
      },
    ])
    const view = await renderOverlay(<SettingsFeatureGuideScreen />)

    expect(view.getByText('설명 한 줄')).toBeTruthy()
    expect(view.queryAllByRole('image')).toHaveLength(0)
  })

  // 옛 링크·오타의 착지점이 빈 화면이면 안 된다. 히스토리를 남기지 않고 들어온 목록으로 돌린다.
  it('없는 guideId 로 들어오면 아무것도 그리지 않고 되돌린다', async () => {
    mockRoute = { name: 'SettingsFeatureGuide', params: { guideId: '없는-안내' } }
    const view = await renderOverlay(<SettingsFeatureGuideScreen />)

    expect(goBack).toHaveBeenCalledTimes(1)
    expect(view.queryAllByTestId('guide-block')).toHaveLength(0)
  })
})
