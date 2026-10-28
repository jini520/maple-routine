// 이 화면이 지키는 것을 적는다.
//
// 갈린 것 셋
// ① `aria-pressed` → **`aria-selected` → `accessibilityState.selected`.** RN 접근성 상태에
//    *pressed* 가 없어 컴포넌트가 이미 `aria-selected` 로 갈아탔다(온보딩 선택 카드와 같은 자리).
// ② 칸을 **`aria-label` 로 잡는다**. 자식 글자에서 접근성 이름이 안 계산되므로
//    합쳐 주지 않아 컴포넌트가 라벨을 명시로 준다.
// ③ `toHaveStyle({ background })` → 컴파일된 스타일에서 `backgroundColor` 를 본다. **기대값은
//  손으로 적지 않고 `job-themes.json`(= `getThemeDefinition`)에서 읽는다**.
//
// **테마 이름을 손으로 나열하지 않는다**. 목록도 카테고리 순서도
// 레지스트리에서 온다. 그래야 테마가 늘어도 이 파일이 함께 커지지 않는다.
import { act, fireEvent, within } from '@testing-library/react-native'

import { THEME_NAMES, getThemeDefinition, groupThemesByCategory } from '../../../lib/theme/theme-registry'
import type { ThemeName } from '../../../types/theme'

import { flattenStyle, renderAtom, type AtomElement } from '../../../components/__tests__/render-atom'
import { ThemeSelector } from '../ThemeSelector'

type Rendered = Awaited<ReturnType<typeof renderAtom>>

/** 누르고 다시 그려질 때까지 기다린다(`CacheClearConfirm` 테스트). */
async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

function isSelected(view: Rendered, label: string): boolean | undefined {
  return view.getByLabelText(label).props.accessibilityState?.selected
}

function headingsOf(view: Rendered): unknown[] {
  return view.getAllByTestId('theme-category-heading').map((node) => node.props.children)
}

const 라이트테마 = THEME_NAMES.filter((name) => getThemeDefinition(name).mode === 'light')
const 다크테마 = THEME_NAMES.filter((name) => getThemeDefinition(name).mode === 'dark')

function 첫테마(names: readonly ThemeName[]): ThemeName {
  const name = names[0]
  if (name === undefined) throw new Error('테마가 없다')
  return name
}

describe('ThemeSelector: 선택 계약', () => {
  it.each(THEME_NAMES)('고른 테마가 %s면 그 칸만 선택된 상태다', async (current) => {
    const view = await renderAtom(<ThemeSelector theme={current} mode={null} onSelect={jest.fn()} />)

    for (const name of THEME_NAMES) {
      expect(isSelected(view, name)).toBe(name === current)
    }
  })

  it.each(THEME_NAMES)('%s 칸을 누르면 그 이름으로 onSelect가 호출된다', async (name) => {
    const onSelect = jest.fn()
    const view = await renderAtom(<ThemeSelector theme={첫테마(THEME_NAMES)} mode={null} onSelect={onSelect} />)

    await press(view.getByLabelText(name))

    expect(onSelect).toHaveBeenCalledWith(name)
  })
})

describe('ThemeSelector: 분류 카드', () => {
  // 순서는 데이터(JSON 키 순서)가 아니라 레지스트리 상수가 정한다. 카테고리 순서는 프로덕트
  // 결정이라 JSON 에 두지 않았다.
  it('분류 제목이 레지스트리가 정한 순서로 나온다', async () => {
    const view = await renderAtom(<ThemeSelector theme={첫테마(THEME_NAMES)} mode={null} onSelect={jest.fn()} />)

    expect(headingsOf(view)).toEqual(groupThemesByCategory(THEME_NAMES).map((group) => group.category))
  })

  it('모드를 주면 그 모드의 테마만 남는다', async () => {
    const view = await renderAtom(<ThemeSelector theme={첫테마(THEME_NAMES)} mode="dark" onSelect={jest.fn()} />)

    for (const name of 다크테마) expect(view.getByLabelText(name)).toBeTruthy()
    for (const name of 라이트테마) expect(view.queryByLabelText(name)).toBeNull()
  })

  // 거른 결과가 0인 분류는 제목째 감춘다(개발 노트의 카테고리 묶음과 같은 규칙).
  it.each(['light', 'dark'] as const)('%s 로 걸러 남는 것이 없는 분류는 제목도 사라진다', async (mode) => {
    const view = await renderAtom(<ThemeSelector theme={첫테마(THEME_NAMES)} mode={mode} onSelect={jest.fn()} />)

    expect(headingsOf(view)).toEqual(
      groupThemesByCategory(mode === 'dark' ? 다크테마 : 라이트테마).map((group) => group.category),
    )
  })
})

describe('ThemeSelector: 칸', () => {
  // 다른 테마의 색을 미리 보여주는 것이 이 칸의 일이라, 색이 **지금 테마의 토큰이 아니라
  // 레지스트리에서 직접** 와야 한다.
  it.each(THEME_NAMES)('%s 칸의 작은 화면이 그 테마의 배경색으로 칠해진다', async (name) => {
    const view = await renderAtom(<ThemeSelector theme={첫테마(THEME_NAMES)} mode={null} onSelect={jest.fn()} />)

    const preview = within(view.getByLabelText(name)).getByTestId('theme-tile-preview')
    expect(flattenStyle(preview.props.style).backgroundColor).toBe(getThemeDefinition(name).bg)
  })

  it.each(THEME_NAMES)('%s 칸의 그림 아이콘은 배경 그림이 있는 테마에만 붙는다', async (name) => {
    const view = await renderAtom(<ThemeSelector theme={첫테마(THEME_NAMES)} mode={null} onSelect={jest.fn()} />)

    // 아이콘은 낭독기에서 숨긴 장식이라 숨긴 요소까지 찾는다.
    const mark = within(view.getByLabelText(name)).queryByTestId('theme-tile-backdrop-mark', {
      includeHiddenElements: true,
    })
    expect(mark !== null).toBe(getThemeDefinition(name).background !== undefined)
  })

  // 앱 `dim` 은 전체 화면용이라 작은 칸에 덮으면 검은 띠가 된다. 그림은 아이콘으로만 알린다.
  it('배경 그림을 목록에서 읽지 않는다', async () => {
    const view = await renderAtom(<ThemeSelector theme={첫테마(THEME_NAMES)} mode={null} onSelect={jest.fn()} />)

    expect(view.queryAllByRole('image')).toHaveLength(0)
  })

  it.each(THEME_NAMES)('%s 칸에 테두리가 없다', async (name) => {
    const view = await renderAtom(<ThemeSelector theme={name} mode={null} onSelect={jest.fn()} />)

    expect(flattenStyle(view.getByLabelText(name).props.style).borderWidth ?? 0).toBe(0)
  })
})

// ★ 회귀 가드. **한 줄에 둘**.
//
// 칸에 `w-[calc(50%-5px)]` 를 주면 NativeWind 가 그 `calc` 를 안 만들어 폭이 통째로 빠지고,
// 칸이 글자 길이대로 늘어나 한 줄에 셋이 서기도 한다. 에러도 경고도 없다. 조용히 안 먹는
// 스타일 부류다.
//
// 그래서 **둘씩 선다** 를 **셀의 폭**으로 고정한다. 값이 `50%` 라는 것이 곧 2열이라는 뜻이고,
// 퍼센트 하나뿐이라 NativeWind 가 그대로 내보낸다.
describe('ThemeSelector: 2열 배치', () => {
  it('칸은 감싸는 셀이 절반 폭을 정한다. 글자 길이가 폭을 정하지 않는다', async () => {
    const { getByLabelText } = await renderAtom(<ThemeSelector theme={THEME_NAMES[0]} mode={null} onSelect={() => {}} />)

    // 이름이 가장 긴 테마와 가장 짧은 테마가 **같은 폭**이어야 한다.
    const byLength = [...THEME_NAMES].sort((a, b) => a.length - b.length)
    for (const name of [byLength[0], byLength[byLength.length - 1]]) {
      const cell = (getByLabelText(name) as AtomElement).parent
      expect(flattenStyle(cell?.props.style).width).toBe('50%')
    }
  })
})
