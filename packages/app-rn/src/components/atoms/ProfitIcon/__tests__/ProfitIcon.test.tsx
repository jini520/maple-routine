// 커스텀 SVG를 lucide 아이콘 옆에 세우는 이상, 규격이 맞는지가 이 컴포넌트의 계약이다
// ([[ADR-066]] 결정 3) — 하나라도 어긋나면 같은 줄의 lucide 아이콘과 굵기·크기가 달라진다.
// RN 에서 그 이웃은 `lucide-react-native` 이고, 규격은 같다.
import { findAllOfType, flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { ProfitIcon } from '../ProfitIcon'

describe('ProfitIcon ([[ADR-066]])', () => {
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

  it('겹침을 clipPath·mask로 만들지 않는다 — 한 화면에 여러 번 그리면 id가 겹친다([[ADR-066]] 결정 4)', async () => {
    const tree = (await renderAtom(<ProfitIcon />)).toJSON()

    expect(findAllOfType(tree, 'RNSVGClipPath')).toHaveLength(0)
    expect(findAllOfType(tree, 'RNSVGMask')).toHaveLength(0)
  })

  it('렌더 트리 스냅샷 — 이후 변경을 잡는 기준선(예전 화면과의 대조가 아니다)', async () => {
    expect((await renderAtom(<ProfitIcon className="h-5 w-5" />)).toJSON()).toMatchSnapshot()
  })
})
