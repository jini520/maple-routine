/**
 * 테마 페이지. **고르면 이 페이지만 바뀌고, `적용` 을 눌러야 앱 전체에 적용된다.** 목록 위의 오버 프레임 스위치도 같다.
 *
 * 페이지를 `ThemeScope` 로 감싸 고른 테마로 그린다. 고르는 즉시 앱 전체를 바꾸면 둘러보는 동안 모든 화면이 계속
 * 다시 그려진다. `적용` 없이 나가면 고른 것은 버리고, 상태바 · 내비바 명암도 지금 테마로 돌려놓는다.
 */
import { useEffect, useState } from 'react'
import { View } from 'react-native'

import { useOverFrameStore } from '../../features/over-frame/store'
import { showSystemBarsOf, useThemeStore } from '../../features/theme/store'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { ThemeScope } from '../../theme/ThemeScope'
import type { ThemeName } from '../../types/theme'

import { Button, Card, Switch, Text } from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { Segment } from '../../components/molecules/Segment/Segment'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { FaqButton } from '../../components/organisms/FaqSheet/FaqButton'
import { useFaqSheet } from '../../features/faq/use-faq-sheet'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { ThemeBackdrop } from '../../components/templates/ThemeBackdrop/ThemeBackdrop'
import { SETTINGS_CARD_CLASS, SETTINGS_SWITCH_ROW_CLASS } from './row-class'
import { SettingsActionBar } from './SettingsActionBar'
import { ThemeSelector } from './ThemeSelector'

/**
 * 라이트·다크 필터. 분류와 모드는 서로 다른 축이라 분류가 제목을 갖고 모드는 필터가 된다.
 * 저장하지 않는다. 페이지를 다시 열면 전체다.
 */
const MODE_FILTERS = ['전체', '라이트', '다크'] as const
type ModeFilter = (typeof MODE_FILTERS)[number]

const FILTERED_MODE: Record<ModeFilter, 'light' | 'dark' | null> = {
  전체: null,
  라이트: 'light',
  다크: 'dark',
}

export function SettingsThemeScreen(): React.JSX.Element {
  const faq = useFaqSheet('settings-theme')
  const navigation = useSettingsNavigation()
  const { theme, selectTheme } = useThemeStore()
  const [draft, setDraft] = useState<ThemeName>(theme)
  const overFrame = useOverFrameStore((state) => state.enabled)
  const setOverFrame = useOverFrameStore((state) => state.setEnabled)
  const [overFrameDraft, setOverFrameDraft] = useState(overFrame)
  const [filter, setFilter] = useState<ModeFilter>('전체')
  const [actionBarHeightPx, setActionBarHeightPx] = useState(0)

  useEffect(() => {
    showSystemBarsOf(draft)
  }, [draft])

  // 나갈 때 읽는 것은 그때의 테마다. `적용` 뒤에 나가면 새 테마, 그냥 나가면 원래 테마다.
  useEffect(() => () => showSystemBarsOf(useThemeStore.getState().theme), [])

  async function handleApply(): Promise<void> {
    if (draft !== theme) await selectTheme(draft)
    if (overFrameDraft !== overFrame) await setOverFrame(overFrameDraft)
    navigation.goBack()
  }

  const isUnchanged = draft === theme && overFrameDraft === overFrame

  return (
    <ThemeScope theme={draft}>
      <ThemeBackdrop />
      <ScreenScroll
        hasTabBar={false}
        header={
          <PageHeader>
            <PageHeaderTitleRow
              className="gap-2"
              trailing={<Segment size="lg" options={MODE_FILTERS} selected={filter} onSelect={setFilter} />}
            >
              <BackButton onPress={() => navigation.goBack()} />
              <View className="flex-row items-center">
                <Text className="text-lg font-bold text-text">테마</Text>
                <FaqButton sheet={faq} />
              </View>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        <View className="gap-3 px-4 pb-4" testID="screen-SettingsTheme" style={{ paddingBottom: actionBarHeightPx }}>
          {/* 설명 글은 두지 않는다(사용자 지정). */}
          <Card className={SETTINGS_CARD_CLASS}>
            <View className={SETTINGS_SWITCH_ROW_CLASS}>
              <Text className="shrink text-sm font-semibold text-text">오버 프레임</Text>
              <Switch
                on={overFrameDraft}
                label="오버 프레임"
                className="ml-auto"
                onToggle={() => setOverFrameDraft(!overFrameDraft)}
              />
            </View>
          </Card>
          <ThemeSelector theme={draft} mode={FILTERED_MODE[filter]} onSelect={setDraft} />
        </View>
      </ScreenScroll>

      <SettingsActionBar testID="theme-action-bar" onHeight={setActionBarHeightPx}>
        <Button
          variant="primary"
          disabled={isUnchanged}
          onPress={() => {
            void handleApply()
          }}
          // `disabled` 프롭은 색을 바꾸지 않는다. 그대로 두면 꺼진 버튼이 멀쩡한 색으로 보인다.
          className={`w-full items-center${isUnchanged ? ' opacity-50' : ''}`}
        >
          적용
        </Button>
      </SettingsActionBar>
    </ThemeScope>
  )
}
