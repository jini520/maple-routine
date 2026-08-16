// 레일과 초상화의 계약([[ADR-142]]).
//
// **여기서 볼 수 없는 것이 있다** — 곡선 글자가 실제로 어떻게 휘는지, 링 두 겹이 눈에 구분되는지는
// 렌더 트리에 안 나온다(jest 에는 레이아웃도 폰트도 없다). 그래서 이 파일이 보는 것은 «무엇을
// 그렸는가» 와 «무엇을 눌렀을 때 무엇이 불리는가» 이고, 나머지는 실기기 몫이다(ADR «미검증»).
import { act, fireEvent } from '@testing-library/react-native'

import { renderAtom, type AtomElement } from '../../../__tests__/render-atom'
import { CharacterRail, type CharacterRailEntry } from '../CharacterRail'
import { portraitRingSpan } from '../character-portrait-geometry'

function entry(overrides: Partial<CharacterRailEntry> = {}): CharacterRailEntry {
  return {
    ocid: 'ocid-1',
    characterName: '내옆에최성일',
    level: 285,
    imageUrl: 'https://open.api.nexon.com/character/1.png',
    rings: [
      { label: '일간', completed: 3, total: 7 },
      { label: '주간', completed: 1, total: 5 },
    ],
    ...overrides,
  }
}

// `renderAtom` 은 **await 해야 한다** — NativeWind 배선이 렌더를 비동기로 감싼다(이 저장소의 모든
// 컴포넌트 테스트가 같은 모양이다).
async function render(
  entries: CharacterRailEntry[],
  selectedOcid = 'ocid-1',
): Promise<Awaited<ReturnType<typeof renderAtom>>> {
  return renderAtom(<CharacterRail entries={entries} selectedOcid={selectedOcid} onSelect={onSelect} />)
}

/**
 * SVG 글자의 내용은 **글자 노드가 아니라 `RNSVGTSpan` 의 프롭**으로 들어간다 — `getByText` 로는
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
 * `Text` 아래의 `TextPath` 노드 — `startOffset`·`href` 는 여기 붙는다.
 *
 * **`textAnchor` 는 여기 없다.** `react-native-svg` 가 그것을 `Text` 의 `font` 객체로 접어 넣는다
 * (실측 — `TextPath` 에 주면 조용히 버려진다). 그래서 아래 케이스가 둘을 다른 노드에서 읽는다.
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

/** 글자 모양(크기·굵기·색) — 자리(`textAnchor`)는 빼고 본다. */
function textStyleOf(node: AtomElement): { fontSize: unknown; fontWeight: unknown; fill: unknown } {
  const font = node.props.font as { fontSize?: unknown; fontWeight?: unknown }
  return { fontSize: font.fontSize, fontWeight: font.fontWeight, fill: node.props.fill }
}

const onSelect = jest.fn()

beforeEach(() => {
  onSelect.mockClear()
})

describe('CharacterRail', () => {
  it('추적 캐릭터마다 초상화를 하나씩 그린다', async () => {
    const view = await render([entry(), entry({ ocid: 'ocid-2', characterName: '두번째' })])

    expect(view.getAllByTestId('character-portrait')).toHaveLength(2)
  })

  // 드롭다운이 못 채운 계약 — 누르면 실제로 바뀐다.
  it('초상화를 누르면 그 캐릭터의 ocid 로 onSelect 를 부른다', async () => {
    const view = await render([entry(), entry({ ocid: 'ocid-2', characterName: '두번째' })])

    // `act` 는 **await 해야 한다** — 안 하면 다음 테스트의 렌더까지 스코프가 섞여 트리가 비어 보인다
    // (실측: 뒤따르는 케이스 전부가 «요소를 못 찾음» 으로 무너졌다).
    await act(async () => {
      fireEvent.press(view.getAllByTestId('character-portrait')[1])
    })

    expect(onSelect).toHaveBeenCalledWith('ocid-2')
  })

  // 결정 5: 테두리는 진행률이 이미 쓰고 있어 선택은 흐림으로 말한다. 색만으로는 안 전달되므로
  // `aria-selected` 를 함께 둔다.
  it('고른 칸만 또렷하고 나머지는 흐리다', async () => {
    const view = await render([entry(), entry({ ocid: 'ocid-2', characterName: '두번째' })])

    const [selected, dimmed] = view.getAllByTestId('character-portrait')
    expect(selected.props.style.opacity).toBe(1)
    expect(dimmed.props.style.opacity).toBeLessThan(1)
    // `Pressable` 은 `aria-selected` 를 호스트 프롭으로 그대로 넘기지 않고 `accessibilityState` 에
    // 접어 넣는다(`CharacterTrackingPicker` 테스트가 먼저 실측한 자리).
    expect(selected.props.accessibilityState.selected).toBe(true)
    expect(dimmed.props.accessibilityState.selected).toBe(false)
  })

  it('가로로 굴러가고 스크롤바를 그리지 않는다', async () => {
    const view = await render([entry()])

    const scroll = view.getByTestId('character-rail-scroll')
    expect(scroll.props.horizontal).toBe(true)
    expect(scroll.props.showsHorizontalScrollIndicator).toBe(false)
  })
})

describe('CharacterPortrait', () => {
  // 정정 1·2·4·5: 둘 다 **아래**에 있고, **호 하나**(같은 `Path`)를 나눠 쓰며, 가운데에 맞추는 것은
  // 줄이 아니라 **둘의 경계**다 — 레벨이 6시에서 끝나고 이름이 6시에서 시작한다.
  it('레벨과 이름이 한 호를 쓰고 원 중앙을 경계로 좌·우로 갈린다', async () => {
    const view = await render([entry()])

    expect(svgTextContent(view.getByTestId('portrait-level-text'))).toBe('Lv.285')
    expect(svgTextContent(view.getByTestId('portrait-name-text'))).toBe('내옆에최성일')

    // 「호 하나」의 증거 — 둘이 **같은 path** 를 가리킨다(정정 2).
    const [levelPath, namePath] = [
      textPathOf(view.getByTestId('portrait-level-text')),
      textPathOf(view.getByTestId('portrait-name-text')),
    ]
    expect(levelPath.props.href).toBe(namePath.props.href)

    // 왼쪽이 레벨(끝이 가운데) · 오른쪽이 이름(시작이 가운데). 줄 전체를 `middle` 로 앉히면
    // 이름이 더 길어 글자가 통째로 오른쪽으로 치우친다.
    expect(textAnchorOf(view.getByTestId('portrait-level-text'))).toBe('end')
    expect(textAnchorOf(view.getByTestId('portrait-name-text'))).toBe('start')
    expect(Number.parseFloat(levelPath.props.startOffset as string)).toBeLessThan(50)
    expect(Number.parseFloat(namePath.props.startOffset as string)).toBeGreaterThan(50)
  })

  // 정정 6(사용자 지시): 레벨을 «부가 정보» 로 보고 작고 흐리게 뒀던 것을 되돌린다 — 요청한 적
  // 없는 차이였고 눈에 띄었다. 이제 둘을 가르는 것은 **자리뿐**이다.
  it('레벨과 이름이 크기·굵기·색까지 같은 글자다', async () => {
    const view = await render([entry()])

    expect(textStyleOf(view.getByTestId('portrait-level-text'))).toEqual(
      textStyleOf(view.getByTestId('portrait-name-text')),
    )
  })

  // 치우칠 상대가 없으면 줄을 가운데에 앉힌다.
  it('레벨을 모르면 이름을 원 중앙에 맞춘다', async () => {
    const view = await render([entry({ level: null })])

    expect(textAnchorOf(view.getByTestId('portrait-name-text'))).toBe('middle')
    expect(textPathOf(view.getByTestId('portrait-name-text')).props.startOffset).toBe('50%')
  })

  // 모르는 것을 아는 척하지 않는다 — `Lv.-` 를 그리지 않는다([[ADR-101]] 결정 1과 같은 태도).
  it('레벨을 모르면 레벨 글자를 비운다', async () => {
    const view = await render([entry({ level: null })])

    expect(view.queryByTestId('portrait-level-text')).toBeNull()
    expect(svgTextContent(view.getByTestId('portrait-name-text'))).toBe('내옆에최성일')
  })

  it('초상화가 없으면 이름 첫 글자를 둔다', async () => {
    const view = await render([entry({ imageUrl: null })])

    expect(view.queryByTestId('character-portrait-image')).toBeNull()
    expect(view.getByText('내')).toBeTruthy()
  })

  // 정정 1: 링 둘을 받으면 **좌·우 반원**이다(컨텐츠 스케줄러).
  it('링을 둘 받으면 반원 둘을 트랙과 함께 그린다', async () => {
    const view = await render([entry()])

    expect(view.getAllByTestId('portrait-ring-track')).toHaveLength(2)
    expect(view.getAllByTestId('portrait-ring-fill')).toHaveLength(2)
  })

  // 정정 1: 하나만 받으면 **온전한 원**이다(보스 스케줄러 — 월간은 링에서 뺐다).
  it('링을 하나만 받으면 온전한 원 하나만 그린다', async () => {
    const view = await render([entry({ rings: [{ label: '주간', completed: 2, total: 12 }] })])

    expect(view.getAllByTestId('portrait-ring-track')).toHaveLength(1)
    expect(view.getAllByTestId('portrait-ring-fill')).toHaveLength(1)
    expect(view.getByTestId('character-portrait').props.accessibilityLabel).toContain('주간 2/12')
  })

  // 정정 8: 관리 화면은 진행을 안 그린다 — 링이 통째로 없고 글자만 남는다.
  it('링을 안 받으면 링을 아예 안 그리고 글자만 남는다', async () => {
    const view = await render([entry({ rings: [] })])

    expect(view.queryAllByTestId('portrait-ring-track')).toHaveLength(0)
    expect(view.queryAllByTestId('portrait-ring-fill')).toHaveLength(0)
    expect(svgTextContent(view.getByTestId('portrait-name-text'))).toBe('내옆에최성일')
    expect(svgTextContent(view.getByTestId('portrait-level-text'))).toBe('Lv.285')
    // 읽어 줄 진행이 없으니 접근성 이름도 이름·레벨에서 끝난다.
    expect(view.getByTestId('character-portrait').props.accessibilityLabel).toBe('Lv.285 내옆에최성일')
  })

  // 반원은 **12시에서 시작해 서로 반대로** 돈다 — 시작점이 같아야 둘을 나란히 읽는다.
  it('두 반원이 12시에서 갈라져 반대 방향으로 찬다', async () => {
    const view = await render([
      entry({
        rings: [
          { label: '일간', completed: 1, total: 2 },
          { label: '주간', completed: 1, total: 2 },
        ],
      }),
    ])

    const [leftFill, rightFill] = view.getAllByTestId('portrait-ring-fill')
    // 왼쪽 반원은 반시계(sweep 0), 오른쪽은 시계(sweep 1).
    expect(leftFill.props.d).toContain(' 0 0 0 ')
    expect(rightFill.props.d).toContain(' 0 0 1 ')
    // 둘 다 같은 점(12시 옆)에서 시작한다.
    const startOf = (d: string): string => d.split(' A ')[0]
    expect(startOf(leftFill.props.d as string)).not.toBe(startOf(rightFill.props.d as string))
    expect(portraitRingSpan('left').from).toBe(-portraitRingSpan('right').from)
  })

  // 0/0을 100%로 읽으면 아직 아무것도 없는 캐릭터가 다 찬 것처럼 보인다.
  it('셀 것이 없으면 채운 호를 아예 안 그린다', async () => {
    const view = await render([
      entry({
        rings: [
          { label: '일간', completed: 0, total: 0 },
          { label: '주간', completed: 0, total: 0 },
        ],
      }),
    ])

    expect(view.getAllByTestId('portrait-ring-track')).toHaveLength(2)
    expect(view.queryAllByTestId('portrait-ring-fill')).toHaveLength(0)
  })

  it('접근성 이름이 레벨과 두 링의 진행을 함께 말한다', async () => {
    const view = await render([entry()])

    expect(view.getByTestId('character-portrait').props.accessibilityLabel).toBe(
      'Lv.285 내옆에최성일, 일간 3/7 · 주간 1/5',
    )
  })
})
