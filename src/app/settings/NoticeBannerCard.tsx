/**
 * `전체` 목록 화면의 이벤트 · 캐시샵 카드 한 장. 그림 · 제목 · 기간이다.
 *
 * 구분선은 없다. 제목과 기간은 글자 크기와 색으로 갈린다. 목록은 여러 건을 훑는 자리라 칸을 좁게 둔다.
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
        <View className="gap-1 px-3.5 pb-3 pt-2.5">
          <Text numberOfLines={2} className="text-sm font-medium text-text">
            {title}
          </Text>
          {period !== null && (
            <View className="flex-row items-center gap-1">
              <CalendarCheckIcon className="h-3 w-3 text-text-muted" strokeWidth={2} aria-hidden />
              <Text testID="notice-banner-period" className="text-xs text-text-muted">
                {period}
              </Text>
            </View>
          )}
        </View>
      </Card>
    </Pressable>
  )
}
