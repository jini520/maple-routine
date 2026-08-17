// 제목 줄 프리미티브 ([[ADR-145]] 정정 1).
//
// 이 파일이 지키는 것은 **«최소» 라는 성질 하나**다. 줄 높이를 정하는 것은 함께 선 것들이고
// (새로고침 32 · ← 28 또는 36 · 글자 링크 20 · 없음 28) 제목은 `items-center` 로 그 안에 앉는데,
// 화면마다 그 «함께 선 것» 이 달라 제목이 탭마다 0~4px 튀었다. 바닥을 하나로 두면 그 대부분이
// 한 선에 서고, **위는 막지 않는다** — 더 큰 것이 들어오면 줄은 자라야 한다(사용자 지시).
//
// 그래서 «높이가 32 다» 가 아니라 **«최소가 32 이고 고정 높이가 없다»** 를 단언한다. `height` 를
// 주는 순간 큰 자식이 잘리는데, 그 잘림은 jest 에 레이아웃이 없어 스타일로만 잡을 수 있다.
import { Text, View } from 'react-native'

import { flattenStyle, renderOverlay } from '../../../__tests__/render-atom'
import { PAGE_HEADER_TITLE_ROW_MIN_H, PageHeaderTitleRow } from '../PageHeaderTitleRow'

function styleOf(node: { props: { style?: unknown } }): Record<string, unknown> {
  return flattenStyle(node.props.style)
}

describe('PageHeaderTitleRow', () => {
  it('최소 높이를 주고 고정 높이는 주지 않는다', async () => {
    const { getByTestId } = await renderOverlay(
      <PageHeaderTitleRow>
        <Text>보스 관리</Text>
      </PageHeaderTitleRow>,
    )

    const style = styleOf(getByTestId('page-header-title-row'))
    expect(style.minHeight).toBe(PAGE_HEADER_TITLE_ROW_MIN_H)
    expect(style.height).toBeUndefined()
  })

  // 줄은 가로이고 자식은 세로 중앙이다 — 이 둘이 있어야 «최소 높이» 가 제목을 가운데 놓는다.
  it('가로 줄이고 자식을 세로 중앙에 놓는다', async () => {
    const { getByTestId } = await renderOverlay(
      <PageHeaderTitleRow>
        <Text>보스 관리</Text>
      </PageHeaderTitleRow>,
    )

    expect(styleOf(getByTestId('page-header-title-row'))).toMatchObject({
      flexDirection: 'row',
      alignItems: 'center',
    })
  })

  // 화면마다 오른쪽 자리(`justify-between`)나 사이 간격(`gap-2`)이 다르다 — 그것까지 프리미티브가
  // 정하면 호출부가 줄을 다시 손으로 그리게 된다. 바닥만 정하고 나머지는 받는다.
  it('넘겨받은 클래스를 함께 쓴다 — 최소 높이는 그대로다', async () => {
    const { getByTestId } = await renderOverlay(
      <PageHeaderTitleRow className="justify-between gap-2">
        <Text>보스 스케줄러</Text>
        <View />
      </PageHeaderTitleRow>,
    )

    expect(styleOf(getByTestId('page-header-title-row'))).toMatchObject({
      minHeight: PAGE_HEADER_TITLE_ROW_MIN_H,
      justifyContent: 'space-between',
      columnGap: 8,
    })
  })

  it('자식을 그대로 그린다', async () => {
    const { getByText } = await renderOverlay(
      <PageHeaderTitleRow>
        <Text>보스 관리</Text>
      </PageHeaderTitleRow>,
    )

    expect(getByText('보스 관리')).toBeTruthy()
  })
})
