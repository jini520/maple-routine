import { getBossPortraitUrl } from '../../lib/boss-icons'

export interface BossPortraitProps {
  portraitSlug: string | null
  label: string
}

export function BossPortrait(props: BossPortraitProps): React.JSX.Element {
  const url = getBossPortraitUrl(props.portraitSlug)

  if (url === null) {
    return (
      <div
        title={props.label}
        aria-label={props.label}
        className="flex h-full w-full items-center justify-center rounded-full bg-surface-2 text-xs text-text-muted"
      >
        ?
      </div>
    )
  }

  return <img src={url} alt={props.label} className="h-full w-full rounded-full object-cover" />
}
