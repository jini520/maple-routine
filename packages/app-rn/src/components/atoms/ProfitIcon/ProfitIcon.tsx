// "수익"을 가리키는 세 자리(하단 탭바 · 총 수익 헤드라인 엠블럼 · 처치 0건 빈 상태)가 공유하는
// 아이콘([[ADR-066]], 이슈 #56). 원통형 동전 더미 뒤에 앞 동전 하나가 겹친 입체 라인 드로잉으로,
// 사용자가 고른 그림이 lucide 에 없어 직접 그렸다.
//
// lucide 규격을 그대로 따른다([[ADR-066]] 결정 3) — 24 그리드 · fill none · currentColor · 라운드
// 캡/조인 · 기본 strokeWidth 2 · 크기는 className 이 정한다. 이 규격을 벗어나면 같은 줄에 선
// lucide 아이콘(ListChecks·Swords·Settings)과 선 굵기·광학 크기가 어긋난다. RN 에서 그 짝은
// `lucide-react-native` 이고, 그쪽도 같은 규격으로 그린다.
//
// 좌표는 웹과 **한 글자도 다르지 않다** — 겹침을 clipPath·mask 가 아니라 좌표로 표현한 것이
// [[ADR-066]] 결정 4이고, 그 결정의 근거(한 문서에 여러 번 렌더되면 id 가 중복된다)는 RN 에서 오히려
// 더 강하다(`react-native-svg` 의 defs 조회도 id 문자열로 한다).
//
// RN 으로 옮기며 바뀐 것은 `data-testid` → `testID` 와 태그 이름(대문자)뿐이다. `currentColor` 는
// `Svg` 의 `color` 프롭에서 오고, 그 프롭은 호출부의 `className="text-primary"` 에서 온다
// (`lib/nativewind-interop` 이 배선한다).
import { Circle, Ellipse, Path } from 'react-native-svg'

import { Svg } from '../../../lib/nativewind-interop'

interface ProfitIconProps {
  className?: string
  strokeWidth?: number
  'aria-hidden'?: boolean
}

export function ProfitIcon(props: ProfitIconProps): React.JSX.Element {
  return (
    <Svg
      testID="profit-icon"
      // 크기는 호출부의 className 이 정한다. width/height 는 lucide 와 같은 폴백일 뿐이고
      // (`h-5 w-5` 가 오면 그쪽이 이긴다 — 웹에서 CSS 가 속성을 이기던 것과 같은 순서를
      // `nativeStyleToProp` 이 만든다), 이게 없으면 className 없이 쓰는 순간 상자가 사라진다.
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={props.strokeWidth ?? 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden={props['aria-hidden']}
    >
      {/* 더미: 윗면 타원 + 양 옆선 + 앞쪽 호 3개(호가 곧 동전 사이의 단이다). */}
      <Ellipse cx="16.3" cy="6.4" rx="5.2" ry="2.2" />
      {/* 왼쪽 옆선은 앞 동전에 가리는 y=10.4 직전에서 끊는다 — 겹침을 mask 가 아니라 좌표로
          표현한다([[ADR-066]] 결정 4). 오른쪽 옆선은 가리는 것이 없어 바닥까지 내려간다. */}
      <Path d="M11.1 6.4v3.7" />
      <Path d="M21.5 6.4v8.2" />
      <Path d="M11.1 9.1a5.2 2.2 0 0 0 10.4 0" />
      {/* 아래 두 호는 앞 동전과 만나는 지점(원 둘레와의 교점)에서 시작한다 — 그 앞부분이
          잘려 나가므로 상대(a) 대신 절대(A) 호로 끝점을 못 박는다. */}
      <Path d="M13.4 13.7A5.2 2.2 0 0 0 21.5 11.85" />
      <Path d="M13.7 16.5A5.2 2.2 0 0 0 21.5 14.6" />
      {/* 앞 동전: 더미보다 뒤에 그리면 위 선들이 위로 지나가므로 반드시 마지막에 둔다. */}
      <Circle cx="8" cy="15" r="5.5" />
    </Svg>
  )
}
