/**
 * 상세(읽기 모드)의 알림 · 반복 타일 둘. 추가 시트의 체크 상자 자리에 값만 보인다.
 *
 * 켜져 있으면 주황 원 안 아이콘과 굵은 값, 꺼져 있으면 회색 원과 흐린 `없음` · `한 번만`.
 */
import { View } from 'react-native'

import { BellIcon, RepeatIcon, Text } from '../../components/atoms'
import { formatLead } from '../../features/party-appointments/draft'

function Tile(props: {
  icon: typeof BellIcon
  label: string
  value: string
  on: boolean
}): React.JSX.Element {
  const Icon = props.icon
  return (
    <View className="flex-1 flex-row items-center gap-2.5 rounded-xl bg-surface px-3 py-2.5">
      <View
        className={`h-[30px] w-[30px] items-center justify-center rounded-full ${props.on ? 'bg-primary-tint' : 'bg-surface-2'}`}
      >
        <Icon
          className={`h-[15px] w-[15px] ${props.on ? 'text-primary-ink' : 'text-text-disabled'}`}
          strokeWidth={2}
          aria-hidden
        />
      </View>
      <View className="shrink">
        <Text className="text-11 text-text-muted">{props.label}</Text>
        <Text className={`text-sm font-bold ${props.on ? 'text-text' : 'text-text-disabled'}`} numberOfLines={1}>
          {props.value}
        </Text>
      </View>
    </View>
  )
}

export interface AppointmentSummaryTilesProps {
  leadMinutes: number | null
  repeats: boolean
  /** 반복 요일(`목`) */
  weekday: string
}

export function AppointmentSummaryTiles(props: AppointmentSummaryTilesProps): React.JSX.Element {
  return (
    <View className="flex-row gap-2 px-4">
      <Tile
        icon={BellIcon}
        label="알림"
        value={props.leadMinutes === null ? '없음' : formatLead(props.leadMinutes)}
        on={props.leadMinutes !== null}
      />
      <Tile
        icon={RepeatIcon}
        label="반복"
        value={props.repeats ? `매주 ${props.weekday}요일` : '한 번만'}
        on={props.repeats}
      />
    </View>
  )
}
