/**
 * 더보기의 이벤트 · 캐시샵 배너 줄. 화면 양끝까지 닿는 칸을 한 칸씩 넘긴다.
 *
 * 새 배너가 위로 올라와 이전 배너를 덮으며 들어오고, 이전 배너는 같은 쪽으로 느리게 밀리며 옅어진다. 마지막과 처음이 이어진다.
 * 모습의 값은 `notice-banner-motion` 이 스크롤 위치 하나에서 낸다.
 */
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, {
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'

import { Text } from '../../components/atoms'
import { noticeBannerRatio, noticeDisplayTitle } from '../../features/notice/notice-display'
import type { Notice } from '../../types/notice'
import { NoticeBannerArt } from './NoticeBannerArt'
import {
  BANNER_DOT_SIZE,
  bannerSlideFrame,
  bannerStep,
  loopPageCount,
  realBannerIndex,
  settledLoopPage,
  wormBar,
} from './notice-banner-motion'

/**
 * 애니메이션이 붙는 상자. `nativewind-interop` 에 등록된 `Animated.View` 를 쓰지 않는다.
 *
 * 등록된 쪽에 정적 스타일과 애니메이션 스타일을 한 배열로 넘기면 정적 쪽이 사라진다(칸 폭이 빠져 배너가 안 보였다). 색이
 * 필요한 곳은 안쪽 `View` 가 `className` 으로 칠한다.
 */
const AnimatedBox = Animated.createAnimatedComponent(View)

/** 사본을 포함한 칸들. 배너가 둘 이상이면 [마지막 사본, 배너들, 첫 사본] 이다. */
function loopPages(notices: readonly Notice[]): readonly Notice[] {
  if (notices.length <= 1) return notices
  return [notices[notices.length - 1] as Notice, ...notices, notices[0] as Notice]
}

function BannerSlide(props: {
  notice: Notice
  page: number
  pageCount: number
  isCopy: boolean
  width: number
  position: SharedValue<number>
  base: SharedValue<number>
  onPress: () => void
}): React.JSX.Element {
  const { page, pageCount, width, position, base } = props
  const slideStyle = useAnimatedStyle(() => {
    const frame = bannerSlideFrame(page, bannerStep(position.value, base.value, pageCount), width)
    return { opacity: frame.visible ? 1 : 0, zIndex: frame.zIndex, transform: [{ translateX: frame.translateX }] }
  })
  // 배너를 투명하게 하면 겹친 곳이 포개져 진해진다. 그림 위에 막을 덮어 옅게 한다.
  const veilStyle = useAnimatedStyle(() => ({
    opacity: bannerSlideFrame(page, bannerStep(position.value, base.value, pageCount), width).veil,
  }))
  const title = noticeDisplayTitle(props.notice)

  return (
    <AnimatedBox
      testID="notice-banner-slide"
      style={[{ width }, slideStyle]}
      importantForAccessibility={props.isCopy ? 'no-hide-descendants' : undefined}
      accessibilityElementsHidden={props.isCopy}
    >
      <Pressable role="button" aria-label={title} onPress={props.onPress}>
        <NoticeBannerArt key={props.notice.thumbnailUrl ?? ''} notice={props.notice} />
        {/* 그림만으로는 무슨 이벤트 · 상품인지 알기 어려운 배너가 있어 왼쪽 위에 제목을 얹는다. 그림을 가리는 넓이가 가장 작은 자리다.
            그림 위에서 읽혀야 해 테마 색이 아니라 어두운 반투명 바탕 · 흰 글자다. 막보다 아래라 이전 배너와 함께 옅어진다. */}
        <View
          pointerEvents="none"
          className="absolute left-2.5 top-2.5 rounded-full px-2.5 py-1"
          style={{ maxWidth: width - 20, backgroundColor: 'rgba(20, 16, 12, 0.58)' }}
        >
          <Text testID="notice-banner-title" numberOfLines={1} className="text-xs font-semibold text-white">
            {title}
          </Text>
        </View>
        <AnimatedBox pointerEvents="none" style={[StyleSheet.absoluteFill, veilStyle]}>
          <View className="flex-1 bg-surface" />
        </AnimatedBox>
      </Pressable>
    </AnimatedBox>
  )
}

/** 점 D. 회색 점 위의 주황 표시가 넘긴 정도를 따라 늘었다 줄어든다. */
function BannerDots(props: {
  count: number
  pageCount: number
  position: SharedValue<number>
  base: SharedValue<number>
}): React.JSX.Element {
  const { count, pageCount, position, base } = props
  const barStyle = useAnimatedStyle(() => {
    const step = bannerStep(position.value, base.value, pageCount)
    const bar = wormBar(realBannerIndex(step.base, count), realBannerIndex(step.target, count), step.d)
    return { left: bar.left, width: bar.width }
  })

  return (
    <View pointerEvents="none" className="absolute bottom-2 left-0 right-0 items-center">
      <View className="flex-row" style={{ gap: BANNER_DOT_SIZE }}>
        {Array.from({ length: count }, (_, index) => (
          <View
            key={index}
            testID="notice-banner-dot"
            style={{ width: BANNER_DOT_SIZE, height: BANNER_DOT_SIZE, borderRadius: BANNER_DOT_SIZE / 2, ...DOT_ON_IMAGE }}
          />
        ))}
        <AnimatedBox style={[BAR_BOX, barStyle]}>
          <View className="flex-1 bg-primary" />
        </AnimatedBox>
      </View>
    </View>
  )
}

/** 주황 표시의 상자. 색은 안쪽 `View` 가 칠하고 둥근 끝은 이 상자가 자른다. */
const BAR_BOX = {
  position: 'absolute',
  top: 0,
  height: BANNER_DOT_SIZE,
  borderRadius: BANNER_DOT_SIZE / 2,
  overflow: 'hidden',
} as const

/** 그림 위에서 읽히는 점. 테마 색이 아니라 그림 위에 얹는 흰 점이다. */
const DOT_ON_IMAGE = {
  backgroundColor: 'rgba(255, 255, 255, 0.72)',
  shadowColor: '#000',
  shadowOpacity: 0.35,
  shadowRadius: 1,
  shadowOffset: { width: 0, height: 0 },
} as const

export function NoticeBannerRail(props: {
  notices: readonly Notice[]
  onOpen: (notice: Notice) => void
}): React.JSX.Element {
  const { width: windowWidth } = useWindowDimensions()
  const [width, setWidth] = useState(windowWidth)
  const count = props.notices.length
  const pages = loopPages(props.notices)
  const pageCount = loopPageCount(count)
  const firstPage = count > 1 ? 1 : 0
  const kind = props.notices[0]?.kind ?? 'event'

  const scrollRef = useAnimatedRef<Animated.ScrollView>()
  const position = useSharedValue(firstPage)
  const base = useSharedValue(firstPage)

  const onScroll = useAnimatedScrollHandler(
    {
      onScroll: (event) => {
        position.value = event.contentOffset.x / width
      },
      // 끄는 도중에 다시 잡으면 반쯤 넘긴 자리에서 두 배너의 역할이 바뀌어 그림이 튄다. 시작과 멈춤에서만 잡는다.
      onBeginDrag: (event) => {
        base.value = Math.round(event.contentOffset.x / width)
      },
      onMomentumEnd: (event) => {
        const page = Math.round(event.contentOffset.x / width)
        const settled = settledLoopPage(page, count)
        // 사본 칸에 멈췄으면 같은 그림의 실제 칸으로 옮긴다. 멈춘 상태라 화면이 그대로다.
        if (settled !== page) scrollTo(scrollRef, settled * width, 0, false)
        base.value = settled
        position.value = settled
      },
    },
    [width, count],
  )

  // 처음에는 마지막 사본이 아니라 첫 배너에 선다. 폭이 바뀌어도 서 있던 배너를 지킨다.
  useEffect(() => {
    const page = Math.round(base.value)
    scrollRef.current?.scrollTo({ x: page * width, animated: false })
    position.value = page
  }, [width, count, base, position, scrollRef])

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        contentOffset={{ x: firstPage * width, y: 0 }}
        style={{ height: width / noticeBannerRatio(kind) }}
      >
        {pages.map((notice, page) => (
          <BannerSlide
            key={`${page}-${notice.id}`}
            notice={notice}
            page={page}
            pageCount={pageCount}
            isCopy={count > 1 && (page === 0 || page === pageCount - 1)}
            width={width}
            position={position}
            base={base}
            onPress={() => props.onOpen(notice)}
          />
        ))}
      </Animated.ScrollView>
      {count > 1 && <BannerDots count={count} pageCount={pageCount} position={position} base={base} />}
    </View>
  )
}
