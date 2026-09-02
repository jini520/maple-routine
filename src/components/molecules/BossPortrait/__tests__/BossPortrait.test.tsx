// 웹판은 네 케이스였고 3단계에서는 그중 **둘(이미지 분기)이 없었다**. 그림이 번들에 없었고,
//  로 들어온 뒤에도 크롭을 RN 기하로 옮기는 일이 남아 있었다. step 5 가 그 변환을
// 붙이며 **네 케이스가 다 선다**.
//
// **jest 에서 그림의 고유 크기는 없다**(에셋이 `{ testUri }` 대역이다. 의
// `image-asset.native.ts`). 그래서 크롭이 있어도 배치는 `cover` 폴백으로 떨어진다. 여기서 지킬 수
// 있는 계약은 **어느 분기로 가는가**(그림이 있으면 `<Image>`, 없으면 `?`)이고, 퍼센트 배치가 맞게
// 나오는지는 `lib/__tests__/image-crop.test.ts` 의 순수 함수 케이스가 든다.
import { flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { BossPortrait } from '../BossPortrait'

describe('BossPortrait', () => {
  it('그림이 있는 슬러그는 원형으로 잘린 이미지다', async () => {
    const { getByTestId, queryByText } = await renderAtom(
      <BossPortrait portraitSlug="lucid" label="루시드" />,
    )

    const portrait = getByTestId('boss-portrait')
    expect(portrait.props.accessibilityLabel).toBe('루시드')
    // 웹 `role="img"` 의 짝. 플레이스홀더에는 없다(그쪽은 이름만 읽힌다).
    expect(portrait.props.role).toBe('img')
    expect(queryByText('?')).toBeNull()

    // 원형 클리핑은 **우리가 명시해야 한다**. 웹은 `background-image` 라 둥근 모서리가 배경을
    // 저절로 잘랐지만 RN 의 `<Image>` 는 자식이라 부모가 자르지 않으면 네모로 삐져나온다.
    expect(flattenStyle(portrait.props.style)).toMatchObject({
      borderRadius: 9999,
      overflow: 'hidden',
    })

    // 그림이 **진짜 번들 에셋**이라는 것이 계약이다. 슬러그가 안 풀리면 조용히 플레이스홀더로
    // 떨어지므로(이 웹에서 잡던 그 실패), 소스가 실재하는지까지 본다.
    expect(getByTestId('boss-portrait-image').props.source).toBeDefined()
  })

  it('label 을 접근성 이름으로 갖는 원형 플레이스홀더를 그린다', async () => {
    const { getByTestId, getByText } = await renderAtom(
      <BossPortrait portraitSlug={null} label="벨로나" />,
    )

    const portrait = getByTestId('boss-portrait')
    expect(portrait.props.accessibilityLabel).toBe('벨로나')
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

  // 격자로 서는 자리(가계부의 처치 타일)를 위한 둘째 모양. 원이 격자로 서면
  // 네 귀가 비어 사이가 성겨 보인다.
  it('네모를 지정하면 귀만 둥근 상자다. 기본은 원형 그대로다', async () => {
    const 네모 = await renderAtom(
      <BossPortrait portraitSlug="lucid" label="루시드" shape="square" />,
    )
    expect(flattenStyle(네모.getByTestId('boss-portrait').props.style)).toMatchObject({
      borderRadius: 8,
      overflow: 'hidden',
    })

    // 호출부 둘(보스 수익 행·보스 관리)이 안 바뀐다는 것이 계약이다.
    const 지정없음 = await renderAtom(<BossPortrait portraitSlug="lucid" label="루시드" />)
    const 원형지정 = await renderAtom(
      <BossPortrait portraitSlug="lucid" label="루시드" shape="circle" />,
    )
    expect(지정없음.toJSON()).toEqual(원형지정.toJSON())
  })

  it('플레이스홀더도 같은 모양을 따른다. 그림 유무로 귀가 달라지면 안 된다', async () => {
    const { getByTestId } = await renderAtom(
      <BossPortrait portraitSlug={null} label="벨로나" shape="square" />,
    )

    expect(flattenStyle(getByTestId('boss-portrait').props.style).borderRadius).toBe(8)
  })

  it.each([
    ['슬러그가 없을 때', null],
    ['존재하지 않는 슬러그일 때', '존재하지않는슬러그'],
  ])('%s 는 플레이스홀더다. 그림이 없다는 사실을 화면이 인정한다', async (_label, slug) => {
    const { getByTestId, getByText } = await renderAtom(
      <BossPortrait portraitSlug={slug} label="알 수 없는 보스" />,
    )

    expect(getByTestId('boss-portrait').props.accessibilityLabel).toBe('알 수 없는 보스')
    expect(getByText('?')).toBeTruthy()
  })

})
