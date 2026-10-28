/**
 * 글 공지(앱 공지 · 게임 공지 · 업데이트)의 줄 목록 카드. 한 줄은 제목과 날짜다.
 *
 * 더보기와 `전체` 목록 화면이 같은 줄을 쓴다. 더보기는 최근 몇 줄만 제목 한 줄로 자르고, 목록 화면은 제목 전체를 읽으러
 * 오는 자리라 자르지 않는다.
 */
import { Pressable } from 'react-native'

import { Card, Text } from '../../components/atoms'
import { formatNoticeDate } from '../../features/notice/format'
import type { Notice } from '../../types/notice'
import { NOTICE_LINE_CLASS, SETTINGS_CARD_CLASS } from './row-class'

/**
 * @param props.titleLines 제목 줄 수. 주지 않으면 자르지 않는다
 */
export function NoticeLines(props: {
  notices: readonly Notice[]
  titleLines?: number
  onPress: (notice: Notice) => void
}): React.JSX.Element {
  return (
    <Card className={SETTINGS_CARD_CLASS}>
      {props.notices.map((notice) => (
        <Pressable
          key={notice.id}
          role="button"
          aria-label={notice.title}
          testID="notice-row"
          onPress={() => props.onPress(notice)}
          className={NOTICE_LINE_CLASS}
        >
          <Text numberOfLines={props.titleLines} className="text-sm text-text">
            {notice.title}
          </Text>
          <Text className="text-xs text-text-disabled">{formatNoticeDate(notice.publishedAt)}</Text>
        </Pressable>
      ))}
    </Card>
  )
}
