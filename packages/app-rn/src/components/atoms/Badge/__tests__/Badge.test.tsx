// 웹판은 클래스 **문자열**을 그대로 단언했지만 RN 에는 그 문자열이 남지 않는다 — NativeWind 가
// 렌더 시점에 style 로 바꿔 먹고 `className` 은 트리에서 사라진다. 그래서 여기서 지키는 것은
// **풀린 값**이고, 색 기대값은 손으로 적지 않고 `job-themes.json` 에서 읽는다([[ADR-006]]).
//
// 목적은 웹판과 같다: 호출부 6곳이 보던 배지가 그대로여야 한다([[ADR-094]] 결정 4).
import { flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { Badge } from '../Badge'

describe('Badge', () => {
  it('primary 톤 — `*-tint` 배경 위 `*-ink` 글자 + 캡슐 규격', async () => {
    const { getByText } = await renderAtom(<Badge tone="primary">3</Badge>)

    expect(flattenStyle(getByText('3').props.style)).toMatchObject({
      backgroundColor: 기본테마.primaryTint,
      color: 기본테마.primaryInk,
      borderRadius: 9999,
      paddingLeft: 10, // px-2.5
      paddingRight: 10,
      paddingTop: 4, // py-1
      paddingBottom: 4,
      fontSize: 12, // text-xs
      fontWeight: '600', // font-semibold
    })
  })

  it('third 톤은 배경·글자 토큰만 바뀐다', async () => {
    const { getByText } = await renderAtom(<Badge tone="third">7</Badge>)

    expect(flattenStyle(getByText('7').props.style)).toMatchObject({
      backgroundColor: 기본테마.thirdTint,
      color: 기본테마.thirdInk,
      borderRadius: 9999,
    })
  })

  it('className은 코어 뒤에 이어 붙는다 — 레이아웃은 호출부가 소유한다', async () => {
    const { getByText } = await renderAtom(
      <Badge tone="primary" className="ml-auto">
        12
      </Badge>,
    )

    expect(flattenStyle(getByText('12').props.style)).toMatchObject({
      marginLeft: 'auto',
      backgroundColor: 기본테마.primaryTint,
    })
  })

  it('Text 속성을 그대로 전달한다', async () => {
    const { getByTestId } = await renderAtom(
      <Badge tone="third" testID="count" accessibilityLabel="완료 수">
        5
      </Badge>,
    )

    expect(getByTestId('count').props.accessibilityLabel).toBe('완료 수')
  })

  it('렌더 트리 스냅샷 — 이후 변경을 잡는 기준선(예전 화면과의 대조가 아니다)', async () => {
    expect((await renderAtom(<Badge tone="primary">3</Badge>)).toJSON()).toMatchSnapshot()
  })
})
