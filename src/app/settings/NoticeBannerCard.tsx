/**
 * `전체` 목록 화면의 이벤트 · 캐시샵 카드 한 장. 그림 · 제목 · 구분선 · 기간이다.
 *
 * 넥슨 홈페이지 이벤트 목록의 카드 모양을 따르되 제목과 기간 칸을 좁혔다. 목록은 여러 건을 훑는 자리라 칸이 크면 한 화면에
 * 두 건도 안 들어온다.
 */
import { Pressable, View } from 'react-native'

import { CalendarCheckIcon, Card, Text } from '../../components/atoms'
import { noticeDisplayTitle, noticePeriodLabel } from '../../features/notice/notice-display'
import type { Notice } from '../../types/notice'
import { NoticeBannerArt } from './NoticeBannerArt'

export function NoticeBannerCard(props: { notice: Notice; onPress: () => void }): React.JSX.Element {
  const title = noticeDisplayTitle(props.notice)
  const period = noticePeriodLabel(props.notice)

  return (
    <Pressable role="button" aria-label={title} testID="notice-banner-card" onPress={props.onPress}>
      <Card className="overflow-hidden">
        <NoticeBannerArt key={props.notice.thumbnailUrl ?? ''} notice={props.notice} />
        <Text numberOfLines={2} className="px-3.5 pb-2 pt-2.5 text-center text-13 font-medium text-text">
          {title}
        </Text>
        {period !== null && (
          <View className="mx-3.5 flex-row items-center justify-center gap-1 border-t border-border pb-2 pt-1.5">
            <CalendarCheckIcon className="h-3 w-3 text-text-muted" strokeWidth={2} aria-hidden />
            <Text testID="notice-banner-period" className="text-xs text-text-muted">
              {period}
            </Text>
          </View>
        )}
      </Card>
    </Pressable>
  )
}
