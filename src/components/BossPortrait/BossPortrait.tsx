import { getBossPortraitIconCrop, getBossPortraitUrl, type BossPortraitCrop } from '../../lib/boss-icons'

export interface BossPortraitProps {
  portraitSlug: string | null
  label: string
  size?: number // px, 기본값 40(보스 수익 화면 기존 h-10 크기)
  crop?: BossPortraitCrop // 없으면 boss-portrait-icon-crops.json에서 portraitSlug로 조회(없으면 cover/center)
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

  const crop = props.crop ?? getBossPortraitIconCrop(props.portraitSlug)

  return (
    <div
      role="img"
      aria-label={props.label}
      title={props.label}
      style={{
        ...style,
        backgroundImage: `url(${url})`,
        backgroundSize: crop.size,
        backgroundPosition: crop.position,
        backgroundRepeat: 'no-repeat',
      }}
      className="shrink-0 rounded-full"
    />
  )
}
