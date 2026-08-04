// 결정형 진행률 바 — ADR-061 결정 6이 "예외 없이 h-1.5 프리미티브 하나"로 정한 것을
// 코드로 승격한 atom(ADR-094 결정 3). 그 전에는 같은 마크업이 9곳에 복붙돼 있었고,
// 그중 두 곳은 클래스 순서까지 달랐다.
//
// atom 규칙: 상태를 갖지 않고 토큰과 자기 상자만 안다. 값 계산(클램프·퍼센트 환산)은
// 호출부 몫이다 — 여기서 클램프하면 "왜 100을 넘겨도 안 넘치지"가 숨는다.

export interface ProgressBarProps {
  /** 채움 비율(0~100). 클램프하지 않는다 — 호출부가 이미 자기 단위로 계산해 넘긴다. */
  percent: number
  /**
   * 채움 색. 기본은 브랜드 강조(`primary`)이고, 컨텐츠 스케줄러의 카드 진행률만
   * `third` 를 쓴다(카드 배색과 충돌하지 않게).
   */
  tone?: 'primary' | 'third'
  /**
   * 접근성 값. 주면 `role="progressbar"` 와 `aria-*` 를 함께 낸다.
   *
   * 선택인 이유 — 기존 9곳 중 업데이트 모달 하나만 role·aria 없이 그리고 있어서,
   * 지금 붙이면 DOM 이 바뀐다(ADR-094 결정 4). 접근성 보강은 별도 변경으로 다룬다.
   */
  aria?: { now: number; max: number }
  /** 폭 변화에 트랜지션을 건다 — 값이 연속으로 흐르는 다운로드 진행률용. */
  animated?: boolean
  /** 채움 요소에 붙일 test id. */
  fillTestId?: string
}

export function ProgressBar(props: ProgressBarProps): React.JSX.Element {
  const tone = props.tone ?? 'primary'
  const fillClass = `h-1.5 rounded-full bg-${tone}${props.animated === true ? ' transition-[width]' : ''}`

  return (
    <div
      role={props.aria === undefined ? undefined : 'progressbar'}
      aria-valuenow={props.aria?.now}
      aria-valuemin={props.aria === undefined ? undefined : 0}
      aria-valuemax={props.aria?.max}
      className="h-1.5 w-full overflow-hidden rounded-full bg-track"
    >
      <div
        data-testid={props.fillTestId}
        className={fillClass}
        style={{ width: `${props.percent}%` }}
      />
    </div>
  )
}
