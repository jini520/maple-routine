/**
 * TrackingModeModal 안에 들어가는 선택 목록. 모달 자체가 카드 역할을 하므로 여기서는 카드
 * 테두리를 다시 두르지 않는다. 문구와 **카드 안쪽 구조** 모두 온보딩 `TrackingModeStep` 과 같아야
 * 한다. 공용 카피 `features/tracking-mode/copy` 를 함께 쓰므로 한쪽만 고치면
 * 같은 선택지가 두 화면에서 다르게 생긴다. 규격은 `docs/features/settings.md` `트래킹 모드 옵션 카드`.
 *
 * **RN 에서 갈린 것은 온보딩 쪽과 완전히 같다**. 그쪽 파일(`app/onboarding/TrackingModeStep.tsx`)
 * 머리의 셋(`aria-pressed`→`aria-selected` · 글자 클래스가 안쪽 `Text` 로 · `hover:` 제거)을 그대로
 * 따른다. 두 화면이 같은 모양이어야 한다는 결정 22 가 **갈라지는 방식까지** 같기를 요구한다.
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

// 온보딩 TrackingModeStep과 같은 뜻의 아이콘을 쓴다. 선택 이유는 그쪽 파일 주석.
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
