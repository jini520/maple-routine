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

import { Gamepad2Icon, InfoIcon, ListChecksIcon, Text } from '../../components/atoms'

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
  return (
    <View className="gap-2">
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
            className={`rounded-[10px] border px-4 py-3 ${
              isSelected ? 'border-primary bg-primary-tint' : 'border-border'
            }${props.isApplying ? ' opacity-50' : ''}`}
          >
            <View className="flex-row items-start gap-3">
              <Icon className="h-5 w-5 flex-none text-primary-ink" aria-hidden />
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-semibold text-text">{option.title}</Text>
                <Text className="mt-0.5 text-sm text-text-muted">{option.description}</Text>
              </View>
            </View>
            {/* 고칠 수 없는 알려진 제약이라 실패(error)가 아니라 고지다. `UnavailableNotice` 와
                같은 정보 톤을 카드 안 크기로 승계한다. */}
            <View className="mt-2 flex-row items-start gap-1.5 rounded-[8px] bg-info-tint px-2.5 py-1.5">
              <InfoIcon
                className="mt-px h-3.5 w-3.5 flex-none text-info-ink"
                strokeWidth={1.75}
                aria-hidden
              />
              <Text className="min-w-0 flex-1 text-xs text-info-ink">{option.caution}</Text>
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}
