import { useId } from 'react'
import { MAPLE_LEAF_PATH } from '../../mapleLeafPath'

export interface MapleSweepSpinnerProps {
  size?: number
  className?: string
}

// 띠는 잎 아래(y=140, viewBox 밖)에서 시작해 위로 230px 이동하며 잎을 완전히 통과한다.
// 차오르는 방향인 것은 의도다 — 폐기된 MapleWaveProgress(잎 안에 물이 차오르던 결정형 진행률)의
// 감각을 비결정형 쪽에서 이어받는다([[ADR-061]] 결정 1).
const BAND_START_Y = 140
const BAND_HEIGHT = 80

// 24px 이상 자리 전용 스피너([[ADR-061]]). 16px 버튼 안에서는 띠가 잎보다 커져 움직임이 안 읽히므로
// 그 크기에는 MapleSpinner(트레일 링)를 쓴다.
export function MapleSweepSpinner(props: MapleSweepSpinnerProps): React.JSX.Element {
  const uid = useId()
  const size = props.size ?? 32
  const clipId = `maple-sweep-clip-${uid}`
  const gradientId = `maple-sweep-gradient-${uid}`

  return (
    <svg
      data-testid="maple-sweep-spinner"
      aria-hidden="true"
      width={size}
      height={size * (130 / 127)}
      viewBox="0 0 127 130"
      className={props.className}
    >
      <defs>
        {/* clipPath의 직접 자식은 <path>·<rect> 같은 도형이어야 한다 — <g>로 묶으면 Chrome이
            조용히 무시해 빈 클립이 된다(에러도 경고도 없다, MapleWaveProgress에서 겪은 트랩). */}
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <path d={MAPLE_LEAF_PATH} />
        </clipPath>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
          <stop offset="50%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 바탕 잎 — 띠가 지나가지 않는 동안에도 형태가 남아 "무엇을 기다리는지"가 보인다.
          모션이 꺼진 환경(motion-reduce)에서는 이 바탕만 정적으로 남는다. */}
      <path d={MAPLE_LEAF_PATH} fill="currentColor" opacity={0.32} />

      <g clipPath={`url(#${clipId})`}>
        <rect
          className="animate-maple-sweep motion-reduce:animate-none"
          x="-10"
          y={BAND_START_Y}
          width="147"
          height={BAND_HEIGHT}
          fill={`url(#${gradientId})`}
        />
      </g>
    </svg>
  )
}
