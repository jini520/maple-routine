// 스케줄 관리 방법(자동/수동) 선택 — 이 앱 온보딩의 **둘째** 단계다(
//  로 계정 선택·예열이 앞에서 빠졌다).
//
// 카드 박스 없이 배경 위에 바로 놓이는 페이지 레이아웃(`ApiKeyForm` 과 동일)을 따르고, 바깥 선택
// 카드 클래스는 설정 `ThemeSelector` 와 계속 공유한다 — 결정 22 가 푼 것은 카드
// **안쪽**뿐이다. 카드 안쪽(아이콘·설명·주의 박스)은 설정 `TrackingModeSelector` 와 같은 모양이어야
// 한다(공용 카피 `features/tracking-mode/copy` 를 함께 쓰므로 한쪽만 고치면 같은 선택지가 두 화면에서
// 다르게 생긴다) — 규격은 `docs/features/settings.md`.
//
// 설명·주의는 접지 않고 항상 보여준다(고르기 **전에** 둘을 비교하는 화면이다). 기본 선택은 없으며,
// 사용자가 직접 고르기 전까지 "계속하기"를 비활성화한다(결정 17).
//
// ── RN 으로 옮기며 갈린 것 셋 ─────────────────────────────────────────────────────
//
// ① **`aria-pressed` → `aria-selected`.** RN 의 접근성 상태에 *pressed* 가 없다
//    (`DifficultySegment` 와 같은 판단) — 전달되는 사실은 같다.
// ② 글자 클래스가 상자에서 안쪽 `Text` 로 내려온다(RN 은 글자 스타일이 상속되지 않는다). 웹에서
//    `<span className="text-xs text-info-ink">` 하나가 아이콘 색과 글자를 함께 정하던 주의 박스는
//    상자(`bg-info-tint`)·아이콘(`text-info-ink`)·글자(`text-xs text-info-ink`)로 나뉜다.
// ③ `hover:bg-primary-tint` 제거(터치 기기에 hover 가 없다 — atoms 와 같은 규칙).
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { TRACKING_MODE_OPTIONS } from '../../features/tracking-mode/copy'
import type { TrackingMode } from '../../storage/tracking-mode'

import { Button, Gamepad2Icon, InfoIcon, ListChecksIcon, Text } from '../../components/atoms'

// 자동은 "게임에서 정한 것을 따른다"는 주어를 가리키고, 수동은 "앱에서 고른다"를 가리킨다
// . RefreshCw(동기화)는 이 앱에서 새로고침 버튼의 기능 신호라 누를 수 없는
// 자리에 두면 뜻이 흐려져 기각했다.
const OPTION_ICONS = { auto: Gamepad2Icon, manual: ListChecksIcon } as const

export interface TrackingModeStepProps {
  onSubmit: (mode: TrackingMode) => void
}

export function TrackingModeStep(props: TrackingModeStepProps): React.JSX.Element {
  const [mode, setMode] = useState<TrackingMode | null>(null)

  return (
    <View className="w-full gap-4">
      <View className="gap-1">
        <Text className="text-lg font-semibold text-text">스케줄러를 어떻게 관리할까요?</Text>
        <Text className="text-sm text-text-muted">나중에 설정에서 언제든 바꿀 수 있어요.</Text>
      </View>

      <View className="gap-2">
        {TRACKING_MODE_OPTIONS.map((option) => {
          const isSelected = mode === option.mode
          const Icon = OPTION_ICONS[option.mode]
          return (
            <Pressable
              key={option.mode}
              role="button"
              aria-selected={isSelected}
              onPress={() => setMode(option.mode)}
              className={
                isSelected
                  ? 'rounded-[10px] border border-primary bg-primary-tint px-4 py-3'
                  : 'rounded-[10px] border border-border px-4 py-3'
              }
            >
              <View className="flex-row items-start gap-3">
                <Icon className="h-5 w-5 flex-none text-primary-ink" aria-hidden />
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold text-text">{option.title}</Text>
                  <Text className="mt-0.5 text-sm text-text-muted">{option.description}</Text>
                </View>
              </View>
              {/* 고칠 수 없는 알려진 제약이라 실패(error)가 아니라 고지다 — `UnavailableNotice` 와
                  같은 정보 톤을 카드 안 크기로 승계한다. */}
              <View className="mt-2 flex-row items-start gap-1.5 rounded-[8px] bg-info-tint px-2.5 py-1.5">
                <InfoIcon className="mt-px h-3.5 w-3.5 flex-none text-info-ink" strokeWidth={1.75} aria-hidden />
                <Text className="min-w-0 flex-1 text-xs text-info-ink">{option.caution}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>

      <Button
        variant="primary"
        disabled={mode === null}
        onPress={() => {
          if (mode !== null) props.onSubmit(mode)
        }}
        className={`w-full items-center${mode === null ? ' opacity-50' : ''}`}
      >
        계속하기
      </Button>
    </View>
  )
}
