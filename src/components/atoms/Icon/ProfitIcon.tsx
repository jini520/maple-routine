/**
 * 수익을 가리키는 아이콘. 원통형 동전 더미 뒤에 앞 동전 하나가 겹친 입체 라인 드로잉이다.
 *
 * **수익을 가리키는 자리는 전부 이것 하나를 쓴다**. 하단 탭바 · 총 수익 헤드라인
 * 엠블럼 · 빈 상태 · 가계부 수입 줄이 그렇다. 사용자가 고른 그림이 lucide 에 없어 직접 그렸고,
 * lucide `coins` 로 대체하면 안 된다. 그것도 동전 더미라 이 아이콘과 뜻이 겹친다.
 *
 * 겹침을 `clipPath`·`mask` 가 아니라 **좌표로** 표현한다. 한 화면에 여러 번
 * 그리면 마스크 id 가 중복되고, `react-native-svg` 의 defs 조회도 id 문자열로 한다.
 */
import { Circle, Ellipse, Path } from 'react-native-svg'

import { IconSvg, type IconProps } from './icon-base'

/**
 * 수익 아이콘 하나.
 *
 * `fill` 을 주면 **닫힌 모양(동전 두 개)만** 채워지고 단을 그리는 호 셋은 선으로 남는다. 호까지
 * 채우면 동전 사이의 단이 면에 묻혀 그림이 뭉개진다.
 *
 * @example
 * // 헤드라인 엠블럼. 크기와 색은 클래스가 정한다
 * <ProfitIcon className="h-[18px] w-[18px] text-primary-ink" strokeWidth={2} aria-hidden />
 *
 * @example
 * // 하단바. 클래스를 못 쓰는 자리라 색과 크기를 값으로 준다
 * <ProfitIcon color={color} size={22} fill={active ? color : 'none'} />
 */
export function ProfitIcon(props: IconProps): React.JSX.Element {
  return (
    <IconSvg testID="profit-icon" {...props}>
      {/* 더미: 윗면 타원 + 양 옆선 + 앞쪽 호 3개(호가 곧 동전 사이의 단이다). */}
      <Ellipse cx="16.3" cy="6.4" rx="5.2" ry="2.2" fill={props.fill ?? 'none'} />
      {/* 왼쪽 옆선은 앞 동전에 가리는 y=10.4 직전에서 끊는다. 오른쪽 옆선은 가리는 것이 없어
          바닥까지 내려간다. */}
      <Path d="M11.1 6.4v3.7" />
      <Path d="M21.5 6.4v8.2" />
      <Path d="M11.1 9.1a5.2 2.2 0 0 0 10.4 0" />
      {/* 아래 두 호는 앞 동전과 만나는 지점(원 둘레와의 교점)에서 시작한다. 그 앞부분이 잘려
          나가므로 상대(a) 대신 절대(A) 호로 끝점을 못 박는다. */}
      <Path d="M13.4 13.7A5.2 2.2 0 0 0 21.5 11.85" />
      <Path d="M13.7 16.5A5.2 2.2 0 0 0 21.5 14.6" />
      {/* 앞 동전: 더미보다 뒤에 그리면 위 선들이 위로 지나가므로 반드시 마지막에 둔다. */}
      <Circle cx="8" cy="15" r="5.5" fill={props.fill ?? 'none'} />
    </IconSvg>
  )
}
