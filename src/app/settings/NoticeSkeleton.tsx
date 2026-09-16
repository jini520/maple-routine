/**
 * 소식 갈래의 조회 중 자리. 받아 보기 전에 `없습니다` 라고 말하지 않으려고 둔다.
 *
 * **결과와 같은 치수로 서는 것이 전부다.** 어긋나면 내용이 도착할 때 아래가 밀리고, 그 밀림을
 * 없애려고 만든 부품이라 그때 존재 이유가 없다. 배너는 `NoticeBannerArt` 와 같은 비율, 글 줄은
 * `NoticeLines` 와 같은 줄 수·줄 높이·구분선이다. 그 둘을 고칠 때 이 파일도 함께 고칠 것.
 */
import { View } from 'react-native'

import { Card, Skeleton } from '../../components/atoms'
import { noticeBannerRatio } from '../../features/notice/notice-display'
import type { NoticeKind } from '../../types/notice'
import { SETTINGS_ROW_DIVIDER_CLASS } from './row-class'

/**
 * `NoticeLines` 한 줄의 글자 줄 높이(px). `typography.cjs` 의 `sm`·`xs` 와 같아야 한다.
 *
 * 값을 여기 적는 이유는 스켈레톤이 글자가 아니라 **상자**를 세우기 때문이다. 어기면 카드 높이가
 * 결과와 달라진다.
 */
const TITLE_HEIGHT = 20
const DATE_HEIGHT = 17

/** 배너 갈래(진행 중인 이벤트 · 캐시샵 업데이트)의 자리. 화면 양끝까지 닿는 한 칸이다. */
export function NoticeBannerSkeleton(props: { kind: NoticeKind }): React.JSX.Element {
  return (
    // 조회 중임을 말하는 것은 이 상자다. 안쪽 막대는 장식이라 스스로 숨는다.
    <View
      testID="notice-banner-skeleton"
      role="status"
      aria-busy
      className="w-full overflow-hidden"
      style={{ aspectRatio: noticeBannerRatio(props.kind) }}
    >
      {/* 배너는 모서리가 각지다. 그림이 그 자리를 그대로 채운다. */}
      <Skeleton className="flex-1" fillClassName="rounded-none" />
    </View>
  )
}

/** 한 줄. 제목과 날짜가 각자 자기 글자의 줄 높이를 상자로 든다. */
function SkeletonRow(): React.JSX.Element {
  return (
    <View testID="notice-skeleton-row" className="gap-0.5 py-3">
      <View testID="notice-skeleton-title" style={{ height: TITLE_HEIGHT }} className="justify-center">
        {/* 막대는 줄 높이보다 낮다. 상자를 꽉 채우면 글자가 아니라 덩어리로 읽힌다. */}
        <Skeleton className="h-3 w-4/5" />
      </View>
      <View testID="notice-skeleton-date" style={{ height: DATE_HEIGHT }} className="justify-center">
        <Skeleton className="h-2.5 w-16" />
      </View>
    </View>
  )
}

/**
 * 글 갈래(NOTICE · 공지 사항 · 업데이트)의 자리.
 *
 * @param props.lines 그 갈래가 보여 줄 줄 수. `NOTICE_SECTIONS` 의 `lines` 를 그대로 받는다
 */
export function NoticeLinesSkeleton(props: { lines: number }): React.JSX.Element {
  return (
    <Card testID="notice-lines-skeleton" role="status" aria-busy className="px-5">
      {Array.from({ length: props.lines }, (_, index) => (
        <View key={index} className={index === 0 ? '' : SETTINGS_ROW_DIVIDER_CLASS}>
          <SkeletonRow />
        </View>
      ))}
    </Card>
  )
}

/**
 * `NoticeBannerCard` 의 제목 · 기간 줄 높이(px). `typography.cjs` 의 `13`·`xs` 와 같아야 한다.
 *
 * 여백(`px-3.5 pb-2 pt-2.5` · `pb-2 pt-1.5`)은 아래에서 **그 카드와 같은 문자열**을 쓴다. 값을
 * 옮겨 적으면 한쪽만 바뀐다.
 */
const CARD_TITLE_HEIGHT = 19
const CARD_PERIOD_HEIGHT = 17

/**
 * `전체` 목록 화면의 이벤트 · 캐시샵 카드 한 장의 자리.
 *
 * **제목은 한 줄로 잡는다.** 실제 제목은 두 줄까지 가는데 몇 줄일지는 받아 봐야 안다. 짧게 잡으면
 * 도착할 때 아래로 밀리고 길게 잡으면 위로 당겨지는데, 아래로 밀리는 쪽이 읽던 자리를 덜 흔든다.
 */
export function NoticeBannerCardSkeleton(props: { kind: NoticeKind }): React.JSX.Element {
  return (
    <Card testID="notice-card-skeleton" role="status" aria-busy className="overflow-hidden">
      <Skeleton
        testID="notice-card-skeleton-art"
        className="w-full"
        fillClassName="rounded-none"
        style={{ aspectRatio: noticeBannerRatio(props.kind) }}
      />
      {/* 여백은 `NoticeBannerCard` 의 제목 줄과 같은 문자열이다. */}
      <View className="items-center px-3.5 pb-2 pt-2.5">
        <View testID="notice-card-skeleton-title" style={{ height: CARD_TITLE_HEIGHT }} className="justify-center">
          <Skeleton className="h-3 w-40" />
        </View>
      </View>
      {/* 기간 줄. 이벤트는 넥슨이 기간을 주고 캐시샵은 없으면 `상시 판매` 라, 이 줄이 빠지는 카드는
          드물다. 빼 두면 있는 쪽이 도착할 때마다 밀린다. */}
      <View className="mx-3.5 flex-row items-center justify-center gap-1 border-t border-border pb-2 pt-1.5">
        <View testID="notice-card-skeleton-period" style={{ height: CARD_PERIOD_HEIGHT }} className="justify-center">
          <Skeleton className="h-2.5 w-28" />
        </View>
      </View>
    </Card>
  )
}
