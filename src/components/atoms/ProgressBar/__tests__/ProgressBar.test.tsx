// 웹판이 지키던 것과 같다. **기존 호출부 9곳의 모습을 바꾸지 않는 것**.
// 클래스 문자열이 트리에 안 남으므로 풀린 값을 본다.
//
// 여기서 특히 중요한 케이스는 `tone="third"` 다. 웹은 `` `bg-${tone}` `` 로 이름을 조립했는데 RN 에서
// 그렇게 두면 Tailwind 스캔에 안 잡혀 **색이 통째로 빠진다**(에러 없이). 아래 두 케이스가 그
// 실패를 잡는다. 둘 다 색이 실제 테마 값과 같은지까지 본다.
import { flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { ProgressBar } from '../ProgressBar'

describe('ProgressBar', () => {
  it('트랙과 채움이의 h-1.5 프리미티브다', async () => {
    const { getByTestId } = await renderAtom(<ProgressBar percent={40} fillTestId="fill" />)

    const fill = getByTestId('fill')
    const track = fill.parent
    expect(flattenStyle(track?.props.style)).toMatchObject({
      height: 6, // h-1.5
      width: '100%',
      overflow: 'hidden',
      borderRadius: 9999,
      backgroundColor: 기본테마.track,
    })
    // 채움은 자기 높이를 갖지 않고 트랙을 채운다. 둘이 각자 알면 한쪽만 바뀔 때 어긋난다
    // (위젯 3 에서 낸 회귀).
    expect(flattenStyle(fill.props.style)).toMatchObject({
      height: '100%',
      borderRadius: 9999,
      backgroundColor: 기본테마.primary,
    })
  })

  it('height="thin"이면 트랙만 h-1이 되고 채움은 그대로 따라온다', async () => {
    const { getByTestId } = await renderAtom(
      <ProgressBar percent={40} height="thin" fillTestId="fill" />,
    )

    const fill = getByTestId('fill')
    expect(flattenStyle(fill.parent?.props.style).height).toBe(4) // h-1
    expect(flattenStyle(fill.props.style).height).toBe('100%')
  })

  it('채움 너비를 percent로 준다', async () => {
    const { getByTestId } = await renderAtom(<ProgressBar percent={40} fillTestId="fill" />)

    expect(flattenStyle(getByTestId('fill').props.style).width).toBe('40%')
  })

  it('tone="third"면 채움만 third 색이 된다. 컨텐츠 카드의 진행률', async () => {
    const { getByTestId } = await renderAtom(
      <ProgressBar percent={50} tone="third" fillTestId="fill" />,
    )

    const fill = getByTestId('fill')
    expect(flattenStyle(fill.props.style).backgroundColor).toBe(기본테마.third)
    expect(flattenStyle(fill.parent?.props.style).backgroundColor).toBe(기본테마.track)
  })

  // `animated` 는 **폭 트랜지션의 on/off** 다(step 7). Reanimated 는 CSS 트랜지션 키를 `style` 에서
  // 걷어 자기가 들고 가므로 `props.style` 로는 있으나 없으나 같아 보인다. 그래서 그 키가 실제로
  // 전달됐는지는 `jestInlineStyle`(Reanimated 가 테스트용으로 남기는 원본)로 본다. 값이 Tailwind 의
  // `transition-[width]` 와 같은지를 대조하던 테스트는 없다(`WIDTH_TRANSITION` 주석 참고).
  it('animated 면 폭 트랜지션이 붙는다', async () => {
    const { getByTestId } = await renderAtom(
      <ProgressBar percent={10} animated fillTestId="fill" />,
    )

    expect(getByTestId('fill').props.jestInlineStyle).toMatchObject({
      transitionProperty: 'width',
      transitionDuration: '150ms',
    })
  })

  it('animated 가 없으면 트랜지션 키가 아예 없다. 값이 바뀌면 그 자리로 점프한다', async () => {
    const { getByTestId } = await renderAtom(<ProgressBar percent={10} fillTestId="fill" />)

    expect(getByTestId('fill').props.jestInlineStyle).not.toHaveProperty('transitionProperty')
  })

  it('트랜지션이 붙어도 그려지는 스타일은 같다. 폭만 흐르고 모습은 안 바뀐다', async () => {
    const plain = await renderAtom(<ProgressBar percent={10} fillTestId="fill" />)
    const animated = await renderAtom(<ProgressBar percent={10} animated fillTestId="fill" />)

    expect(flattenStyle(animated.getByTestId('fill').props.style)).toEqual(
      flattenStyle(plain.getByTestId('fill').props.style),
    )
  })

  describe('접근성 값', () => {
    it('aria를 주면 progressbar 역할과 값을 함께 낸다', async () => {
      const { getByTestId } = await renderAtom(
        <ProgressBar percent={50} aria={{ now: 7, max: 14 }} fillTestId="fill" />,
      )

      const track = getByTestId('fill').parent
      expect(track?.props.accessibilityRole).toBe('progressbar')
      expect(track?.props.accessibilityValue).toEqual({ now: 7, min: 0, max: 14 })
    })

    // 호출부는 지금 일곱이 전부 `aria` 를 준다(마지막 하나였던 `UpdatePromptModal` 을 채웠다).
    // 프롭이 아직 선택이라 이 분기가 남아 있고, 그 분기의 계약을 여기서 고정한다.
    it('aria를 안 주면 역할도 값도 내지 않는다', async () => {
      const { getByTestId } = await renderAtom(<ProgressBar percent={50} fillTestId="fill" />)

      const track = getByTestId('fill').parent
      expect(track?.props.accessibilityRole).toBeUndefined()
      expect(track?.props.accessibilityValue).toBeUndefined()
    })
  })

})
