/**
 * 인벤토리를 가리키는 배낭. 사용자가 고른 그림(둥근 돔 · 굵은 손잡이 고리 · 아래 양옆 옆주머니 · 앞주머니 `⊓`)을 픽셀로 재서
 * 24 격자에 옮긴 채운 아이콘이다. lucide `backpack` 으로 대체하지 않는다.
 *
 * **꺼진 탭도 고른 탭도 채운다**(사용자 지정). 그래서 하단바가 넘기는 `fill` · `strokeWidth` 를 보지 않는다.
 *
 * 앞주머니는 `clipPath` · `mask` 가 아니라 몸통 면의 구멍(`evenodd`)으로 판다. 한 화면에 여러 번 그리면 마스크 id 가 겹친다.
 * 손잡이는 몸통과 겹치는 아래 끝이 `evenodd` 로 지워지지 않게 따로 그린다.
 */
import { Path } from 'react-native-svg'

import { SvgFrame, type IconProps } from './icon-base'

/** 몸통(돔 · 옆주머니 · 바닥)과 앞주머니 구멍. 주머니는 굵기 1.68 의 `⊓` 이고 다리 끝이 둥글다. */
const BODY =
  'M10.53 3.96H13.47A6.72 6.72 0 0 1 20.19 10.68V13.4H20.86A0.8 0.8 0 0 1 21.66 14.2V19.75A0.8 0.8 0 0 1 20.86 20.55' +
  'H20.19V20.76A1.47 1.47 0 0 1 18.72 22.23H5.28A1.47 1.47 0 0 1 3.81 20.76V20.55H3.14A0.8 0.8 0 0 1 2.34 19.75' +
  'V14.2A0.8 0.8 0 0 1 3.14 13.4H3.81V10.68A6.72 6.72 0 0 1 10.53 3.96Z' +
  'M6.23 17.61V14.25H17.88V17.61A0.84 0.84 0 0 1 16.2 17.61V15.93H7.91V17.61A0.84 0.84 0 0 1 6.23 17.61Z'

/** 손잡이 고리. 바깥 반지름 3.575 · 안쪽 2.205 이고 아래 끝이 몸통 윗면에 묻힌다. */
const HANDLE = 'M8.425 4.8V4.17A3.575 3.575 0 0 1 15.575 4.17V4.8H14.205V4.17A2.205 2.205 0 0 0 9.795 4.17V4.8Z'

/**
 * @example
 * // 하단바. 클래스를 못 쓰는 자리라 색과 크기를 값으로 준다
 * <BackpackIcon color={color} size={25} />
 */
export function BackpackIcon(props: IconProps): React.JSX.Element {
  return (
    <SvgFrame testID="backpack-icon" {...props}>
      <Path d={BODY} fill="currentColor" fillRule="evenodd" />
      <Path d={HANDLE} fill="currentColor" />
    </SvgFrame>
  )
}
