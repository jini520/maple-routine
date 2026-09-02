/**
 * ThemeModal 안에 들어가는 선택 목록. 모달 자체가 카드 역할을 하므로 여기서는 카드 테두리를
 * 다시 두르지 않는다.
 *
 * **테마 이름을 손으로 적지 않는다**. 목록·카테고리·모드가 전부
 * `job-themes.json` 에서 파생된 레지스트리에서 온다. 테마 하나를 더하는 일이 JSON 한 블록으로
 * 끝난다는 것이 그 결정의 요점이고, 화면이 이름을 열거하는 순간 그것이 깨진다.
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { THEME_NAMES, getThemeDefinition, groupThemesByCategory } from '../../lib/theme/theme-registry'
import type { ThemeName } from '../../types/theme'

import { CheckIcon, MoonIcon, SunIcon, Text } from '../../components/atoms'

export interface ThemeSelectorProps {
  theme: ThemeName
  onSelect: (theme: ThemeName) => void
}

/**
 * 라이트·다크 필터.
 *
 * 카테고리와 모드는 **직교하는 축**이라 둘 다 섹션 제목이 될 수 없다. 카테고리가 제목을 갖고
 * 모드는 필터가 된다. 상태를 저장하지 않는 것도 결정의 일부다. 모달을 다시 열면 전체로 돌아온다.
 */
const MODE_FILTERS = ['전체', '라이트', '다크'] as const
type ModeFilter = (typeof MODE_FILTERS)[number]

const FILTERED_MODE: Record<ModeFilter, 'light' | 'dark' | null> = {
  전체: null,
  라이트: 'light',
  다크: 'dark',
}

// 탭 토글 모양은 design-system `탭 토글`을 그대로 쓴다. 새 스타일을 만들지 않는다.
// 글자가 상속되지 않아 배경과 글자를 두 벌로 갈라 둔다.
const CHIP_CLASS = 'rounded-full px-3 py-[5px]'
const CHIP_ACTIVE_CLASS = `${CHIP_CLASS} bg-primary-tint`
const CHIP_TEXT_ACTIVE = 'text-sm font-semibold text-primary-ink'
const CHIP_TEXT_IDLE = 'text-sm font-medium text-text-muted'

export function ThemeSelector(props: ThemeSelectorProps): React.JSX.Element {
  const [filter, setFilter] = useState<ModeFilter>('전체')

  const mode = FILTERED_MODE[filter]
  const visible = THEME_NAMES.filter(
    (name) => mode === null || getThemeDefinition(name).mode === mode,
  )

  return (
    <View className="gap-4">
      <View className="flex-row items-center gap-1">
        {MODE_FILTERS.map((option) => (
          <Pressable
            key={option}
            role="button"
            aria-label={option}
            aria-selected={filter === option}
            onPress={() => setFilter(option)}
            className={filter === option ? CHIP_ACTIVE_CLASS : CHIP_CLASS}
          >
            <Text className={filter === option ? CHIP_TEXT_ACTIVE : CHIP_TEXT_IDLE}>{option}</Text>
          </Pressable>
        ))}
      </View>

      {groupThemesByCategory(visible).map((group) => (
        <View key={group.category} className="gap-2">
          <Text
            testID="theme-category-heading"
            className="text-xs font-semibold tracking-wide text-text-muted"
          >
            {group.category}
          </Text>
          {/* CSS Grid 가 없어 `grid-cols-2` 를 **셀 패딩 + 줄 음수 마진**으로 만든다.
              **`w-[calc(50%-5px)]` + `gap` 으로 두면 안 된다**. NativeWind 가 그 `calc()` 를
              만들지 않아 폭이 통째로 빠지고, 카드가 **글자 길이대로** 늘어나 한 줄에 셋이 서기도
              한다(2026-08-13 실기기 관측: `엔젤릭버스터`만 넓었다). 에러도 경고도 없다.
              간격 10px 은 셀 패딩 5px 두 개가 만들고, 바깥으로 삐져나온 5px 은 줄의 `-m` 이 뺀다. */}
          <View className="-m-[5px] flex-row flex-wrap">
            {group.themes.map((name) => (
              <ThemeTile
                key={name}
                name={name}
                isSelected={props.theme === name}
                onSelect={props.onSelect}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}

interface ThemeTileProps {
  name: ThemeName
  isSelected: boolean
  onSelect: (theme: ThemeName) => void
}

/**
 * 그 테마의 화면을 축소해 보여주는 타일.
 *
 * 색은 **활성 테마의 토큰이 아니라 레지스트리에서 직접** 읽는다. 비활성 테마의 색을 미리
 * 보여주는 것이 이 컴포넌트의 일이라 `className` 의 테마 변수로는 낼 수 없다.
 * 선택 링·체크도 모달 테마가 아니라 **그 타일의 primary** 를 쓴다(타일 안은 그 테마의 세계다).
 *
 * 배경 이미지를 가진 테마도 여기서는 색만 쓴다.
 */
function ThemeTile(props: ThemeTileProps): React.JSX.Element {
  const tokens = getThemeDefinition(props.name)
  const ModeIcon = tokens.mode === 'dark' ? MoonIcon : SunIcon

  return (
    // 셀. **한 줄에 둘**을 만드는 자리다. `w-1/2` 는 퍼센트 하나뿐이라 NativeWind 가 그대로
    // 내보내고(`calc()` 와 달리), 패딩 5px 이 칸 사이 10px 을 만든다.
    <View className="w-1/2 p-[5px]">
        <Pressable
          role="button"
          aria-label={props.name}
          aria-selected={props.isSelected}
          onPress={() => props.onSelect(props.name)}
        style={{
          backgroundColor: tokens.bg,
          borderColor: props.isSelected ? tokens.primary : tokens.border,
          borderWidth: props.isSelected ? 2 : 1,
        }}
        // 폭은 **감싸는 셀**이 정한다(`w-1/2`). 여기서 다시 정하지 않는다. 위 컨테이너 주석 참고.
        className="relative h-[92px] w-full gap-[7px] rounded-[12px] p-2.5"
      >
        <View
          style={{ backgroundColor: tokens.surface, borderColor: tokens.border }}
          className="flex-row items-center gap-1.5 rounded-[7px] border p-1.5"
        >
          <View style={{ backgroundColor: tokens.surface2 }} className="h-[5px] flex-1 rounded-full" />
          <View style={{ backgroundColor: tokens.primary }} className="h-3.5 w-8 rounded-full" />
        </View>

        <View className="flex-row items-center gap-1">
          <Text style={{ color: tokens.text }} className="text-xs font-bold leading-tight">
            {props.name}
          </Text>
          <ModeIcon
            aria-hidden
            color={tokens.text}
            className="h-2.5 w-2.5 shrink-0 opacity-70"
            strokeWidth={2}
          />
        </View>

        {props.isSelected && (
          <View
            aria-hidden
            style={{ backgroundColor: tokens.primary }}
            className="absolute right-1.5 top-1.5 h-[17px] w-[17px] items-center justify-center rounded-full"
          >
            <CheckIcon color={tokens.onPrimary} className="h-2.5 w-2.5" strokeWidth={3} />
          </View>
        )}
      </Pressable>
    </View>
  )
}
