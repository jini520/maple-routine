// 웹판은 네 케이스였고 그중 **둘(이미지 분기)이 RN 에는 아직 없다** — 에셋이 번들에 없어
// `getBossPortraitUrl` 이 항상 `null` 이기 때문이다(컴포넌트 주석 · `src/lib/rn-boss-icons.ts`).
// 그 사실 자체는 `src/__tests__/core-shims.test.ts` 가 계약으로 들고 있고, 여기서는 **웹이라도
// 같은 값을 받으면 탔을 분기**(플레이스홀더)가 그대로인지만 본다.
//
// 이미지 분기가 돌아오면 웹의 두 케이스(크롭 반영·`role="img"`)를 여기 되살려야 한다.
import { flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { BossPortrait } from '../BossPortrait'

describe('BossPortrait', () => {
  it('label 을 접근성 이름으로 갖는 원형 플레이스홀더를 그린다', async () => {
    const { getByTestId, getByText } = await renderAtom(<BossPortrait portraitSlug="lucid" label="루시드" />)

    const portrait = getByTestId('boss-portrait')
    expect(portrait.props.accessibilityLabel).toBe('루시드')
    expect(getByText('?')).toBeTruthy()
    expect(flattenStyle(portrait.props.style)).toMatchObject({
      borderRadius: 9999,
      backgroundColor: 기본테마.surface2,
    })
  })

  it('기본 크기는 40px 이고 size 로 바꾼다', async () => {
    const 기본 = await renderAtom(<BossPortrait portraitSlug={null} label="벨로나" />)
    expect(flattenStyle(기본.getByTestId('boss-portrait').props.style)).toMatchObject({
      width: 40,
      height: 40,
    })

    const 지정 = await renderAtom(<BossPortrait portraitSlug={null} label="벨로나" size={28} />)
    expect(flattenStyle(지정.getByTestId('boss-portrait').props.style)).toMatchObject({
      width: 28,
      height: 28,
    })
  })

  it.each([
    ['슬러그가 없을 때', null],
    ['존재하지 않는 슬러그일 때', '존재하지않는슬러그'],
  ])('%s 도 같은 플레이스홀더다', async (_label, slug) => {
    const { getByTestId } = await renderAtom(<BossPortrait portraitSlug={slug} label="알 수 없는 보스" />)

    expect(getByTestId('boss-portrait').props.accessibilityLabel).toBe('알 수 없는 보스')
  })

  it('렌더 트리 스냅샷 — 이후 변경을 잡는 기준선(예전 화면과의 대조가 아니다)', async () => {
    expect((await renderAtom(<BossPortrait portraitSlug="lucid" label="루시드" />)).toJSON()).toMatchSnapshot()
  })
})
