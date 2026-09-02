// 웹판(189줄)의 명세를 읽어 다시 쓴 것.
//
// 갈린 것 셋
// ① `aria-pressed` → **`aria-selected` → `accessibilityState.selected`.** RN 접근성 상태에
//    *pressed* 가 없어 컴포넌트가 이미 `aria-selected` 로 갈아탔다(온보딩 선택 카드와 같은 자리).
// ② 타일·칩을 **`aria-label` 로 잡는다**. 웹은 자식 글자에서 접근성 이름이 계산됐지만 RN 은
//    합쳐 주지 않아 컴포넌트가 라벨을 명시로 준다.
// ③ `toHaveStyle({ background })` → 컴파일된 스타일에서 `backgroundColor` 를 본다. **기대값은
//  손으로 적지 않고 `job-themes.json`(= `getThemeDefinition`)에서 읽는다**.
//
// **테마 이름을 손으로 나열하지 않는다**. 목록도 카테고리 순서도
// 레지스트리에서 온다. 그래야 테마가 늘어도 이 파일이 함께 커지지 않는다.
import { act, fireEvent } from '@testing-library/react-native'

import { THEME_NAMES, getThemeDefinition, groupThemesByCategory } from '../../../lib/theme/theme-registry'
import type { ThemeName } from '../../../types/theme'

import { flattenStyle, renderAtom, type AtomElement } from '../../../components/__tests__/render-atom'
import { ThemeSelector } from '../ThemeSelector'

type Rendered = Awaited<ReturnType<typeof renderAtom>>

/** 누르고 다시 그려질 때까지 기다린다(`CacheClearConfirm` 테스트 파일 머리 ③). */
async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

function isSelected(view: Rendered, label: string): boolean | undefined {
  return view.getByLabelText(label).props.accessibilityState?.selected
}

const 라이트테마 = THEME_NAMES.filter((name) => getThemeDefinition(name).mode === 'light')
const 다크테마 = THEME_NAMES.filter((name) => getThemeDefinition(name).mode === 'dark')

function 첫테마(names: readonly ThemeName[]): ThemeName {
  const name = names[0]
  if (name === undefined) throw new Error('테마가 없다')
  return name
}

describe('ThemeSelector — 선택 계약', () => {
  it.each(THEME_NAMES)('현재 테마가 %s면 그 타일만 선택된 상태다', async (current) => {
    const view = await renderAtom(<ThemeSelector theme={current} onSelect={jest.fn()} />)

    for (const name of THEME_NAMES) {
      expect(isSelected(view, name)).toBe(name === current)
    }
  })

  it.each(THEME_NAMES)('%s 타일을 누르면 그 이름으로 onSelect가 호출된다', async (name) => {
    const onSelect = jest.fn()
    const view = await renderAtom(
      <ThemeSelector theme={첫테마(THEME_NAMES)} onSelect={onSelect} />,
    )

    await press(view.getByLabelText(name))

    expect(onSelect).toHaveBeenCalledWith(name)
  })
})

describe('ThemeSelector — 카테고리 섹션', () => {
  it('등록된 모든 테마를 보여준다', async () => {
    const view = await renderAtom(
      <ThemeSelector theme={첫테마(THEME_NAMES)} onSelect={jest.fn()} />,
    )

    for (const name of THEME_NAMES) {
      expect(view.getByLabelText(name)).toBeTruthy()
    }
  })

  // 순서는 데이터(JSON 키 순서)가 아니라 레지스트리 상수가 정한다. 카테고리 순서는 프로덕트
  // 결정이라 JSON 에 두지 않았다.
  it('카테고리 헤더가 레지스트리가 정한 순서로 나온다', async () => {
    const view = await renderAtom(
      <ThemeSelector theme={첫테마(THEME_NAMES)} onSelect={jest.fn()} />,
    )

    expect(view.getAllByTestId('theme-category-heading').map((node) => node.props.children)).toEqual(
      groupThemesByCategory(THEME_NAMES).map((group) => group.category),
    )
  })
})

describe('ThemeSelector — 라이트·다크 필터', () => {
  it('기본값은 전체다', async () => {
    const view = await renderAtom(
      <ThemeSelector theme={첫테마(THEME_NAMES)} onSelect={jest.fn()} />,
    )

    expect(isSelected(view, '전체')).toBe(true)
    expect(view.getAllByLabelText(/./).length).toBeGreaterThan(0)
    for (const name of THEME_NAMES) expect(view.getByLabelText(name)).toBeTruthy()
  })

  it('다크를 누르면 라이트 테마가 목록에서 사라진다', async () => {
    const view = await renderAtom(
      <ThemeSelector theme={첫테마(THEME_NAMES)} onSelect={jest.fn()} />,
    )

    await press(view.getByLabelText('다크'))

    for (const name of 다크테마) expect(view.getByLabelText(name)).toBeTruthy()
    for (const name of 라이트테마) expect(view.queryByLabelText(name)).toBeNull()
  })

  it('라이트를 누르면 다크 테마가 목록에서 사라진다', async () => {
    const view = await renderAtom(
      <ThemeSelector theme={첫테마(THEME_NAMES)} onSelect={jest.fn()} />,
    )

    await press(view.getByLabelText('라이트'))

    for (const name of 라이트테마) expect(view.getByLabelText(name)).toBeTruthy()
    for (const name of 다크테마) expect(view.queryByLabelText(name)).toBeNull()
  })

  // 거른 결과가 0인 카테고리는 헤더째 감춘다(개발 노트의 카테고리 묶음과 같은 규칙).
  it('걸러낸 결과가 0인 카테고리는 헤더도 사라진다', async () => {
    const view = await renderAtom(
      <ThemeSelector theme={첫테마(THEME_NAMES)} onSelect={jest.fn()} />,
    )

    await press(view.getByLabelText('다크'))

    expect(view.getAllByTestId('theme-category-heading').map((node) => node.props.children)).toEqual(
      groupThemesByCategory(다크테마).map((group) => group.category),
    )
  })

  it('전체로 되돌리면 다시 다 보인다', async () => {
    const view = await renderAtom(
      <ThemeSelector theme={첫테마(THEME_NAMES)} onSelect={jest.fn()} />,
    )

    await press(view.getByLabelText('다크'))
    await press(view.getByLabelText('전체'))

    for (const name of THEME_NAMES) expect(view.getByLabelText(name)).toBeTruthy()
  })

  // 선택 테마가 필터에서 빠지는 것은 정상이다. 그래도 다른 테마는 고를 수 있다.
  it('현재 선택된 테마가 필터에서 빠져도 다른 테마를 고를 수 있다', async () => {
    const onSelect = jest.fn()
    const view = await renderAtom(<ThemeSelector theme={첫테마(라이트테마)} onSelect={onSelect} />)

    await press(view.getByLabelText('다크'))
    expect(view.queryByLabelText(첫테마(라이트테마))).toBeNull()

    await press(view.getByLabelText(첫테마(다크테마)))

    expect(onSelect).toHaveBeenCalledWith(첫테마(다크테마))
  })
})

describe('ThemeSelector — 프리뷰 타일', () => {
  // 비활성 테마의 색을 미리 보여주는 것이 이 타일의 일이라, 색이 **활성 테마의 토큰이 아니라
  // 레지스트리에서 직접** 와야 한다.
  it.each(THEME_NAMES)('%s 타일이 그 테마의 배경색으로 자기를 칠한다', async (name) => {
    const view = await renderAtom(
      <ThemeSelector theme={첫테마(THEME_NAMES)} onSelect={jest.fn()} />,
    )

    expect(flattenStyle(view.getByLabelText(name).props.style).backgroundColor).toBe(
      getThemeDefinition(name).bg,
    )
  })

  // : 앱 `dim` 은 전체 화면용이라 92px 타일에 덮으면 검은 띠고, 노출하면
  // 썸네일용 dim 값이 새로 생긴다. 그래서 목록에서는 색만 쓴다.
  it('배경 이미지를 목록에서 로드하지 않는다', async () => {
    const view = await renderAtom(
      <ThemeSelector theme={첫테마(THEME_NAMES)} onSelect={jest.fn()} />,
    )

    expect(view.queryAllByRole('image')).toHaveLength(0)
  })
})

// ★ 회귀 가드 — **한 줄에 둘**(의 `grid-cols-2`).
//
// 원래는 카드에 `w-[calc(50%-5px)]` 를 줬는데 **NativeWind 가 그 `calc()` 를 만들지 않아** 폭이
// 통째로 빠졌고, 카드가 글자 길이대로 늘어나 한 줄에 셋이 서기도 했다(2026-08-13 실기기 관측:
// `엔젤릭버스터`만 넓었다). **에러도 경고도 없다**. 이 저장소가 이번 전환에서 반복해서 밟은
// **조용히 안 먹는 스타일** 부류다.
//
// 그래서 **둘씩 선다** 를 **셀의 폭**으로 고정한다. 값이 `50%` 라는 것이 곧 2열이라는 뜻이고,
// 퍼센트 하나뿐이라 NativeWind 가 그대로 내보낸다.
describe('ThemeSelector — 2열 배치', () => {
  it('카드는 감싸는 셀이 절반 폭을 정한다 — 글자 길이가 폭을 정하지 않는다', async () => {
    const { getByLabelText } = await renderAtom(
      <ThemeSelector theme={THEME_NAMES[0]} onSelect={() => {}} />,
    )

    // 이름이 가장 긴 테마와 가장 짧은 테마가 **같은 폭**이어야 한다.
    const byLength = [...THEME_NAMES].sort((a, b) => a.length - b.length)
    for (const name of [byLength[0], byLength[byLength.length - 1]]) {
      const cell = (getByLabelText(name) as AtomElement).parent
      expect(flattenStyle(cell?.props.style).width).toBe('50%')
    }
  })
})
