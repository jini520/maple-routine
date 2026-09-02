// 이 톱니의 계약은 둘이다 — ① 채우면 **가운데가 구멍으로 남는다**(그러려고 새로 그렸다)
// ② 그림이 lucide `settings` 와 **같다**(설정 화면들은 여전히 lucide 를 쓰므로, 좌표가 갈리면
// 같은 앱 안에서 톱니가 두 가지가 된다 —).
import Settings from 'lucide-react-native/icons/settings'

import { findAllOfType, renderAtom } from '../../../__tests__/render-atom'
import { GearIcon } from '../GearIcon'

describe('GearIcon', () => {
  it('lucide 규격(24 그리드 · currentColor 선 · 라운드 캡/조인)으로 그린다', async () => {
    const { getByTestId } = await renderAtom(<GearIcon />)

    const icon = getByTestId('gear-icon')
    expect(icon.props.vbWidth).toBe(24)
    expect(icon.props.vbHeight).toBe(24)
    expect(icon.props.stroke).toBe('currentColor')
    expect(icon.props.strokeLinecap).toBe('round')
    expect(icon.props.strokeLinejoin).toBe('round')
  })

  // **여기가 이 컴포넌트의 존재 이유다.** lucide 의 `Settings` 는 **톱니 패스 + 안쪽 원** 두
  // 요소라 `fill` 이 둘 다에 상속돼 가운데가 메워진다. 한 패스 두 서브패스 + `evenodd` 라야
  // 몸통만 차고 가운데가 빈다.
  // `react-native-svg` 는 호스트 단에서 `fillRule` 을 숫자로 바꾼다 — **0 이 evenodd** 다.
  it('한 패스에 evenodd 로 그린다 — 채우면 가운데가 구멍이다', async () => {
    const paths = findAllOfType(
      (await renderAtom(<GearIcon fill="#FF0000" />)).toJSON(),
      'RNSVGPath',
    )

    expect(paths).toHaveLength(1)
    expect(paths[0]?.props.fillRule).toBe(0)
  })

  it('채우기는 **주면 들어가고 안 주면 안 들어간다**', async () => {
    const pathOf = async (fill?: string): Promise<unknown> =>
      findAllOfType((await renderAtom(<GearIcon fill={fill} />)).toJSON(), 'RNSVGPath')[0]?.props
        .fill

    expect(await pathOf('#FF0000')).not.toEqual(await pathOf())
  })

  // 비활성 자리에서는 설정 화면의 톱니(lucide)와 **같은 그림**이어야 한다.
  it('안 채우면 lucide 와 같은 선 그림이다', async () => {
    const ours = findAllOfType((await renderAtom(<GearIcon />)).toJSON(), 'RNSVGPath')[0]
    const lucide = findAllOfType((await renderAtom(<Settings />)).toJSON(), 'RNSVGPath')[0]

    expect(ours?.props.fill).toEqual(lucide?.props.fill)
  })

  // 채운 상태에서 lucide 의 r3 을 그대로 쓰면 구멍이 **덩어리 속 점**으로 보인다 — 둘레의 획이
  // 구멍 안쪽을 더 먹기 때문이다(사용자 판정). 선일 때는 반대로 lucide 와 같아야 한다.
  it('구멍은 채웠을 때만 커진다 — 선일 때는 lucide 의 r3 그대로다', async () => {
    const pathOf = async (fill?: string): Promise<string> =>
      findAllOfType((await renderAtom(<GearIcon fill={fill} />)).toJSON(), 'RNSVGPath')[0]?.props
        .d as string

    expect(await pathOf()).toContain('3 3 0 1 1')
    // **호출부는 안 채움 을 `undefined` 가 아니라 `'none'` 으로 넘긴다**(하단바가 그렇다).
    // 이걸 **채움** 으로 세는 바람에 선 상태의 구멍이 커져 설정 화면의 톱니와 갈렸다(사용자가 잡았다).
    expect(await pathOf('none')).toContain('3 3 0 1 1')
    expect(await pathOf('#FF0000')).toContain('4.5 4.5 0 1 1')
  })

  // 좌표를 손으로 옮겼으므로, 원본이 바뀌면(패키지 업그레이드) 여기서 잡힌다.
  it('톱니 곡선이 lucide settings 의 것과 한 글자도 다르지 않다', async () => {
    const lucide = findAllOfType((await renderAtom(<Settings />)).toJSON(), 'RNSVGPath')
    const ours = findAllOfType((await renderAtom(<GearIcon />)).toJSON(), 'RNSVGPath')

    expect(lucide[0]?.props.d).toBeTruthy()
    expect(ours[0]?.props.d).toContain(lucide[0]?.props.d as string)
  })
})
