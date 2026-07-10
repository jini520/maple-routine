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
      <div className="flex items-center justify-center text-center rounded-[14px] bg-gray-200 text-gray-500 text-xs p-2">
        {props.label}
      </div>
    )
  }

  return <img src={url} alt={props.label} className="rounded-[14px]" />
}
