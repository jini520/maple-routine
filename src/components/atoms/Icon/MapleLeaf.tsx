/**
 * 앱의 브랜드 마크. 채운 단풍잎 하나다.
 *
 * 아이콘처럼 쓰지만 lucide 규격은 아니다. 호출부가 넘기는 것은 `className`·`fill`·`size` 로
 * 아이콘과 같은데, 격자가 127×130 이라 정사각이 아니고 선이 아니라 면으로 그린다. 그래서
 * `IconSvg` 가 아니라 `SvgFrame` 을 잎 격자로 부른다. lucide 프리셋을 받으면 뿌리의 `stroke`
 * 가 상속돼 2px 윤곽선이 얹힌다.
 *
 * 같은 잎이 움직이는 자리는 `atoms/Spinner` 다.
 */
import { Path } from 'react-native-svg'

import { SvgFrame, type IconProps } from './icon-base'
import { LEAF_GRID, MAPLE_LEAF_PATH } from './maple-leaf'

/**
 * 단풍잎 하나.
 *
 * 색은 `className` 으로 준다. 테마 토큰을 못 쓰는 자리(가뭄 잎 램프처럼 단계별 hex 를 쓰는 곳)만
 * `fill` 에 값을 직접 넘긴다.
 *
 * @example
 * // 빈 상태의 브랜드 마크
 * <MapleLeaf className="text-primary-ink" size={isPage ? 42 : 28} />
 *
 * @example
 * // 가뭄 잎 램프. 단계 색이 테마 토큰이 아니라 hex 라 값으로 준다
 * <MapleLeaf size={props.sizePx} fill={style.leaf} aria-hidden />
 */
export function MapleLeaf(props: IconProps): React.JSX.Element {
  return (
    <SvgFrame testID="maple-leaf" grid={LEAF_GRID} {...props}>
      <Path d={MAPLE_LEAF_PATH} fill={props.fill ?? 'currentColor'} />
    </SvgFrame>
  )
}
