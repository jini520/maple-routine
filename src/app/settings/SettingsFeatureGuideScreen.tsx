/**
 * 기능 사용법 안내 상세. 그 기능이 어디 있고 어떻게 쓰는지.
 *
 * **이 화면은 두 라우트 아래 각각 걸린다**(정정):
 *
 *     SettingsFeatureGuide       기능 설명 목록에서
 *     SettingsReleaseNoteGuide   개발 노트 항목에서
 *
 * **컴포넌트는 하나다**. `RootNavigator` 가 두 이름에 같은 것을 꽂는다(`routes.ts` 의
 * `FEATURE_GUIDE_ROUTE_NAMES`). 사본을 두면 같은 글이 두 벌이 되어 반드시 갈라진다.
 */
import { ArrowLeftIcon, Text } from '../../components/atoms'
import { useEffect, useRef, useState } from 'react'
import type { ScrollView as ScrollViewType } from 'react-native'
import { Image, Pressable, View } from 'react-native'
import { useRoute, type RouteProp } from '@react-navigation/native'

import { findFeatureGuide } from '../../data/feature-guides'

import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { naturalAspectStyle } from '../../lib/image-aspect'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import type { RootStackParamList } from '../../navigation/routes'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'

/**
 * 두 라우트 이름을 다 받는 타입. 하나로 좁히면 `route.name` 이 그 리터럴로 굳어,
 * 실제로는 다른 이름으로 들어올 수 있다는 사실을 타입이 감춘다. 아래 `screen-${route.name}` 이
 * 정확히 그 사실 위에 선다(같은 화면이 두 이름으로 열린다는 것이 이다).
 */
type FeatureGuideRoute = RouteProp<
  RootStackParamList,
  'SettingsFeatureGuide' | 'SettingsReleaseNoteGuide'
>

/** 마디가 스크롤포트 맨 위에 딱 붙지 않게 남기는 여백. */
const SECTION_SCROLL_MARGIN_PX = 16

export function SettingsFeatureGuideScreen(): React.JSX.Element | null {
  const navigation = useSettingsNavigation()
  // 두 라우트가 같은 파라미터 모양을 가지므로(`FeatureGuideParams`) 어느 쪽으로 들어왔든 같다.
  const route = useRoute<FeatureGuideRoute>()
  const { guideId, section: requestedSection } = route.params

  const scrollRef = useRef<ScrollViewType>(null)
  const sectionOffsets = useRef(new Map<string, number>())
  const contentOffset = useRef(0)
  // 한 번 스크롤한 뒤에는 다시 하지 않는다. 목차를 눌러 다른 마디로 옮겨 놓고도 이 효과가
  // 또 돌면 처음 마디로 되끌려 간다.
  const scrolledTo = useRef<string | null>(null)
  // 마디 위치는 레이아웃 **뒤**에 오므로, 첫 렌더에 요청받은 마디의 y 를 아직 모른다. 이 값이
  // 바뀔 때 아래 이펙트가 다시 돌아 그때 스크롤한다.
  const [measuredAt, setMeasuredAt] = useState(0)

  const guide = findFeatureGuide(guideId)

  useEffect(() => {
    if (guide === undefined) return
    if (requestedSection === undefined) return
    if (scrolledTo.current === requestedSection) return
    const y = sectionOffsets.current.get(requestedSection)
    if (y === undefined) return
    scrolledTo.current = requestedSection
    // 즉시(`animated: false`). 밀려 들어오는 전환과 부드러운 스크롤이 겹치면 둘 다 어그러진다.
    // 들어온 순간 이미 그 마디에 서 있는 편이 낫다.
    scrollRef.current?.scrollTo({
      y: Math.max(0, contentOffset.current + y - SECTION_SCROLL_MARGIN_PX),
      animated: false,
    })
  }, [guide, requestedSection, measuredAt])

  // 옛 링크·오타의 착지점이 빈 화면이면 안 된다. 히스토리에 남겨 뒤로가기가 다시 그리로 가게
  // 둘 이유도 없으므로 push 가 아니라 pop 이다.
  useEffect(() => {
    if (guide === undefined) navigation.goBack()
  }, [guide, navigation])

  if (guide === undefined) return null

  return (
    <ScreenScroll
      ref={scrollRef}
      hasTabBar={false}
      header={
        <PageHeader>
          <PageHeaderTitleRow className="gap-2">
            <Pressable
              role="button"
              aria-label="뒤로"
              onPress={() => navigation.goBack()}
              className="-ml-1 p-1"
            >
              <ArrowLeftIcon className="h-5 w-5 text-text-muted" strokeWidth={2} aria-hidden />
            </Pressable>
            {/* `min-w-0` + 한 줄 말줄임. 말줄임은 글자 쪽 프롭이다. */}
            <Text numberOfLines={1} className="min-w-0 flex-1 text-lg font-semibold text-text">
              {guide.title}
            </Text>
          </PageHeaderTitleRow>
        </PageHeader>
      }
    >
      {/* `screen-<라우트 이름>` 은 자리표시자에게서 물려받은 계약이다(`SettingsAboutScreen` 주석).
          **여기만 이름이 고정이 아니다**. 한 컴포넌트가 두 라우트에 걸려 있어, 어느 쪽으로 열렸는지를
          그대로 찍는다(을 테스트가 물을 수 있는 형태). */}
      <View
        testID={`screen-${route.name}`}
        className="gap-5 px-4 pb-6"
        onLayout={(event) => {
          contentOffset.current = event.nativeEvent.layout.y
        }}
      >
        {/* 목차. **마디가 둘 이상일 때만** 뜻이 있다. 하나뿐이면 아래 소제목과 같은 말을 두 번
            하는 것이다. 누르면 스택을 건드리지 않고 파라미터만 갈아 끼워 그 자리로 간다. */}
        {guide.sections.length > 1 && (
          // 카드 껍데기를 두르지 않는다. 아래가 전부 같은 글이라 목차만 상자에 담기면 본문이
          // 아니라 위젯으로 읽힌다. 제목 + 번호 목록으로 충분하다. 묶음 제목의 생김새는 개발
          // 노트의 카테고리 제목과 같다.
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-text-muted">목차</Text>
            <View className="gap-1">
              {guide.sections.map((section, index) => (
                <View key={section.id} className="flex-row gap-1.5">
                  {/* 번호는 **버튼 밖**이다. 안에 넣으면 누를 수 있는 이름이 "1. 제목"이 된다. */}
                  <Text aria-hidden style={TABULAR_NUMS} className="text-sm text-text-disabled">
                    {index + 1}.
                  </Text>
                  <Pressable
                    role="button"
                    testID="guide-toc-item"
                    onPress={() => {
                      scrolledTo.current = null
                      navigation.setParams({ guideId: guide.id, section: section.id })
                    }}
                    className="min-w-0 flex-1"
                  >
                    <Text className="text-sm text-primary-ink">{section.title}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 마디도 그 안의 블록도 **데이터 순서 그대로** 쌓는다. 이미지만·문단만·둘 다가 모두
            정상이고, 화면이 다시 배열하지 않는다. */}
        {guide.sections.map((section) => (
          <View
            key={section.id}
            testID="guide-section"
            className="gap-2"
            onLayout={(event) => {
              sectionOffsets.current.set(section.id, event.nativeEvent.layout.y)
              setMeasuredAt((value) => value + 1)
            }}
          >
            <Text className="text-base font-semibold text-text">{section.title}</Text>
            {section.blocks.map((block, index) => (
              <View key={index} testID="guide-block" className="gap-2">
                {block.image !== undefined && (
                  // 대체 텍스트는 타입이 강제한다(`FeatureGuideImage`). 안내 화면에서 이미지는
                  // 장식이 아니라 정보를 나른다. `alt` → `alt`(RN 도 같은 프롭 이름을 받는다).
                  //
                  // **`src` 는 URL 문자열이 아니라 번들 에셋 참조다**. 여기서는 `Image` 가 그대로
                  // 받는 에셋 id 다.
                  //
                  // **비율은 원본이 정하지만, 그렇게 되려면 높이를 지워야 한다**.
                  // 한 축만 이름 부르면 다른 축에 그림의 고유 픽셀값이 남으므로
                  // RN 에는 그 짝이 없다. 안 적은 축에는 스크린샷의 고유 픽셀 높이가 남아
                  // (746×274 안내는 위아래 각 71px, 780×1438 안내는 각 389px) 큰 여백이 생긴다.
                  <Image
                    source={block.image.src}
                    alt={block.image.alt}
                    resizeMode="contain"
                    style={naturalAspectStyle(block.image.src, { width: '100%' })}
                    className="rounded-[14px] border border-border"
                  />
                )}
                {block.text !== undefined && (
                  <Text className="text-sm leading-relaxed text-text-muted">{block.text}</Text>
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScreenScroll>
  )
}
