// 커스텀 SVG를 lucide 아이콘 옆에 세우는 이상, 규격이 맞는지가 이 컴포넌트의 계약이다
// 하나라도 어긋나면 같은 줄의 lucide 아이콘과 굵기·크기가 달라진다.
// RN 에서 그 이웃은 `lucide-react-native` 이고, 규격은 같다.
import { findAllOfType, flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { ProfitIcon } from '../ProfitIcon'

describe('ProfitIcon', () => {
  it('lucide 규격(24 그리드 · currentColor 선 · 라운드 캡/조인)으로 그린다', async () => {
    const { getByTestId } = await renderAtom(<ProfitIcon />)

    const icon = getByTestId('profit-icon')
    expect(icon.props.vbWidth).toBe(24)
    expect(icon.props.vbHeight).toBe(24)
    expect(icon.props.fill).toBe('none')
    expect(icon.props.stroke).toBe('currentColor')
    expect(icon.props.strokeLinecap).toBe('round')
    expect(icon.props.strokeLinejoin).toBe('round')
  })

  it('strokeWidth 기본값은 lucide와 같은 2이고, 호출부가 덮어쓸 수 있다', async () => {
    const base = await renderAtom(<ProfitIcon />)
    expect(base.getByTestId('profit-icon').props.strokeWidth).toBe(2)

    const thin = await renderAtom(<ProfitIcon strokeWidth={1.5} />)
    expect(thin.getByTestId('profit-icon').props.strokeWidth).toBe(1.5)
  })

  it('크기는 className이 정한다 — 호출부의 h-5 w-5가 그대로 붙는다', async () => {
    const { getByTestId } = await renderAtom(<ProfitIcon className="h-5 w-5" />)

    expect(flattenStyle(getByTestId('profit-icon').props.style)).toMatchObject({
      width: 20,
      height: 20,
    })
  })

  it('className을 안 주면 lucide와 같은 24×24로 떨어진다', async () => {
    const { getByTestId } = await renderAtom(<ProfitIcon />)

    const icon = getByTestId('profit-icon')
    expect(icon.props.width).toBe(24)
    expect(icon.props.height).toBe(24)
  })

  it('색도 className이 정한다 — `currentColor` 가 읽는 `color` 프롭으로 들어간다', async () => {
    const { getByTestId } = await renderAtom(<ProfitIcon className="text-primary" />)

    expect(getByTestId('profit-icon').props.color).toBe(기본테마.primary)
  })

  it('겹침을 clipPath·mask로 만들지 않는다 — 한 화면에 여러 번 그리면 id가 겹친다', async () => {
    const tree = (await renderAtom(<ProfitIcon />)).toJSON()

    expect(findAllOfType(tree, 'RNSVGClipPath')).toHaveLength(0)
    expect(findAllOfType(tree, 'RNSVGMask')).toHaveLength(0)
  })

  // 하단바 활성 자리를 위해 `fill` 을 열었다. **안 주면 안 들어가야 한다** —
  // `undefined` 를 그대로 넘기면 `react-native-svg` 가 뿌리의 `fill="none"` 을 상속하지 않고
  // 검정으로 떨어뜨려, 이 아이콘이 쓰이는 세 자리 전부에서 동전이 새까매진다(실측으로 잡았다).
  it('fill 을 안 주면 채워지지 않는다 — 기본은 lucide 규격의 **면 없음** 이다', async () => {
    const tree = (await renderAtom(<ProfitIcon />)).toJSON()

    for (const shape of [...findAllOfType(tree, 'RNSVGEllipse'), ...findAllOfType(tree, 'RNSVGCircle')]) {
      expect(shape.props.fill).toBeNull()
    }
  })

  // **단을 그리는 호는 건드리지 않는다.** 호까지 채우면 동전 사이의 층이 면에 묻혀 그림이
  // 뭉개진다. 호의 렌더값을 채운 판과 안 채운 판에서 비교해 **fill 이 새지 않았는지** 를 본다
  // (호스트 단 `fill` 절대값은 기준이 못 된다. 프롭 없는 호는 기본값을 보고한다).
  it('fill 을 주면 닫힌 모양(동전 둘)만 채워진다 — 단을 그리는 호는 그대로다', async () => {
    const tree = (await renderAtom(<ProfitIcon fill="#FF0000" />)).toJSON()
    const coins = [...findAllOfType(tree, 'RNSVGEllipse'), ...findAllOfType(tree, 'RNSVGCircle')]
    const arcsOf = async (fill?: string): Promise<unknown[]> =>
      findAllOfType((await renderAtom(<ProfitIcon fill={fill} />)).toJSON(), 'RNSVGPath').map(
        (arc) => arc.props.fill,
      )

    expect(coins).toHaveLength(2)
    for (const coin of coins) expect(coin.props.fill).not.toBeNull()
    expect(await arcsOf('#FF0000')).toEqual(await arcsOf())
  })

})
