import { getBossPortraitUrl } from '../../lib/boss-icons'

export interface BossPortraitProps {
  portraitSlug: string | null
  label: string
  size?: number // px, 기본값 40(보스 수익 화면 기존 h-10 크기)
}

export function BossPortrait(props: BossPortraitProps): React.JSX.Element {
  const size = props.size ?? 40
  const style = { width: size, height: size }
  const url = getBossPortraitUrl(props.portraitSlug)

  if (url === null) {
    return (
      <div
        title={props.label}
        aria-label={props.label}
        style={style}
        className="flex shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs text-text-muted"
      >
        ?
      </div>
    )
  }

  return <img src={url} alt={props.label} style={style} className="shrink-0 rounded-full object-cover" />
}
