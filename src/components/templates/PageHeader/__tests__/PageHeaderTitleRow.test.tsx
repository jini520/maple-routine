// 제목 줄 프리미티브.
//
// 이 파일이 지키는 것은 **최소 라는 성질 하나**다. 줄 높이를 정하는 것은 함께 선 것들이고
// (새로고침 32· ← 28 또는 36· 글자 링크 20· 없음 28) 제목은 `items-center` 로 그 안에 앉는데,
// 화면마다 그 **함께 선 것** 이 달라 제목이 탭마다 0~4px 튀었다. 바닥을 하나로 두면 그 대부분이
// 한 선에 서고, **위는 막지 않는다**. 더 큰 것이 들어오면 줄은 자라야 한다.
//
// 그래서 **높이가 32 다** 가 아니라 **최소가 32 이고 고정 높이가 없다** 를 단언한다. `height` 를
// 주는 순간 큰 자식이 잘리는데, 그 잘림은 jest 에 레이아웃이 없어 스타일로만 잡을 수 있다.
import { within } from '@testing-library/react-native'
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

  // 줄은 가로이고 자식은 세로 중앙이다. 이 둘이 있어야 **최소 높이** 가 제목을 가운데 놓는다.
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

  // 화면마다 오른쪽 자리(`justify-between`)나 사이 간격(`gap-2`)이 다르다. 그것까지 프리미티브가
  // 정하면 호출부가 줄을 다시 손으로 그리게 된다. 바닥만 정하고 나머지는 받는다.
  it('넘겨받은 클래스를 함께 쓴다. 최소 높이는 그대로다', async () => {
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

// 갱신 시각 줄의 자리를 화면이 고르면 화면마다 다른 자리를 고른다. 실제로 그랬다. 예비 칸이
// 헤더 **바닥**에 있어 총 높이만 맞고 그 사이 내용이 16 위로 끌려 올라갔고, 셸을 안 쓰는 헤더
// 넷과 빈 상태 가지 셋은 그 자리를 아예 못 받았다. 자리를 프리미티브가 가지면 틀릴 수가 없다.
describe('PageHeaderTitleRow: 갱신 시각 줄', () => {
  it('제목 줄 **아래**에 그 줄을 함께 그린다', async () => {
    const { getByTestId, queryByTestId } = await renderOverlay(
      <PageHeaderTitleRow>
        <Text>보스 관리</Text>
      </PageHeaderTitleRow>,
    )

    expect(getByTestId('data-freshness')).toBeTruthy()
    // 줄 **안**이 아니다. 안에 있으면 제목 옆에 서고 줄 높이까지 밀어 올린다.
    expect(within(getByTestId('page-header-title-row')).queryByTestId('data-freshness')).toBeNull()
    expect(queryByTestId('page-header-title-block')).toBeTruthy()
  })

  it('값을 주면 그 줄에 적는다', async () => {
    const { getByTestId } = await renderOverlay(
      <PageHeaderTitleRow fetchedAt="2026-09-08T05:03:22.000Z">
        <Text>보스 스케줄러</Text>
      </PageHeaderTitleRow>,
    )

    // `toHaveTextContent` 는 이 노드를 못 읽는다(합성 `Text` 라 호스트 글자까지 안 내려간다).
    // 빈 문자열은 무엇에나 통과해서 그 함정이 안 보인다. 그린 글자를 그대로 본다.
    expect(getByTestId('data-freshness').props.children).toBe('14:03:22 기준')
  })

  // 이것이 통일의 실질이다. 값이 없는 헤더도 같은 높이로 선다.
  it('값이 없어도 줄은 그대로 서고 글자만 빈다', async () => {
    const { getByTestId } = await renderOverlay(
      <PageHeaderTitleRow>
        <Text>설정</Text>
      </PageHeaderTitleRow>,
    )

    expect(getByTestId('data-freshness').props.children).toBe('')
    expect(styleOf(getByTestId('data-freshness')).height).toBe(16)
  })

  // `min-h-8` 이 제목 글자 아래에 이미 여백을 남긴다. 간격을 더하면 둘이 떨어져 보인다.
  it('덩어리에 간격을 주지 않는다', async () => {
    const { getByTestId } = await renderOverlay(
      <PageHeaderTitleRow>
        <Text>보스 관리</Text>
      </PageHeaderTitleRow>,
    )

    const style = styleOf(getByTestId('page-header-title-block'))
    expect(style.rowGap).toBeUndefined()
    expect(style.gap).toBeUndefined()
  })

  // 줄의 몫(`justify-between`·`gap-2`)은 제목 줄에 붙어야 한다. 덩어리에 붙으면 갱신 시각 줄까지
  // 그 규칙에 끌려 들어간다.
  it('넘겨받은 클래스는 제목 줄에 붙는다', async () => {
    const { getByTestId } = await renderOverlay(
      <PageHeaderTitleRow className="justify-between">
        <Text>가계부</Text>
        <View />
      </PageHeaderTitleRow>,
    )

    expect(styleOf(getByTestId('page-header-title-row')).justifyContent).toBe('space-between')
    expect(styleOf(getByTestId('page-header-title-block')).justifyContent).toBeUndefined()
  })
})

// 제목 줄 **옆**이 아니라 덩어리 **옆**에 서는 자리.
//
// 주기 탭처럼 32px 인 것을 제목 줄에 넣으면 줄을 꽉 채워 위아래 여백이 0 이 된다. 헤더 맨 위에
// 딱 붙어 보이고(사용자 지적), 왼쪽은 두 줄인데 오른쪽은 첫 줄에만 붙어 균형도 깨진다.
// 덩어리 옆에 두면 제목과 갱신 시각 둘을 합친 48 의 한가운데에 앉는다.
describe('PageHeaderTitleRow: 덩어리 옆에 서는 것', () => {
  it('주면 덩어리가 가로 줄이 되고 세로 중앙에 놓는다', async () => {
    const { getByTestId } = await renderOverlay(
      <PageHeaderTitleRow trailing={<View testID="곁" />}>
        <Text>보스 수익</Text>
      </PageHeaderTitleRow>,
    )

    expect(styleOf(getByTestId('page-header-title-block'))).toMatchObject({
      flexDirection: 'row',
      alignItems: 'center',
    })
    expect(getByTestId('곁')).toBeTruthy()
  })

  // 제목 줄 안에 있으면 제목 옆에 서고 줄 높이까지 밀어 올린다. 갱신 시각 줄과 같은 이유다.
  it('제목 줄 **밖**이다', async () => {
    const { getByTestId } = await renderOverlay(
      <PageHeaderTitleRow trailing={<View testID="곁" />}>
        <Text>보스 수익</Text>
      </PageHeaderTitleRow>,
    )

    expect(within(getByTestId('page-header-title-row')).queryByTestId('곁')).toBeNull()
  })

  // 제목이 길면 그쪽이 줄어들어야 한다. 곁에 선 것이 줄어들면 조각이 찌그러진다.
  it('제목 쪽이 남는 폭을 먹고 곁에 선 것은 안 줄어든다', async () => {
    const { getByTestId } = await renderOverlay(
      <PageHeaderTitleRow trailing={<View testID="곁" />}>
        <Text>컨텐츠 스케줄러</Text>
      </PageHeaderTitleRow>,
    )

    expect(styleOf(getByTestId('page-header-title-column'))).toMatchObject({ flexGrow: 1 })
    expect(styleOf(getByTestId('page-header-title-trailing')).flexShrink).toBe(0)
  })

  // 안 주면 지금 트리 그대로여야 한다. 덩어리에 가로 규칙이 붙으면 갱신 시각 줄이 제목 옆으로 간다.
  it('안 주면 덩어리는 세로 그대로다', async () => {
    const { getByTestId, queryByTestId } = await renderOverlay(
      <PageHeaderTitleRow>
        <Text>설정</Text>
      </PageHeaderTitleRow>,
    )

    expect(styleOf(getByTestId('page-header-title-block')).flexDirection).toBeUndefined()
    expect(queryByTestId('page-header-title-trailing')).toBeNull()
  })
})
