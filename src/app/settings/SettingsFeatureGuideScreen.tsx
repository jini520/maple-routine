// 기능 사용법 안내 상세([[ADR-125]]) — 그 기능이 어디 있고 어떻게 쓰는지.
//
// **이 화면은 두 라우트 아래 각각 걸린다**([[ADR-125]] 결정 3 정정):
//
//     SettingsFeatureGuide       기능 설명 목록에서   (웹 `/settings/guide/:guideId`)
//     SettingsReleaseNoteGuide   개발 노트 항목에서   (웹 `/settings/release-notes/:guideId`)
//
// **컴포넌트는 하나다** — `RootNavigator` 가 두 이름에 같은 것을 꽂는다(`routes.ts` 의
// `FEATURE_GUIDE_ROUTE_NAMES`). 사본을 두면 같은 글이 두 벌이 되어 반드시 갈라진다.
//
// ── RN 으로 옮기며 갈린 것 넷 ────────────────────────────────────────────────────────
//
// ① **부모를 계산하지 않는다.** 웹은 라우트가 둘이라 돌아갈 곳을 `resolveParentPath(pathname)` 로
//    현재 경로에서 **깎아** 썼다. RN 의 pop 은 "누가 밀었는지"를 스택이 이미 알고 있어 깎을 것이
//    없다 — 계약(*"어디서 왔든 그리로 돌아간다"*)은 그대로고 계산만 사라진다
//    (`use-settings-navigation.ts`).
// ② **마디는 쿼리(`?s=`)가 아니라 라우트 파라미터다.** 웹에서 그것이 세그먼트가 아니라 쿼리였던
//    이유는 `resolveStackDirection` 이 세그먼트를 스택 한 단으로 읽어 목차를 누를 때마다 화면이
//    밀려 들어오기 때문이었는데([[ADR-125]] 결정 7), RN 에는 그 판정 자체가 없다(push 는 우리가
//    명시한다). 목차 클릭은 `setParams` 라 **스택을 건드리지 않는다** — 웹의 `replace` 와 같은 뜻이다.
// ③ **스크롤 목적지를 우리가 잰다.** 웹은 `getElementById` + `scrollIntoView` 였다. RN 에는 문서도
//    id 도 없으므로 각 마디가 `onLayout` 으로 자기 y 를 알려 주고, 그 값으로 `scrollTo` 한다.
//    래퍼의 y 를 함께 더하는 것은 마디의 `onLayout` y 가 **부모 기준**이기 때문이다 — 래퍼가 마침
//    콘텐츠 맨 위라 지금은 0 이지만, 그 사실에 기대면 위에 무언가 붙는 날 조용히 어긋난다.
// ④ **없는 안내의 처리가 렌더 중 `<Navigate replace>` 에서 이펙트 안 `goBack()` 으로.** RN 에서는
//    렌더 도중 내비게이션을 만질 수 없다. 뜻은 같다 — 히스토리를 남기지 않고 들어온 목록으로
//    돌려보낸다. **딥링크를 두지 않아 지금은 도달 불가한 자리**지만(`routes.ts`), 데이터에서 안내가
//    사라지면 노트의 `guideId` 가 그대로 이리로 온다.
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
import { useSettingsNavigation } from './use-settings-navigation'

/**
 * **두 라우트 이름을 다 받는 타입이어야 한다.** 하나로 좁히면 `route.name` 이 그 리터럴로 굳어,
 * 실제로는 다른 이름으로 들어올 수 있다는 사실을 타입이 감춘다 — 아래 `screen-${route.name}` 이
 * 정확히 그 사실 위에 선다(같은 화면이 두 이름으로 열린다는 것이 [[ADR-125]] 결정 3 이다).
 */
type FeatureGuideRoute = RouteProp<
  RootStackParamList,
  'SettingsFeatureGuide' | 'SettingsReleaseNoteGuide'
>

/** 웹의 `scroll-mt-4` 짝 — 마디가 스크롤포트 맨 위에 딱 붙지 않게 남기는 여백. */
const SECTION_SCROLL_MARGIN_PX = 16

export function SettingsFeatureGuideScreen(): React.JSX.Element | null {
  const navigation = useSettingsNavigation()
  // 두 라우트가 같은 파라미터 모양을 가지므로(`FeatureGuideParams`) 어느 쪽으로 들어왔든 같다.
  const route = useRoute<FeatureGuideRoute>()
  const { guideId, section: requestedSection } = route.params

  const scrollRef = useRef<ScrollViewType>(null)
  const sectionOffsets = useRef(new Map<string, number>())
  const contentOffset = useRef(0)
  // 한 번 스크롤한 뒤에는 다시 하지 않는다 — 목차를 눌러 다른 마디로 옮겨 놓고도 이 효과가
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
    // 즉시(`animated: false`) — 밀려 들어오는 전환과 부드러운 스크롤이 겹치면 둘 다 어그러진다.
    // 들어온 순간 이미 그 마디에 서 있는 편이 낫다.
    scrollRef.current?.scrollTo({
      y: Math.max(0, contentOffset.current + y - SECTION_SCROLL_MARGIN_PX),
      animated: false,
    })
  }, [guide, requestedSection, measuredAt])

  // 옛 링크·오타의 착지점이 빈 화면이면 안 된다. 히스토리에 남겨 뒤로가기가 다시 그리로 가게 둘
  // 이유도 없으므로 push 가 아니라 pop 이다([[ADR-125]] 결정 3 · 파일 머리 ④).
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
            {/* `min-w-0` + 한 줄 말줄임 — 웹의 `truncate` 짝이다(RN 은 글자 쪽 프롭). */}
            <Text numberOfLines={1} className="min-w-0 flex-1 text-lg font-semibold text-text">
              {guide.title}
            </Text>
          </PageHeaderTitleRow>
        </PageHeader>
      }
    >
      {/* `screen-<라우트 이름>` 은 자리표시자에게서 물려받은 계약이다(`SettingsAboutScreen` 주석).
          **여기만 이름이 고정이 아니다** — 한 컴포넌트가 두 라우트에 걸려 있어, 어느 쪽으로 열렸는지를
          그대로 찍는다([[ADR-125]] 결정 3 을 테스트가 물을 수 있는 형태). */}
      <View
        testID={`screen-${route.name}`}
        className="gap-5 px-4 pb-6"
        onLayout={(event) => {
          contentOffset.current = event.nativeEvent.layout.y
        }}
      >
        {/* 목차. **마디가 둘 이상일 때만** 뜻이 있다 — 하나뿐이면 아래 소제목과 같은 말을 두 번
            하는 것이다. 누르면 스택을 건드리지 않고 파라미터만 갈아 끼워 그 자리로 간다. */}
        {guide.sections.length > 1 && (
          // **카드 껍데기를 두르지 않는다**(사용자 지정, 2026-08-11) — 아래가 전부 같은 글이라
          // 목차만 상자에 담기면 본문이 아니라 위젯으로 읽힌다. 제목 + 번호 목록으로 충분하다.
          // 묶음 제목의 생김새는 개발 노트의 카테고리 제목과 같다.
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-text-muted">목차</Text>
            <View className="gap-1">
              {guide.sections.map((section, index) => (
                <View key={section.id} className="flex-row gap-1.5">
                  {/* 번호는 **버튼 밖**이다 — 안에 넣으면 누를 수 있는 이름이 "1. 제목"이 된다. */}
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

        {/* 마디도 그 안의 블록도 **데이터 순서 그대로** 쌓는다 — 이미지만·문단만·둘 다가 모두
            정상이고([[ADR-125]] 결정 6), 화면이 다시 배열하지 않는다. */}
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
                  // 대체 텍스트는 타입이 강제한다(`FeatureGuideImage`) — 안내 화면에서 이미지는
                  // 장식이 아니라 정보를 나른다. `alt` → `alt`(RN 도 같은 프롭 이름을 받는다).
                  //
                  // **`src` 는 URL 문자열이 아니라 번들 에셋 참조다**([[ADR-129]]) — 웹에서 그것이
                  // 문자열인 것은 번들러가 그렇게 값을 가르기 때문이고, 여기서는 `Image` 가 그대로
                  // 받는 에셋 id 다.
                  //
                  // **비율은 원본이 정하지만, 그렇게 되려면 높이를 «지워야» 한다**([[ADR-135]]) —
                  // 웹의 `w-full` 한 줄이 통했던 것은 preflight 의 `img { height: auto }` 때문이고
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
