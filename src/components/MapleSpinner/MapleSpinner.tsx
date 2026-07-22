import { MAPLE_LEAF_PATH } from '../mapleLeafPath'

export interface MapleSpinnerProps {
  size?: number
  className?: string
}

export function MapleSpinner(props: MapleSpinnerProps): React.JSX.Element {
  const size = props.size ?? 20

  return (
    <svg
      data-testid="maple-spinner"
      aria-hidden="true"
      width={size}
      height={size * (130 / 127)}
      viewBox="0 0 127 130"
      className={props.className}
    >
      <path
        d={MAPLE_LEAF_PATH}
        pathLength={300}
        fill="none"
        stroke="currentColor"
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray="210 90"
        className="animate-maple-trail motion-reduce:animate-none"
      />
    </svg>
  )
}
