/**
 * 글 공지(앱 공지 · 게임 공지 · 업데이트)의 줄 목록 카드. 한 줄은 제목과 날짜다.
 *
 * 더보기와 `전체` 목록 화면이 같은 줄을 쓴다. 더보기는 최근 몇 줄만 제목 한 줄로 자르고, 목록 화면은 제목 전체를 읽으러
 * 오는 자리라 자르지 않는다.
 */
import { Pressable, View } from 'react-native'

import { Card, Text } from '../../components/atoms'
import { formatNoticeDate } from '../../features/notice/format'
import type { Notice } from '../../types/notice'
import { SETTINGS_ROW_DIVIDER_CLASS } from './row-class'

/**
 * @param props.titleLines 제목 줄 수. 주지 않으면 자르지 않는다
 */
export function NoticeLines(props: {
  notices: readonly Notice[]
  titleLines?: number
  onPress: (notice: Notice) => void
}): React.JSX.Element {
  return (
    <Card className="px-5">
      {props.notices.map((notice, index) => (
        <View key={notice.id} className={index === 0 ? '' : SETTINGS_ROW_DIVIDER_CLASS}>
          <Pressable
            role="button"
            aria-label={notice.title}
            testID="notice-row"
            onPress={() => props.onPress(notice)}
            className="gap-0.5 py-3"
          >
            <Text numberOfLines={props.titleLines} className="text-sm text-text">
              {notice.title}
            </Text>
            <Text className="text-xs text-text-disabled">{formatNoticeDate(notice.publishedAt)}</Text>
          </Pressable>
        </View>
      ))}
    </Card>
  )
}
