/**
 * 등록 시트의 알림 칸. `알림` 체크 상자가 쓸지를 정하고, 켜면 알약 줄에서 몇 분 전인지 고른다. 끄면 알약은 흐리게 막힌다.
 *
 * `직접` 은 그 알약 아래에 `시간 | 분 전` 휠 팝오버를 띄운다. 켤 때의 확인은 시트가 한다.
 */
import { forwardRef } from 'react'
import { Pressable, View } from 'react-native'

import { CheckBox, Text } from '../../components/atoms'
import { TimePopover } from '../../components/organisms/TimePopover/TimePopover'
import { LEAD_PRESETS, MINUTE_STEP, formatLead } from '../../features/party-appointments/draft'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'

export interface AppointmentAlarmFieldProps {
  alarmOn: boolean
  leadMinutes: number
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
  const isCustom = !LEAD_PRESETS.includes(props.leadMinutes)

  return (
    <View className="gap-2 px-4">
      <Pressable
        role="checkbox"
        aria-label="알림"
        aria-checked={props.alarmOn}
        onPress={() => props.onToggle(!props.alarmOn)}
        className="flex-row items-center gap-2 self-start py-1"
      >
        <CheckBox checked={props.alarmOn} />
        <Text className="text-sm font-medium text-text">알림</Text>
      </Pressable>

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
