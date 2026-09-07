/**
 * today 맨 위의 공지 배너. 헤더와 위젯 격자 사이에 전폭으로 선다.
 *
 * **세울 공지가 없으면 아무것도 안 그린다.** 빈 상자를 두면 격자가 이유 없이 아래로 밀린다.
 *
 * **좌우 여백을 자기가 준다.** 격자 래퍼가 `px-4` 를 쥐고 있어서 이 배너는 그 밖에 놓이는데,
 * 안쪽 여백이 같은 16 이라야 배지 왼쪽 선이 아래 타일들의 왼쪽 선과 맞는다.
 *
 * **머리 탭은 펼치기이지 이동이 아니다.** 곧장 상세로 보내면 `다시 보지 않기` 를 고를 자리가
 * 사라진다.
 *
 * @see docs/features/today.md 공지 배너 정책
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import {
  Badge,
  Button,
  ChevronDownIcon,
  ChevronUpIcon,
  MegaphoneIcon,
  Text,
} from '../../components/atoms'
import { useNoticeBannerStore } from '../../features/notice/banner-store'
import { formatNoticeDate } from '../../features/notice/format'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'

export function NoticeBanner(): React.JSX.Element | null {
  const notice = useNoticeBannerStore((state) => state.notice)
  const dismiss = useNoticeBannerStore((state) => state.dismiss)
  const navigation = useScreenNavigation()

  /**
   * 펼친 공지의 id. 불리언이 아닌 것이 요건이다. 불리언으로 두면 펼쳐 둔 채로 새 공지가 도착했을
   * 때 그것이 펼쳐진 채로 선다.
   */
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (notice === null) return null

  const expanded = expandedId === notice.id
  const Chevron = expanded ? ChevronUpIcon : ChevronDownIcon

  return (
    <View testID="today-notice-banner" className="bg-surface px-4 py-3">
      <Pressable
        role="button"
        aria-label={notice.title}
        aria-expanded={expanded}
        onPress={() => setExpandedId(expanded ? null : notice.id)}
        className="flex-row items-center gap-2.5"
      >
        <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-tint">
          <MegaphoneIcon className="h-4 w-4 text-primary-ink" strokeWidth={1.75} aria-hidden />
        </View>

        <View className="shrink grow">
          <View className="flex-row items-center gap-1.5">
            <Badge variant="primary">새 공지</Badge>
            <Text className="shrink text-11 text-text-disabled" numberOfLines={1}>
              {formatNoticeDate(notice.publishedAt)}
            </Text>
          </View>
          <Text className="text-sm font-semibold text-text" numberOfLines={1}>
            {notice.title}
          </Text>
        </View>

        <Chevron className="h-4 w-4 shrink-0 text-text-muted" strokeWidth={2} aria-hidden />
      </Pressable>

      {expanded && (
        <>
          <Text className="mt-2.5 text-13 text-text-muted" numberOfLines={2}>
            {notice.body}
          </Text>
          {/* 오른쪽 끝이 배너 여백과 맞는다. 채운 알약을 안 쓰는 것은 배너 전체가 이미 누르는
              물건이라 그 안에서 버튼이 또 도드라지면 본문보다 먼저 읽히기 때문이다. */}
          <View className="mt-1 flex-row items-center justify-end">
            <Button
              variant="text"
              onPress={() => {
                // 실패는 삼킨다. 저장이 안 되면 배너가 그대로 남고, 그것이 곧 사용자에게 보이는 결과다.
                void dismiss().catch(() => undefined)
              }}
            >
              다시 보지 않기
            </Button>
            <Button
              variant="tint"
              onPress={() => navigation.navigate('SettingsNoticeDetail', { noticeId: notice.id })}
            >
              자세히 보기
            </Button>
          </View>
        </>
      )}
    </View>
  )
}
