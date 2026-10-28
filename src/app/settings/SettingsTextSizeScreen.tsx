/**
 * 글자 크기 페이지. **단계를 바꾸면 이 페이지만 바뀌고, `적용` 을 눌러야 앱 전체에 적용된다.**
 *
 * 페이지를 `TextScaleScope` 로 감싸 고른 단계로 그린다. 끌 때 눈금을 지날 때마다 앱 전체를 다시 그리면 끄는 동안
 * 화면이 버벅인다. `적용` 없이 나가면 고른 단계는 버린다.
 */
import { useState } from 'react'
import { View } from 'react-native'

import { useTextSizeStore } from '../../features/text-size/store'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { TEXT_SIZE_SCALE } from '../../lib/text-size'
import { TextScaleScope, useTextScale } from '../../theme/text-scale'
import type { TextSize } from '../../types/text-size'

import { Button, Card, Text } from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { SectionTitle } from './SectionTitle'
import { SettingsActionBar } from './SettingsActionBar'
import { SETTINGS_CARD_CLASS } from './row-class'
import { TextSizeSlider } from './TextSizeSlider'

/**
 * 미리보기 줄. 앱이 쓰는 글자 역할 넷과 그 기본 크기다.
 *
 * 문장 하나로 설명하지 않는 이유는 글자마다 크기가 다르기 때문이다. `모든 글자가 이 크기` 같은 말은 틀린다.
 * 크기가 다른 줄을 나란히 두면 단계가 그 모두에 같은 배수를 곱한다는 것이 그대로 보인다.
 */
const PREVIEW_LINES = [
  { label: '화면 제목', basePx: 18, className: 'text-lg font-semibold' },
  { label: '행 이름 · 본문', basePx: 14, className: 'text-sm font-medium' },
  { label: '배지 · 보조 글자', basePx: 12, className: 'text-xs' },
  { label: '위젯 제목', basePx: 10, className: 'text-10 font-bold' },
] as const

/** 미리보기 칸. 숫자는 스코프 안의 실제 배수로 셈해, 좁은 화면의 상한까지 반영한다. */
function TextSizePreview(): React.JSX.Element {
  const scale = useTextScale()

  return (
    <View className="gap-3 rounded-[10px] bg-card-inset p-3.5">
      {PREVIEW_LINES.map((line) => (
        <View key={line.label} className="flex-row items-baseline justify-between gap-3">
          <Text className={`shrink text-text ${line.className}`}>{line.label}</Text>
          <Text className="text-xs text-text-muted">{String(Math.round(line.basePx * scale * 10) / 10)}</Text>
        </View>
      ))}
    </View>
  )
}

export function SettingsTextSizeScreen(): React.JSX.Element {
  const navigation = useSettingsNavigation()
  const { size, selectSize } = useTextSizeStore()
  const [draft, setDraft] = useState<TextSize>(size)
  const [actionBarHeightPx, setActionBarHeightPx] = useState(0)

  async function handleApply(): Promise<void> {
    await selectSize(draft)
    navigation.goBack()
  }

  const isUnchanged = draft === size

  return (
    <TextScaleScope scale={TEXT_SIZE_SCALE[draft]}>
      <View className="flex-1">
        <ScreenScroll
          hasTabBar={false}
          header={
            <PageHeader>
              <PageHeaderTitleRow className="gap-2">
                <BackButton onPress={() => navigation.goBack()} />
                <Text className="text-lg font-semibold text-text">글자 크기</Text>
              </PageHeaderTitleRow>
            </PageHeader>
          }
        >
          <View className="gap-3 px-4 pb-4" testID="screen-SettingsTextSize" style={{ paddingBottom: actionBarHeightPx }}>
            <View className="gap-2">
              <SectionTitle>미리보기</SectionTitle>
              <Card className={SETTINGS_CARD_CLASS}>
                <TextSizePreview />
              </Card>
            </View>
            <Card className={SETTINGS_CARD_CLASS}>
              <View className="rounded-[10px] bg-card-inset px-3.5 pb-3 pt-4">
                <TextSizeSlider value={draft} onChange={setDraft} />
              </View>
            </Card>
          </View>
        </ScreenScroll>

        <SettingsActionBar testID="text-size-action-bar" onHeight={setActionBarHeightPx}>
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
      </View>
    </TextScaleScope>
  )
}
