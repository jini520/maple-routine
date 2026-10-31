/**
 * `TrackingModeModal` 안에 들어가는 선택 목록. 모달 자체가 카드 역할을 하므로 여기서는 카드
 * 테두리를 다시 두르지 않는다.
 *
 * 문구는 `features/tracking-mode/copy` 가 갖는다. 여기 손으로 적으면 같은 선택지의 설명이 두
 * 벌이 된다. 규격은 `docs/features/settings.md` 의 트래킹 모드 옵션 카드.
 */
import { Pressable, View } from 'react-native'

import { TRACKING_MODE_OPTIONS } from '../../features/tracking-mode/copy'
import type { TrackingMode } from '../../storage/tracking-mode'

import { withAlpha } from '../../lib/color'
import { useThemeAppearance } from '../../theme/context'

import { CheckIcon, Gamepad2Icon, InfoIcon, ListChecksIcon, Text } from '../../components/atoms'

export interface TrackingModeSelectorProps {
  mode: TrackingMode
  /** 시드가 진행 중인지. 참이면 옵션이 비활성이다. */
  isApplying: boolean
  onSelect: (mode: TrackingMode) => void
}

// 자동은 게임에서 정한 것을 따른다 는 주어를, 수동은 앱에서 고른다 를 가리킨다. RefreshCw(동기화)는
// 이 앱에서 새로고침 버튼의 기능 신호라 누를 수 없는 자리에 두면 뜻이 흐려져 기각했다.
const OPTION_ICONS = { auto: Gamepad2Icon, manual: ListChecksIcon } as const

export function TrackingModeSelector(props: TrackingModeSelectorProps): React.JSX.Element {
  const { definition } = useThemeAppearance()
  return (
    <View className="gap-1.5">
      {TRACKING_MODE_OPTIONS.map((option) => {
        const isSelected = props.mode === option.mode
        const Icon = OPTION_ICONS[option.mode]
        return (
          <Pressable
            key={option.mode}
            role="button"
            aria-selected={isSelected}
            disabled={props.isApplying}
            onPress={() => props.onSelect(option.mode)}
            // 고른 칸은 테두리 대신 `primary-tint` 바탕으로 가린다. 패널 안 칸에는 테두리를 긋지 않는다.
            className={`gap-1.5 rounded-[10px] px-3 py-2.5 ${isSelected ? 'bg-primary-tint' : 'bg-card-inset'}${
              props.isApplying ? ' opacity-50' : ''
            }`}
          >
            <View className="flex-row items-start gap-2.5">
              <Icon className="mt-px h-[18px] w-[18px] flex-none text-primary-ink" aria-hidden />
              <View className="min-w-0 flex-1 gap-px">
                <Text className="text-sm font-semibold text-text">{option.title}</Text>
                <Text className="text-xs text-text-muted">{option.description}</Text>
              </View>
              {/* 원은 여럿 중 하나를 고르는 표시다. 체크박스의 네모와 갈린다. */}
              {isSelected ? (
                <View className="h-[18px] w-[18px] items-center justify-center rounded-full bg-primary">
                  <CheckIcon className="h-3 w-3 text-on-primary" strokeWidth={2.5} aria-hidden />
                </View>
              ) : (
                <View className="h-[18px] w-[18px] rounded-full" style={{ backgroundColor: withAlpha(definition.text, 0.14) }} />
              )}
            </View>
            {/* 고칠 수 없는 알려진 제약이라 실패(error)가 아니라 고지다. */}
            <View className="flex-row items-start gap-1.5 pl-7">
              <InfoIcon className="mt-0.5 h-[13px] w-[13px] flex-none text-text-muted" strokeWidth={2} aria-hidden />
              <Text className="min-w-0 flex-1 text-xs text-text-muted">{option.caution}</Text>
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}
