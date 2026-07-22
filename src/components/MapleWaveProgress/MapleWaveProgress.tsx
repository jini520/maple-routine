import { useId } from 'react'
import { MAPLE_LEAF_PATH } from '../mapleLeafPath'

export interface MapleWaveProgressProps {
  percent: number
  size?: number
  className?: string
}

// 물결 한 주기(63.5)를 두 번 반복해 127 폭을 채운 뒤, translateX로 -127만큼 밀면 이음매 없이 반복된다.
const WAVE_SHAPE_D = 'M0,10 Q15.875,0 31.75,10 T63.5,10 T95.25,10 T127,10 V150 H0 Z'

// 수위(level)의 y좌표 범위 — 0%는 잎 아래로 완전히 빠지고, 100%는 물결 마루까지 잎 위로 완전히 잠긴다.
const LEVEL_Y_AT_0_PERCENT = 145
const LEVEL_Y_AT_100_PERCENT = -15

function WaveShapes(): React.JSX.Element {
  return (
    <g className="maple-wave-scroll">
      <path className="maple-wave-shape" d={WAVE_SHAPE_D} />
      <path className="maple-wave-shape" d={WAVE_SHAPE_D} transform="translate(127,0)" />
    </g>
  )
}

export function MapleWaveProgress(props: MapleWaveProgressProps): React.JSX.Element {
  const uid = useId()
  const leafClipId = `maple-wave-leaf-clip-${uid}`
  const waterClipId = `maple-wave-water-clip-${uid}`
  const size = props.size ?? 64
  const percent = props.percent
  const label = `${percent}%`
  const levelY =
    LEVEL_Y_AT_0_PERCENT - (percent / 100) * (LEVEL_Y_AT_0_PERCENT - LEVEL_Y_AT_100_PERCENT)
  const levelStyle: React.CSSProperties = { transform: `translateY(${levelY}px)` }

  return (
    <svg
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      width={size}
      height={size * (130 / 127)}
      viewBox="0 0 127 130"
      className={props.className}
    >
      <defs>
        <clipPath id={leafClipId} clipPathUnits="userSpaceOnUse">
          <path d={MAPLE_LEAF_PATH} />
        </clipPath>
        {/* 텍스트 반전 경계용 클립 — Chrome이 clipPath 자식으로 <g>(래퍼)를 지원하지 않아
            물결 모양 대신 현재 수위의 평균 높이에 맞춘 평평한 사각형으로 대체한다. */}
        <clipPath id={waterClipId} clipPathUnits="userSpaceOnUse">
          <rect className="maple-wave-water-line" x="-10" y={levelY + 10} width="147" height="150" />
        </clipPath>
      </defs>

      <path d={MAPLE_LEAF_PATH} className="maple-wave-outline" fill="none" />

      <g clipPath={`url(#${leafClipId})`}>
        <g className="maple-wave-level" style={levelStyle}>
          <WaveShapes />
        </g>
      </g>

      <g aria-hidden="true" clipPath={`url(#${leafClipId})`}>
        <text
          x="63.5"
          y="74"
          textAnchor="middle"
          dominantBaseline="middle"
          className="maple-wave-progress-text maple-wave-progress-text--empty"
        >
          {label}
        </text>
        <g clipPath={`url(#${waterClipId})`}>
          <text
            x="63.5"
            y="74"
            textAnchor="middle"
            dominantBaseline="middle"
            className="maple-wave-progress-text maple-wave-progress-text--filled"
          >
            {label}
          </text>
        </g>
      </g>
    </svg>
  )
}
