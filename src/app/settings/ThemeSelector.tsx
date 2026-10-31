/**
 * 테마 페이지의 분류별 카드 목록. 분류마다 제목과 카드 하나, 카드 안은 2열 `card-inset` 칸이다.
 *
 * **테마 이름을 손으로 적지 않는다**. 목록·카테고리·모드가 전부
 * `job-themes.json` 에서 파생된 레지스트리에서 온다. 테마 하나를 더하는 일이 JSON 한 블록으로
 * 끝난다는 것이 그 결정의 요점이고, 화면이 이름을 열거하는 순간 그것이 깨진다.
 */
import { Pressable, View } from 'react-native'

import { THEME_NAMES, getThemeDefinition, groupThemesByCategory } from '../../lib/theme/theme-registry'
import { resolveCardInset } from '../../theme/theme-vars'
import type { ThemeMode, ThemeName } from '../../types/theme'

import { Card, CheckIcon, ImageIcon, MoonIcon, SunIcon, Text } from '../../components/atoms'
import { SectionTitle } from './SectionTitle'
import { SETTINGS_CARD_CLASS } from './row-class'

export interface ThemeSelectorProps {
  theme: ThemeName
  /** 이 모드의 테마만 그린다. `null` 이면 전부. */
  mode: ThemeMode | null
  onSelect: (theme: ThemeName) => void
}

export function ThemeSelector(props: ThemeSelectorProps): React.JSX.Element {
  const visible = THEME_NAMES.filter((name) => props.mode === null || getThemeDefinition(name).mode === props.mode)

  return (
    <View className="gap-3">
      {groupThemesByCategory(visible).map((group) => (
        <View key={group.category} className="gap-2">
          <SectionTitle testID="theme-category-heading">{group.category}</SectionTitle>
          {/* CSS Grid 가 없어 2열을 **셀 패딩 + 줄 음수 마진**으로 만든다.
              **`w-[calc(50%-2px)]` + `gap` 으로 두면 안 된다**. NativeWind 가 그 `calc()` 를
              만들지 않아 폭이 통째로 빠지고, 칸이 **글자 길이대로** 늘어나 한 줄에 셋이 서기도
              한다(실기기 관측: `엔젤릭버스터`만 넓었다). 에러도 경고도 없다.
              간격 4 는 셀 패딩 2 두 개가 만들고, 바깥으로 삐져나온 2 는 줄의 `-m` 이 뺀다. */}
          <Card className={SETTINGS_CARD_CLASS}>
            <View className="-m-0.5 flex-row flex-wrap">
              {group.themes.map((name) => (
                <ThemeTile key={name} name={name} isSelected={props.theme === name} onSelect={props.onSelect} />
              ))}
            </View>
          </Card>
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
 * 그 테마의 화면을 축소해 보여주는 칸.
 *
 * 작은 화면의 색은 **지금 테마의 토큰이 아니라 레지스트리에서 직접** 읽는다. 다른 테마의 색을 미리
 * 보여주는 것이 이 칸의 일이라 `className` 의 테마 변수로는 낼 수 없다. 칸 바탕 · 이름 · 체크는 페이지 테마를 따른다.
 *
 * 배경 그림은 깔지 않는다. 앱의 `dim` 은 화면 전체 기준이라 작은 칸에 덮으면 검은 띠가 된다. 그림이 있다는 것만 아이콘으로 알린다.
 */
function ThemeTile(props: ThemeTileProps): React.JSX.Element {
  const tokens = getThemeDefinition(props.name)
  const inset = resolveCardInset(tokens)
  const ModeIcon = tokens.mode === 'dark' ? MoonIcon : SunIcon

  return (
    // 셀. **한 줄에 둘**을 만드는 자리다. `w-1/2` 는 퍼센트 하나뿐이라 NativeWind 가 그대로 내보낸다.
    <View className="w-1/2 p-0.5">
      <Pressable
        role="button"
        aria-label={props.name}
        aria-selected={props.isSelected}
        onPress={() => props.onSelect(props.name)}
        className="w-full gap-2 rounded-[10px] bg-card-inset p-2"
      >
        <View testID="theme-tile-preview" style={{ backgroundColor: tokens.bg }} className="h-[60px] rounded-lg p-[7px]">
          <View style={{ backgroundColor: tokens.surface }} className="gap-[3px] rounded-md p-[5px]">
            <View style={{ backgroundColor: inset }} className="h-[11px] flex-row items-center gap-1 rounded px-[3px]">
              <View style={{ backgroundColor: tokens.surface2 }} className="h-[3px] flex-1 rounded-full" />
              <View style={{ backgroundColor: tokens.primary }} className="h-[7px] w-[18px] rounded-full" />
            </View>
            <View style={{ backgroundColor: inset }} className="h-[11px] rounded" />
          </View>
        </View>

        <View className="min-h-5 flex-row items-center gap-1 px-0.5">
          <Text numberOfLines={1} className="shrink text-xs font-semibold text-text">
            {props.name}
          </Text>
          <ModeIcon aria-hidden className="h-3 w-3 shrink-0 text-text-muted" strokeWidth={2} />
          {tokens.background !== undefined && (
            <View testID="theme-tile-backdrop-mark" aria-hidden className="shrink-0">
              <ImageIcon className="h-3 w-3 text-text-muted" strokeWidth={2} />
            </View>
          )}
          {props.isSelected && (
            <View aria-hidden className="ml-auto h-[18px] w-[18px] items-center justify-center rounded-full bg-primary">
              <CheckIcon className="h-[11px] w-[11px] text-on-primary" strokeWidth={3} />
            </View>
          )}
        </View>
      </Pressable>
    </View>
  )
}
