import { View } from 'react-native'

import { RingSpinner, Text } from '../../atoms'

/** 배지에 드는 아이콘. lucide 와 커스텀 아이콘이 함께 통하는 프롭만 받는다. */
export type ModalIcon = React.ComponentType<{
  className?: string
  strokeWidth?: number
  'aria-hidden'?: boolean
}>

/** 배지 색. 아이콘 색이 상속되지 않아 배경과 글자색을 갈라 둔다(`Svg` 의 `color` 로 내려간다). */
const TONE = {
  primary: { bg: 'bg-primary-tint', ink: 'text-primary-ink' },
  secondary: { bg: 'bg-secondary-tint', ink: 'text-secondary-ink' },
  third: { bg: 'bg-third-tint', ink: 'text-third-ink' },
  error: { bg: 'bg-error-tint', ink: 'text-error-ink' },
} as const

export type ModalTone = keyof typeof TONE

export interface ModalHeaderProps {
  /** 배지 아이콘. `busy` 면 그리지 않는다. */
  icon?: ModalIcon
  /** 기다리는 모달. 아이콘 자리에 링 스피너가 돈다. */
  busy?: boolean
  tone: ModalTone
  title: string
  description?: string
  /** 배지 · 설명의 testID 가 여기서 파생한다(`-badge` · `-description`). */
  testId?: string
  titleTestId?: string
}

/**
 * 가운데 모달의 머리 줄. 왼쪽 40 원 배지 옆에 제목과 설명을 세로로 둔다.
 *
 * @example <ModalHeader icon={CrownIcon} tone="primary" title={copy.title} description={copy.description} />
 */
export function ModalHeader(props: ModalHeaderProps): React.JSX.Element {
  const tone = TONE[props.tone]
  const Icon = props.icon

  return (
    <View className="flex-row items-center gap-3">
      <View
        testID={props.testId === undefined ? undefined : `${props.testId}-badge`}
        className={`h-10 w-10 items-center justify-center rounded-full ${tone.bg}`}
      >
        {props.busy === true ? (
          <RingSpinner size={20} />
        ) : (
          Icon !== undefined && <Icon className={`h-5 w-5 ${tone.ink}`} strokeWidth={1.75} aria-hidden />
        )}
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text testID={props.titleTestId} className="text-base font-semibold text-text">
          {props.title}
        </Text>
        {props.description !== undefined && (
          <Text
            testID={props.testId === undefined ? undefined : `${props.testId}-description`}
            className="text-xs text-text-muted"
          >
            {props.description}
          </Text>
        )}
      </View>
    </View>
  )
}
