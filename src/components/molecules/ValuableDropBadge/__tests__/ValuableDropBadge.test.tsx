// 고가 드롭 배지. 화면 테스트 셋이 배지를 `aria-label` 로만 찾는다.
// RN 에서는 외형 규칙이 CSS(`.valuable-drop-badge`)가 아니라 **컴포넌트 안의 값**이 됐으므로
// (그라디언트·글로우·흰 링) 그 값을 지킬 자리가 필요하다.
import type { RecordedDrop } from '../../../../types/drops'
import { processColor } from 'react-native'

import { flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { ValuableDropBadge } from '../ValuableDropBadge'

function drops(...names: string[]): RecordedDrop[] {
  return names.map((itemName) => ({ itemName }) as RecordedDrop)
}

describe('ValuableDropBadge', () => {
  it('라벨은 호출부가 정한다. 자리마다 다른 문구를 받는다', async () => {
    const { getByTestId } = await renderAtom(
      <ValuableDropBadge drops={drops('칠흑의 보스 반지 상자')} label="이 기간 고가 드롭" />,
    )

    const badge = getByTestId('valuable-drop-badge')
    expect(badge.props['aria-label']).toBe('이 기간 고가 드롭')
    expect(badge.props.accessibilityRole).toBe('image')
  })

  it('아이콘은 최대 3개까지 그리고 나머지는 +N 으로 접는다', async () => {
    const { getAllByTestId, getByText } = await renderAtom(
      <ValuableDropBadge drops={drops('a', 'b', 'c', 'd', 'e')} label="고가 드롭" />,
    )

    expect(getAllByTestId('valuable-drop-icon')).toHaveLength(3)
    expect(getByText('+2')).toBeTruthy()
  })

  it('3개 이하면 +N 을 그리지 않는다', async () => {
    const { getAllByTestId, queryByText } = await renderAtom(
      <ValuableDropBadge drops={drops('a', 'b', 'c')} label="고가 드롭" />,
    )

    expect(getAllByTestId('valuable-drop-icon')).toHaveLength(3)
    expect(queryByText(/^\+/)).toBeNull()
  })

  // 스택 규칙. 뒤로 갈수록 6px 겹치고, **앞선 것이 위**다. 순서가 뒤집히면 겹침이 반대로 보인다.
  it('아이콘이 6px 씩 겹치고 앞선 것이 위에 온다', async () => {
    const { getAllByTestId } = await renderAtom(
      <ValuableDropBadge drops={drops('a', 'b', 'c')} label="고가 드롭" />,
    )

    expect(
      getAllByTestId('valuable-drop-icon').map((icon) => {
        const style = flattenStyle(icon.props.style)
        return [style.marginLeft, style.zIndex]
      }),
    ).toEqual([
      [0, 3],
      [-6, 2],
      [-6, 1],
    ])
  })

  // 골드는 **전 테마 공통 고정색**이다(테마 토큰이 아니다). 토큰으로 바꾸면
  // 라이트 테마에서 배경에 묻힌다는 것이 그때의 실측 결론이었다.
  it('배지 골드는 테마와 무관한 고정 그라디언트다', async () => {
    const 머쉬맘 = await renderAtom(<ValuableDropBadge drops={drops('a')} label="고가 드롭" />)

    // `LinearGradient` 는 색을 네이티브 정수로 바꿔 넘긴다. 같은 변환을 태워 비교한다.
    expect(머쉬맘.getByTestId('valuable-drop-badge').props.colors).toEqual(
      ['#ffe98a', '#f7c400'].map(processColor),
    )
    // 대비로 쓰는 표면색은 테마를 따른다. 아이콘 폴백 원이 그 자리다.
    expect(flattenStyle(머쉬맘.getAllByTestId('valuable-drop-icon')[0].props.style).backgroundColor).toBe(
      기본테마.surface2,
    )
  })

// 글로우와 흰 테두리가 둘 다 `boxShadow` 로 온다. 색 있는 글로우는
  // 안드로이드의 `elevation` 으로 표현할 수 없고, ring 을 `borderWidth` 로 옮기면 아이콘이 작아진다.
  it('글로우와 흰 링을 boxShadow 로 그린다', async () => {
    const { getByTestId, getAllByTestId } = await renderAtom(
      <ValuableDropBadge drops={drops('a')} label="고가 드롭" />,
    )

    expect(flattenStyle(getByTestId('valuable-drop-badge').props.style).boxShadow).toEqual([
      { offsetX: 0, offsetY: 0, blurRadius: 8, color: 'rgba(247, 208, 13, 0.55)' },
    ])
    expect(flattenStyle(getAllByTestId('valuable-drop-icon')[0].props.style).boxShadow).toEqual([
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: 'rgba(255, 255, 255, 0.8)' },
    ])
  })

  // 아이콘이 붙었다
  //
  // 이 컴포넌트는 `getItemIconUrl` 을 **아예 부르지 않아** 아이콘 자리가 늘 폴백 원이었다(에셋
  // 레이어가 값을 대는 데까지였고 그림 붙이기는 화면 작업 몫이었다). 어두운 테마에서 그 원이
  // 까맣게 보여 **아이템 이미지가 안 나온다** 로 보고됐다(사용자).
  it('매핑이 있는 아이템은 그림을 그린다. 폴백 원이 아니다', async () => {
    const { getAllByTestId } = await renderAtom(
      <ValuableDropBadge drops={drops('홍옥의 보스 반지 상자')} label="고가 드롭" />,
    )

    const [icon] = getAllByTestId('valuable-drop-icon')
    expect(icon.props.source).toBeDefined()
// 정사각 원 안에서 비율을 지킨다.
    expect(icon.props.resizeMode).toBe('contain')
// 그림이 있는 자리의 바탕은 `surface`(폴백 원만 `surface-2`)다.
    expect(flattenStyle(icon.props.style).backgroundColor).toBe(기본테마.surface)
  })

  // 매핑에 없는 이름은 여전히 폴백이다. **에셋이 왔으니 무조건 그린다** 로 굳지 않게 남긴다.
  it('매핑이 없는 아이템은 폴백 원으로 남는다', async () => {
    const { getAllByTestId } = await renderAtom(
      <ValuableDropBadge drops={drops('존재하지않는아이템')} label="고가 드롭" />,
    )

    const [icon] = getAllByTestId('valuable-drop-icon')
    expect(icon.props.source).toBeUndefined()
    expect(flattenStyle(icon.props.style).backgroundColor).toBe(기본테마.surface2)
  })

  // 스택·링은 **두 갈래가 같아야 한다**. 한쪽에만 걸면 그림이 있는 배지와 없는 배지의 겹침이
  // 다르게 보인다.
  it('그림이 있어도 겹침·zIndex·흰 링이 그대로다', async () => {
    const { getAllByTestId } = await renderAtom(
      <ValuableDropBadge
        drops={drops('홍옥의 보스 반지 상자', '흑옥의 보스 반지 상자', '백옥의 보스 반지 상자')}
        label="고가 드롭"
      />,
    )

    const ring = [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: 'rgba(255, 255, 255, 0.8)' },
    ]

    expect(
      getAllByTestId('valuable-drop-icon').map((icon) => {
        const style = flattenStyle(icon.props.style)
        return [style.marginLeft, style.zIndex, style.boxShadow]
      }),
    ).toEqual([
      [0, 3, ring],
      [-6, 2, ring],
      [-6, 1, ring],
    ])
  })

  // 배치는 호출부가 정한다. 카드 우상단 절대배치· 헤드라인 인라인· 히스토리 줄.
  it('className 은 코어 뒤에 이어 붙는다', async () => {
    const { getByTestId } = await renderAtom(
      <ValuableDropBadge drops={drops('a')} label="고가 드롭" className="absolute -right-1.5 -top-2" />,
    )

    expect(flattenStyle(getByTestId('valuable-drop-badge').props.style)).toMatchObject({
      position: 'absolute',
      borderRadius: 9999,
    })
  })

})
