/**
 * 옅은 원 안에 아이콘 하나를 둔 배지. 모달 머리 · 빈 상태 · 안내 줄 · 타일 머리가 쓴다.
 *
 * 지름은 네 단계이고 아이콘은 지름의 절반, 선 굵기는 1.75 하나다. 화면이 직접 그리면 다음 화면이 또 다른 지름을 고른다.
 *
 * @example
 * <IconBadge icon={MegaphoneIcon} size={32} className="shrink-0" />
 */
import { View } from 'react-native'

import { MapleLeaf } from '../Icon/MapleLeaf'
import { Spinner } from '../Spinner'

/** 배지에 드는 아이콘. lucide 와 커스텀 아이콘이 함께 통하는 프롭만 받는다. */
export type IconBadgeIcon = React.ComponentType<{
  className?: string
  strokeWidth?: number
  'aria-hidden'?: boolean
}>

/** 바탕과 아이콘 색. 아이콘 색이 상속되지 않아 둘을 갈라 둔다. `muted` 는 꺼진 타일의 회색 */
const TONE = {
  primary: { bg: 'bg-primary-tint', ink: 'text-primary-ink' },
  secondary: { bg: 'bg-secondary-tint', ink: 'text-secondary-ink' },
  third: { bg: 'bg-third-tint', ink: 'text-third-ink' },
  error: { bg: 'bg-error-tint', ink: 'text-error-ink' },
  muted: { bg: 'bg-surface-2', ink: 'text-text-disabled' },
} as const

const SIZE = {
  32: { box: 'h-8 w-8', icon: 'h-4 w-4' },
  40: { box: 'h-10 w-10', icon: 'h-5 w-5' },
  48: { box: 'h-12 w-12', icon: 'h-6 w-6' },
  64: { box: 'h-16 w-16', icon: 'h-8 w-8' },
} as const

export type IconBadgeTone = keyof typeof TONE
export type IconBadgeSize = keyof typeof SIZE

export interface IconBadgeProps {
  /** 원 안의 아이콘. `leaf` 는 단풍잎 마크. `busy` 면 그리지 않는다 */
  icon?: IconBadgeIcon | 'leaf'
  size: IconBadgeSize
  /** 주지 않으면 `primary` */
  tone?: IconBadgeTone
  /** 아이콘 대신 대기 스피너를 돌린다 */
  busy?: boolean
  testID?: string
  /** 바깥 배치(`shrink-0` 등). 크기와 색은 받지 않는다 */
  className?: string
}

export function IconBadge(props: IconBadgeProps): React.JSX.Element {
  const tone = TONE[props.tone ?? 'primary']
  const size = SIZE[props.size]
  const Icon = props.icon

  return (
    <View
      testID={props.testID}
      className={`${size.box} items-center justify-center rounded-full ${tone.bg}${props.className === undefined ? '' : ` ${props.className}`}`}
    >
      {props.busy === true ? (
        <Spinner size={props.size / 2} />
      ) : Icon === 'leaf' ? (
        <MapleLeaf size={props.size / 2} className={tone.ink} aria-hidden />
      ) : (
        Icon !== undefined && <Icon className={`${size.icon} ${tone.ink}`} strokeWidth={1.75} aria-hidden />
      )}
    </View>
  )
}
