import { ClockIcon, InfoIcon, Text } from '../../atoms'

import { View } from 'react-native'

/** 기간 조회 하한은 실측 13일이지만 넥슨 한도 자체는 14일이라 **문구는 14일**이다. */
const COPY = {
  outOfRange: {
    icon: InfoIcon,
    title: '이 기간은 조회할 수 없습니다',
    description: '조회 가능한 기간(최근 14일)을 지나 확인할 수 없습니다. 처치 기록이 없다는 뜻은 아닙니다',
    box: 'border border-border bg-info-tint',
    iconColor: 'text-info-ink',
  },
  notCollected: {
    icon: ClockIcon,
    title: '아직 집계되지 않았습니다',
    description: '이 기간 기록이 준비되면 자동으로 채워집니다',
    box: 'border border-border bg-surface-2',
    iconColor: 'text-text-muted',
  },
} as const

export type UnavailableNoticeVariant = keyof typeof COPY

interface UnavailableNoticeProps {
  /** 기본값은 `outOfRange` — 기존 호출부(롤링 윈도우 밖)의 의미를 그대로 유지한다. */
  variant?: UnavailableNoticeVariant
  /** 캐릭터 카드 안처럼 이미 카드에 중첩될 때 — 한 단계 축소하고 설명을 생략한다. */
  compact?: boolean
}

export function UnavailableNotice(props: UnavailableNoticeProps): React.JSX.Element {
  const copy = COPY[props.variant ?? 'outOfRange']
  const Icon = copy.icon

  if (props.compact === true) {
    return (
      <View testID="unavailable-notice" className="mx-4 my-3 rounded-[10px] bg-surface-2 px-3 py-2.5">
        <View className="flex-row items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-text-muted" strokeWidth={1.75} aria-hidden />
          <Text className="text-xs text-text-muted">{copy.title}</Text>
        </View>
      </View>
    )
  }

  return (
    <View testID="unavailable-notice" className={`flex-row items-start gap-3 rounded-[14px] p-4 ${copy.box}`}>
      <Icon className={`h-5 w-5 shrink-0 ${copy.iconColor}`} strokeWidth={1.75} aria-hidden />
      <View className="gap-0.5">
        <Text className="text-sm font-semibold text-text">{copy.title}</Text>
        <Text testID="unavailable-notice-description" className="text-xs text-text-muted">
          {copy.description}
        </Text>
      </View>
    </View>
  )
}
