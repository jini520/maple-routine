/**
 * 등록 시트의 알림 칸. `알림` 체크 상자가 쓸지를 정하고, 켜면 알약 줄에서 몇 분 전인지 고른다. 끄면 알약은 흐리게 막힌다.
 *
 * `직접` 은 그 알약 아래에 `시간 | 분 전` 휠 팝오버를 띄운다. 체크 상자 오른쪽의 사용량은 시작 날짜에 이 약속을
 * 뺀 알림 수이고, 셋이 찼으면 체크 상자를 켤 수 없다(하루 알림 한도).
 */
import { forwardRef } from 'react'
import { Pressable, View } from 'react-native'

import { CheckBox, Text } from '../../components/atoms'
import { TimePopover } from '../../components/organisms/TimePopover/TimePopover'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { LEAD_PRESETS, MINUTE_STEP, formatLead } from '../../features/party-appointments/draft'
import { DAILY_ALARM_LIMIT } from '../../features/party-appointments/guards'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'

export interface AppointmentAlarmFieldProps {
  alarmOn: boolean
  leadMinutes: number
  startDateKey: string
  /** 시작 날짜에 이미 달린 다른 약속의 알림 수 */
  usedOnDate: number
  /** 사용량 앞의 날 이름. 없으면 시작 날짜(`10/1`)이고 반복 약속은 `목요일` 이다 */
  dayLabel?: string
  onToggle: (on: boolean) => void
  onChangeLead: (leadMinutes: number) => void
}

interface PillProps {
  label: string
  selected: boolean
  /** 알림이 꺼져 있다. 알약은 그대로 서되 흐리고 못 누른다 */
  disabled: boolean
  onPress: () => void
}

/** 팝오버가 `직접` 알약을 재서 그 아래에 앉으므로 ref 를 받는다 */
const Pill = forwardRef<View, PillProps>(function Pill(props, ref) {
  return (
    <Pressable
      ref={ref}
      role="button"
      aria-label={props.label}
      aria-selected={props.selected}
      aria-disabled={props.disabled}
      disabled={props.disabled}
      onPress={props.onPress}
      className={`rounded-full px-2.5 py-1 ${props.selected && !props.disabled ? 'bg-primary' : 'bg-surface-2'}${
        props.disabled ? ' opacity-50' : ''
      }`}
    >
      <Text
        className={`text-xs font-semibold ${props.selected && !props.disabled ? 'text-on-primary' : 'text-text-disabled'}`}
      >
        {props.label}
      </Text>
    </Pressable>
  )
})

export function AppointmentAlarmField(props: AppointmentAlarmFieldProps): React.JSX.Element {
  const { ref: customRef, isOpen: customOpen, anchor: customAnchor, toggle: toggleCustom, close: closeCustom } =
    useAnchoredPopover()
  const full = props.usedOnDate >= DAILY_ALARM_LIMIT
  // 이미 켜 둔 것은 끌 수 있어야 한다. 막는 것은 새로 켜는 쪽뿐이다.
  const toggleDisabled = full && !props.alarmOn
  const isCustom = !LEAD_PRESETS.includes(props.leadMinutes)
  const date = new Date(`${props.startDateKey}T00:00:00Z`)

  return (
    <View className="gap-2 px-4">
      <View className="flex-row items-center justify-between">
        <Pressable
          role="checkbox"
          aria-label="알림"
          aria-checked={props.alarmOn}
          aria-disabled={toggleDisabled}
          disabled={toggleDisabled}
          onPress={() => props.onToggle(!props.alarmOn)}
          className={`flex-row items-center gap-2 py-1${toggleDisabled ? ' opacity-40' : ''}`}
        >
          <CheckBox checked={props.alarmOn} />
          <Text className="text-sm font-medium text-text">알림</Text>
        </Pressable>
        <Text
          className={`text-11 font-semibold ${full ? 'text-error-ink' : 'text-text-muted'}`}
          style={TABULAR_NUMS}
        >
          {props.dayLabel ?? `${date.getUTCMonth() + 1}/${date.getUTCDate()}`} 알림 {props.usedOnDate + (props.alarmOn ? 1 : 0)}/
          {DAILY_ALARM_LIMIT}
        </Text>
      </View>

      {/* 알림을 꺼도 알약 줄은 접지 않는다. 흐리게 막아 두어, 켜면 무엇을 고를 수 있는지 미리 보인다. */}
      <View className="flex-row flex-wrap gap-1.5">
        {LEAD_PRESETS.map((lead) => (
          <Pill
            key={lead}
            label={formatLead(lead)}
            selected={props.leadMinutes === lead}
            disabled={!props.alarmOn}
            onPress={() => props.onChangeLead(lead)}
          />
        ))}
        <Pill
          ref={customRef}
          label={isCustom ? `직접 · ${formatLead(props.leadMinutes)}` : '직접'}
          selected={isCustom}
          disabled={!props.alarmOn}
          onPress={toggleCustom}
        />
      </View>

      {customOpen && (
        <TimePopover
          minutes={props.leadMinutes}
          step={MINUTE_STEP}
          units={{ hour: '시간', minute: '분 전' }}
          anchor={customAnchor}
          onConfirm={(lead) => {
            props.onChangeLead(lead)
            closeCustom()
          }}
          onClose={closeCustom}
        />
      )}
    </View>
  )
}
