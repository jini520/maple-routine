// 웹판이 지키던 것과 같다 — **기존 호출부 9곳의 모습을 바꾸지 않는 것**([[ADR-094]] 결정 4).
// 클래스 문자열이 트리에 안 남으므로 풀린 값을 본다.
//
// 여기서 특히 중요한 케이스는 `tone="third"` 다. 웹은 `` `bg-${tone}` `` 로 이름을 조립했는데 RN 에서
// 그렇게 두면 Tailwind 스캔에 안 잡혀 **색이 통째로 빠진다**(에러 없이). 아래 두 케이스가 그
// 실패를 잡는다 — 둘 다 색이 실제 테마 값과 같은지까지 본다.
import { flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { ProgressBar } from '../ProgressBar'

describe('ProgressBar', () => {
  it('트랙과 채움이 [[ADR-061]] 결정 6의 h-1.5 프리미티브다', async () => {
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
    expect(flattenStyle(fill.props.style)).toMatchObject({
      height: 6,
      borderRadius: 9999,
      backgroundColor: 기본테마.primary,
    })
  })

  it('채움 너비를 percent로 준다', async () => {
    const { getByTestId } = await renderAtom(<ProgressBar percent={40} fillTestId="fill" />)

    expect(flattenStyle(getByTestId('fill').props.style).width).toBe('40%')
  })

  it('tone="third"면 채움만 third 색이 된다 — 컨텐츠 카드의 진행률', async () => {
    const { getByTestId } = await renderAtom(
      <ProgressBar percent={50} tone="third" fillTestId="fill" />,
    )

    const fill = getByTestId('fill')
    expect(flattenStyle(fill.props.style).backgroundColor).toBe(기본테마.third)
    expect(flattenStyle(fill.parent?.props.style).backgroundColor).toBe(기본테마.track)
  })

  // 폭 트랜지션은 step 7 몫이라 아직 아무 일도 하지 않는다(컴포넌트 주석). 프롭을 받아도
  // **모습이 달라지지 않는다**는 것이 지금의 계약이다 — 여기서 초록이라고 부드럽게 흐르는 게 아니다.
  it('animated 를 줘도 지금은 모습이 같다 — 트랜지션은 step 7', async () => {
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

    // 9곳 중 UpdatePromptModal 한 곳만 역할·값 없이 그린다. 지금 붙이면 화면이 바뀌므로
    // ([[ADR-094]] 결정 4) 옵션으로 두고, 접근성 보강은 별도 변경으로 다룬다.
    it('aria를 안 주면 역할도 값도 내지 않는다', async () => {
      const { getByTestId } = await renderAtom(<ProgressBar percent={50} fillTestId="fill" />)

      const track = getByTestId('fill').parent
      expect(track?.props.accessibilityRole).toBeUndefined()
      expect(track?.props.accessibilityValue).toBeUndefined()
    })
  })

  it('렌더 트리 스냅샷 — 이후 변경을 잡는 기준선(예전 화면과의 대조가 아니다)', async () => {
    expect(
      (await renderAtom(<ProgressBar percent={40} aria={{ now: 7, max: 14 }} />)).toJSON(),
    ).toMatchSnapshot()
  })
})
