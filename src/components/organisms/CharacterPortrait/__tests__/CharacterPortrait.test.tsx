// 초상화 한 칸의 계약.
//
// **여기서 볼 수 없는 것이 있다.** 곡선 글자가 실제로 어떻게 휘는지, 링 두 겹이 눈에 구분되는지는
// 렌더 트리에 안 나온다(jest 에는 레이아웃도 폰트도 없다). 이 파일이 보는 것은 무엇을 그렸는가와
// 무엇을 눌렀을 때 무엇이 불리는가이고, 나머지는 실기기 몫이다.
import { processColor } from 'react-native'
import { act, fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderAtom, 기본테마, type AtomElement } from '../../../__tests__/render-atom'
import { CharacterPortrait, type RailPortraitProps } from '../CharacterPortrait'
import { portraitRingSpan } from '../portrait-arc'
import { PORTRAIT_RAIL } from '../portrait-metrics'

const onPress = jest.fn()

beforeEach(() => {
  onPress.mockClear()
})

function railProps(overrides: Partial<RailPortraitProps> = {}): RailPortraitProps {
  return {
    variant: 'rail',
    ocid: 'ocid-1',
    characterName: '내옆에최성일',
    level: 285,
    imageUrl: 'https://open.api.nexon.com/character/1.png',
    rings: [
      { label: '일간', completed: 3, total: 7 },
      { label: '주간', completed: 1, total: 5 },
    ],
    isSelected: true,
    onPress,
    ...overrides,
  }
}

// `renderAtom` 은 **await 해야 한다**. NativeWind 배선이 렌더를 비동기로 감싼다.
async function rail(
  overrides: Partial<RailPortraitProps> = {},
): Promise<Awaited<ReturnType<typeof renderAtom>>> {
  return renderAtom(<CharacterPortrait {...railProps(overrides)} />)
}

/**
 * SVG 글자의 내용은 **글자 노드가 아니라 `RNSVGTSpan` 의 프롭**으로 들어간다. `getByText` 로는
 * 안 잡힌다(실측). 곡선 글자를 쓰는 대가이고, 그래서 여기서 직접 판다.
 */
function svgTextContent(node: AtomElement): string {
  const parts: string[] = []
  const walk = (current: AtomElement): void => {
    if (typeof current.props.content === 'string') parts.push(current.props.content)
    for (const child of current.children) if (typeof child !== 'string') walk(child)
  }
  walk(node)
  if (parts.length === 0) throw new Error('SVG 글자 내용을 못 찾았다')
  return parts.join('')
}

/**
 * `Text` 아래의 `TextPath` 노드. `startOffset`·`href` 는 여기 붙는다.
 *
 * **`textAnchor` 는 여기 없다.** `react-native-svg` 가 그것을 `Text` 의 `font` 객체로 접어 넣는다
 * (실측. `TextPath` 에 주면 조용히 버려진다). 그래서 아래 케이스가 둘을 다른 노드에서 읽는다.
 */
function textPathOf(node: AtomElement): AtomElement {
  const found = node.children.find(
    (child): child is AtomElement => typeof child !== 'string' && child.props.href !== undefined,
  )
  if (found === undefined) throw new Error('TextPath 를 못 찾았다')
  return found
}

function textAnchorOf(node: AtomElement): unknown {
  return (node.props.font as { textAnchor?: unknown }).textAnchor
}

/** 글자 모양(크기·굵기·색). 자리(`textAnchor`)는 빼고 본다. */
function textStyleOf(node: AtomElement): { fontSize: unknown; fontWeight: unknown; fill: unknown } {
  const font = node.props.font as { fontSize?: unknown; fontWeight?: unknown }
  return { fontSize: font.fontSize, fontWeight: font.fontWeight, fill: node.props.fill }
}

describe('CharacterPortrait · rail 규격의 곡선 글자', () => {
  // 정정 1·2·4·5: 둘 다 **아래**에 있고, **호 하나**(같은 `Path`)를 나눠 쓰며, 가운데에 맞추는 것은
  // 줄이 아니라 **둘의 경계**다. 레벨이 6시에서 끝나고 이름이 6시에서 시작한다.
  it('레벨과 이름이 한 호를 쓰고 원 중앙을 경계로 좌·우로 갈린다', async () => {
    const view = await rail()

    expect(svgTextContent(view.getByTestId('portrait-level-text'))).toBe('Lv.285')
    expect(svgTextContent(view.getByTestId('portrait-name-text'))).toBe('내옆에최성일')

    // `호 하나`의 증거. 둘이 **같은 path** 를 가리킨다(정정 2).
    const [levelPath, namePath] = [
      textPathOf(view.getByTestId('portrait-level-text')),
      textPathOf(view.getByTestId('portrait-name-text')),
    ]
    expect(levelPath.props.href).toBe(namePath.props.href)

    expect(textAnchorOf(view.getByTestId('portrait-level-text'))).toBe('end')
    expect(textAnchorOf(view.getByTestId('portrait-name-text'))).toBe('start')
    expect(Number.parseFloat(levelPath.props.startOffset as string)).toBeLessThan(50)
    expect(Number.parseFloat(namePath.props.startOffset as string)).toBeGreaterThan(50)
  })

  // 정정 6(사용자 지시): 레벨을 부가 정보로 보고 작고 흐리게 뒀던 것을 되돌린다. 요청한 적 없는
  // 차이였고 눈에 띄었다. 이제 둘을 가르는 것은 **자리뿐**이다.
  it('레벨과 이름이 크기·굵기·색까지 같은 글자다', async () => {
    const view = await rail()

    expect(textStyleOf(view.getByTestId('portrait-level-text'))).toEqual(
      textStyleOf(view.getByTestId('portrait-name-text')),
    )
  })

  it('레벨을 모르면 이름을 원 중앙에 맞춘다', async () => {
    const view = await rail({ level: null })

    expect(textAnchorOf(view.getByTestId('portrait-name-text'))).toBe('middle')
    expect(textPathOf(view.getByTestId('portrait-name-text')).props.startOffset).toBe('50%')
  })

  // 모르는 것을 아는 척하지 않는다. `Lv.-` 를 그리지 않는다.
  it('레벨을 모르면 레벨 글자를 비운다', async () => {
    const view = await rail({ level: null })

    expect(view.queryByTestId('portrait-level-text')).toBeNull()
    expect(svgTextContent(view.getByTestId('portrait-name-text'))).toBe('내옆에최성일')
  })

  // 호의 id 가 화면 안에서 겹치면 둘 중 하나가 엉뚱한 호를 따라간다. 레일에 여러 벌이 뜬다.
  // `react-native-svg` 가 `#` 을 떼고 이름만 들고 있다(실측).
  it('호의 id 에 ocid 가 들어간다', async () => {
    const view = await rail({ ocid: 'ocid-9' })

    expect(textPathOf(view.getByTestId('portrait-name-text')).props.href).toBe('portrait-text-ocid-9')
  })
})

describe('CharacterPortrait · rail 규격의 호 링', () => {
  // 정정 1: 링 둘을 받으면 **좌·우 반원**이다(컨텐츠 스케줄러).
  it('링을 둘 받으면 반원 둘을 트랙과 함께 그린다', async () => {
    const view = await rail()

    expect(view.getAllByTestId('portrait-ring-track')).toHaveLength(2)
    expect(view.getAllByTestId('portrait-ring-fill')).toHaveLength(2)
  })

  // 정정 1: 하나만 받으면 **온전한 원**이다(보스 스케줄러. 월간은 링에서 뺐다).
  it('링을 하나만 받으면 온전한 원 하나만 그린다', async () => {
    const view = await rail({ rings: [{ label: '주간', completed: 2, total: 12 }] })

    expect(view.getAllByTestId('portrait-ring-track')).toHaveLength(1)
    expect(view.getAllByTestId('portrait-ring-fill')).toHaveLength(1)
    expect(view.getByTestId('character-portrait').props.accessibilityLabel).toContain('주간 2/12')
  })

  // 정정 8: 관리 화면은 진행을 안 그린다. 링이 통째로 없고 글자만 남는다.
  it('링을 안 받으면 호 링을 아예 안 그리고 글자만 남는다', async () => {
    const view = await rail({ rings: [] })

    expect(view.queryAllByTestId('portrait-ring-track')).toHaveLength(0)
    expect(view.queryAllByTestId('portrait-ring-fill')).toHaveLength(0)
    expect(svgTextContent(view.getByTestId('portrait-name-text'))).toBe('내옆에최성일')
    expect(view.getByTestId('character-portrait').props.accessibilityLabel).toBe('Lv.285 내옆에최성일')
  })

  // 반원은 **12시에서 시작해 서로 반대로** 돈다. 시작점이 같아야 둘을 나란히 읽는다.
  it('두 반원이 12시에서 갈라져 반대 방향으로 찬다', async () => {
    const view = await rail({
      rings: [
        { label: '일간', completed: 1, total: 2 },
        { label: '주간', completed: 1, total: 2 },
      ],
    })

    const [leftFill, rightFill] = view.getAllByTestId('portrait-ring-fill')
    // 왼쪽 반원은 반시계(sweep 0), 오른쪽은 시계(sweep 1).
    expect(leftFill.props.d).toContain(' 0 0 0 ')
    expect(rightFill.props.d).toContain(' 0 0 1 ')
    const startOf = (d: string): string => d.split(' A ')[0]
    expect(startOf(leftFill.props.d as string)).not.toBe(startOf(rightFill.props.d as string))
    expect(portraitRingSpan('left').from).toBe(-portraitRingSpan('right').from)
  })

  // 0/0을 100%로 읽으면 아직 아무것도 없는 캐릭터가 다 찬 것처럼 보인다.
  it('셀 것이 없으면 채운 호를 아예 안 그린다', async () => {
    const view = await rail({
      rings: [
        { label: '일간', completed: 0, total: 0 },
        { label: '주간', completed: 0, total: 0 },
      ],
    })

    expect(view.getAllByTestId('portrait-ring-track')).toHaveLength(2)
    expect(view.queryAllByTestId('portrait-ring-fill')).toHaveLength(0)
  })
})

describe('CharacterPortrait · rail 규격의 빈 링', () => {
  // 얼굴 둘레 테두리는 없앴다. 진행 링을 그리는 화면에서
  // 그 선은 얼굴을 한 겹 더 두르는 군더더기였고, 필요했던 자리는 링이 없는 관리 화면이다.
  it('얼굴 둘레 테두리는 어디에도 없다', async () => {
    const view = await rail()

    expect(view.queryAllByTestId('portrait-selected-ring')).toHaveLength(0)
  })

  it('링을 안 그리면 링 자리에 빈 링이 선다', async () => {
    const view = await rail({ rings: [] })

    expect(view.getAllByTestId('portrait-empty-ring')).toHaveLength(1)
  })

  it('빈 링은 진행 링과 같은 반지름에 서고 더 얇다', async () => {
    const view = await rail({ rings: [] })

    const rim = view.getByTestId('portrait-empty-ring')
    expect(Number(rim.props.r)).toBe(PORTRAIT_RAIL.ringR)
    expect(Number(rim.props.strokeWidth)).toBeLessThan(PORTRAIT_RAIL.ringStroke)
  })

  // 흐림 말고도 칸 하나만 보고 읽히는 절대 신호가 남아야 한다.
  it('고른 칸의 빈 링만 강조색이다', async () => {
    const selected = await rail({ rings: [], isSelected: true })
    const dimmed = await rail({ rings: [], isSelected: false })

    expect(selected.getByTestId('portrait-empty-ring').props.stroke.payload).toBe(
      processColor(기본테마.primary),
    )
    expect(dimmed.getByTestId('portrait-empty-ring').props.stroke.payload).toBe(
      processColor(기본테마.border),
    )
  })

  // 링이 있으면 그 자리는 이미 찼다. 겹쳐 그리면 트랙이 두 겹이 된다.
  it('진행 링을 그리는 칸에는 빈 링이 없다', async () => {
    const view = await rail({ rings: [{ label: '주간', completed: 1, total: 5 }] })

    expect(view.queryAllByTestId('portrait-empty-ring')).toHaveLength(0)
  })
})

describe('CharacterPortrait · rail 규격의 얼굴과 선택', () => {
  // 얼굴 뒤 회색 판을 걷는다. 캐릭터 이미지가 투명 배경이라 그 회색이 그림
  // 뒤로 비쳤다. **머리글자 폴백에는 남긴다.** 거기서는 글자가 앉을 바탕이다.
  it('이미지가 있는 칸의 얼굴 상자에는 배경색이 없다', async () => {
    const view = await rail()

    expect(flattenStyle(view.getByTestId('portrait-face').props.style).backgroundColor).toBeUndefined()
  })

  it('이미지가 없으면 머리글자 뒤에 바탕이 남는다', async () => {
    const view = await rail({ imageUrl: null })

    expect(view.queryByTestId('character-portrait-image')).toBeNull()
    expect(view.getByText('내')).toBeTruthy()
    expect(
      flattenStyle(view.getByTestId('portrait-face-fallback').props.style).backgroundColor,
    ).toBeDefined()
  })

  // 세기를 0.45 에서 0.3 으로 올렸다. 칸이 여섯을 넘게 늘어서면 0.45 로는
  // 어느 것이 선택인지 한눈에 안 잡혔다. 레이아웃은 전혀 안 움직인다.
  it('고른 칸은 또렷하고 안 고른 칸은 0.3 으로 흐리다', async () => {
    const selected = await rail({ isSelected: true })
    const dimmed = await rail({ isSelected: false })

    expect(selected.getByTestId('character-portrait').props.style.opacity).toBe(1)
    expect(dimmed.getByTestId('character-portrait').props.style.opacity).toBe(0.3)
    // `Pressable` 은 `aria-selected` 를 호스트 프롭으로 안 넘기고 `accessibilityState` 에 접어 넣는다.
    expect(selected.getByTestId('character-portrait').props.accessibilityState.selected).toBe(true)
    expect(dimmed.getByTestId('character-portrait').props.accessibilityState.selected).toBe(false)
  })

  it('누르면 onPress 를 부른다', async () => {
    const view = await rail()

    // `act` 는 **await 해야 한다**. 안 하면 다음 테스트의 렌더까지 스코프가 섞여 트리가 비어 보인다.
    await act(async () => {
      fireEvent.press(view.getByTestId('character-portrait'))
    })

    expect(onPress).toHaveBeenCalledTimes(1)
  })
})

//  로 보스 수익의 아바타가 이 부품으로 들어왔다. 아래는 그 화면의 계약이고,
// 진행률을 나타내는 것이 링뿐이라(`n/12` 글자 보류) 접근성 이름이 곧 그
// 정보다.
describe('CharacterPortrait · compact 규격', () => {
  async function compact(
    clears: { cleared: number; total: number; label: string },
    imageUrl: string | null = 'https://example.test/face.png',
  ): Promise<Awaited<ReturnType<typeof renderAtom>>> {
    return renderAtom(
      <CharacterPortrait
        variant="compact"
        characterName="지내우시"
        imageUrl={imageUrl}
        clears={clears}
      />,
    )
  }

  it('주간은 12칸을 그리고 이름으로 진행률을 말한다', async () => {
    const view = await compact({ cleared: 3, total: 12, label: '주간' })

    expect(view.getByLabelText('주간 보스 처치 3 / 12')).toBeTruthy()
    expect(view.getAllByTestId('progress-ring-segment')).toHaveLength(12)
  })

  // 두 탭이 같은 부품을 쓴다. 주기를 고정하면 한쪽 탭에서 거짓이 된다.
  it('월간 탭이면 이름의 주기도 월간이다', async () => {
    const view = await compact({ cleared: 1, total: 1, label: '월간' })

    expect(view.getByLabelText('월간 보스 처치 1 / 1')).toBeTruthy()
  })

  // 찬 칸과 빈 칸이 **한 `<Svg>` 안에서 두 색**이라 `className` 이 아니라 테마에서 직접 읽는다.
  // 색을 손으로 적지 않고 테마 정의에서 가져와 견준다(규약).
  it('찬 칸은 primary, 빈 칸은 border 로 그린다', async () => {
    const view = await compact({ cleared: 2, total: 4, label: '주간' })
    // `react-native-svg` 가 색 문자열을 미리 파싱해 `{ type, payload }` 로 바꾼다. 그 payload 는
    // `processColor` 의 결과라 테마 값에서 같은 방법으로 만들어 견준다.
    const strokes = view.getAllByTestId('progress-ring-segment').map((n) => n.props.stroke.payload)

    expect(strokes).toEqual([
      processColor(기본테마.primary),
      processColor(기본테마.primary),
      processColor(기본테마.border),
      processColor(기본테마.border),
    ])
  })

  // 나눌 상대가 없는 링에서는 간격이 나눔이 아니라 결손으로 읽힌다.
  it('칸이 하나뿐이면 dash 를 걸지 않고 온전한 원으로 그린다', async () => {
    const view = await compact({ cleared: 1, total: 1, label: '월간' })
    const [circle] = view.getAllByTestId('progress-ring-segment')

    expect(circle.props.strokeDasharray).toBeUndefined()
    expect(circle.props.strokeDashoffset).toBeUndefined()
  })

  it('초상화가 있으면 원격 주소를 그대로 앉힌다', async () => {
    const view = await compact({ cleared: 0, total: 12, label: '주간' })

    // 원격 URI 라 `{ uri }` 로 감싼다(번들 에셋은 반대로 감싸면 안 뜬다).
    expect(view.getByTestId('character-portrait-image').props.source).toEqual({
      uri: 'https://example.test/face.png',
    })
  })

  it('초상화가 없으면 이름 첫 글자를 쓴다', async () => {
    const view = await compact({ cleared: 0, total: 12, label: '주간' }, null)

    expect(view.getByText('지')).toBeTruthy()
    expect(view.queryByTestId('character-portrait-image')).toBeNull()
  })

  // 곡선 글자는 rail 규격만의 것이다. 보스 수익 헤더는 이름을 옆에 평평하게 둔다.
  it('곡선 글자를 그리지 않는다', async () => {
    const view = await compact({ cleared: 0, total: 12, label: '주간' })

    expect(view.queryByTestId('portrait-name-text')).toBeNull()
    expect(view.queryByTestId('portrait-level-text')).toBeNull()
  })
})
