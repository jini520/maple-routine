import { getBossPortraitUrl } from '../../lib/boss-icons'
import type { BossDifficulty } from '../../types'

export interface BossPortraitProps {
  portraitSlug: string | null
  difficulty: BossDifficulty
  label: string
}

export function BossPortrait(props: BossPortraitProps): React.JSX.Element {
  const url = getBossPortraitUrl(props.portraitSlug, props.difficulty)

  if (url === null) {
    return (
      <div
        title={props.label}
        aria-label={props.label}
        className="flex h-full w-full items-center justify-center rounded-full bg-gray-200 text-xs text-gray-500"
      >
        ?
      </div>
    )
  }

  return <img src={url} alt={props.label} className="h-full w-full rounded-full object-cover" />
}
