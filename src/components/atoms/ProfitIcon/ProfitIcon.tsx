// "수익"을 가리키는 세 자리(하단 탭바 · 총 수익 헤드라인 엠블럼 · 처치 0건 빈 상태)가 공유하는
// 아이콘([[ADR-066]], 이슈 #56). 원통형 동전 더미 뒤에 앞 동전 하나가 겹친 입체 라인 드로잉으로,
// 사용자가 고른 그림이 lucide에 없어 직접 그렸다.
//
// lucide 규격을 그대로 따른다(ADR-066 결정 3) — 24 그리드 · fill none · currentColor · 라운드
// 캡/조인 · 기본 strokeWidth 2 · 크기는 className이 정한다. 이 규격을 벗어나면 같은 줄에 선
// lucide 아이콘(ListChecks·Swords·Settings)과 선 굵기·광학 크기가 어긋난다.

interface ProfitIconProps {
  className?: string
  strokeWidth?: number
  'aria-hidden'?: React.AriaAttributes['aria-hidden']
}

export function ProfitIcon(props: ProfitIconProps): React.JSX.Element {
  return (
    <svg
      data-testid="profit-icon"
      // 크기는 호출부의 className이 정한다. width/height는 lucide와 같은 폴백일 뿐이고(CSS가
      // 속성보다 우선하므로 h-5 w-5가 항상 이긴다), 이게 없으면 className 없이 쓰는 순간
      // 인라인 SVG 기본값 300×150으로 부풀어 오른다.
      width="24"
      height="24"
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
      <ellipse cx="16.3" cy="6.4" rx="5.2" ry="2.2" />
      {/* 왼쪽 옆선은 앞 동전에 가리는 y=10.4 직전에서 끊는다 — 겹침을 mask가 아니라 좌표로
          표현한다(ADR-066 결정 4). 오른쪽 옆선은 가리는 것이 없어 바닥까지 내려간다. */}
      <path d="M11.1 6.4v3.7" />
      <path d="M21.5 6.4v8.2" />
      <path d="M11.1 9.1a5.2 2.2 0 0 0 10.4 0" />
      {/* 아래 두 호는 앞 동전과 만나는 지점(원 둘레와의 교점)에서 시작한다 — 그 앞부분이
          잘려 나가므로 상대(a) 대신 절대(A) 호로 끝점을 못 박는다. */}
      <path d="M13.4 13.7A5.2 2.2 0 0 0 21.5 11.85" />
      <path d="M13.7 16.5A5.2 2.2 0 0 0 21.5 14.6" />
      {/* 앞 동전: 더미보다 뒤에 그리면 위 선들이 위로 지나가므로 반드시 마지막에 둔다. */}
      <circle cx="8" cy="15" r="5.5" />
    </svg>
  )
}
