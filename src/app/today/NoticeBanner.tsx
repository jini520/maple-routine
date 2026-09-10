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

/** 32px 버튼을 권장 타깃 44px 로 되돌린다. 좌우는 안 넓힌다 - 나란히 선 둘이 겹친다. */
const BUTTON_HIT_SLOP = { top: 6, bottom: 6 } as const

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
    <View testID="today-notice-banner" className="bg-surface p-4">
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
          {/* 오른쪽 끝이 배너 여백과 맞는다. 무게는 셋 중 가운데다. 채우면 배너에서 가장 센
              요소가 버튼이 되어 본문보다 먼저 읽히고, 글자만 두면 `다시 보지 않기` 와 안 갈린다.

              선도 글자도 테마색이다. 밝은 테마에서 대비가 낮은 것은 알고 고른 값이다
              (머쉬맘 2.38 · 엔젤릭버스터 2.26).

              `compact` 는 이 배너가 156px 안에 머리·본문·버튼 줄을 다 넣기 때문이다. 기본 크기는
              40px 라 버튼 줄만으로 배너의 4분의 1을 먹고, 라벨이 본문(13px)보다 커서 먼저 읽힌다.
              대신 32px 는 권장 타깃 44px 아래라 `hitSlop` 이 손가락 자리를 되돌린다. 좌우로 넓히면
              나란히 선 둘의 히트 영역이 겹치므로 위아래로만 준다. */}
          <View className="mt-1.5 flex-row items-center justify-end gap-1">
            <Button
              variant="text"
              size="compact"
              hitSlop={BUTTON_HIT_SLOP}
              onPress={() => {
                // 실패는 삼킨다. 저장이 안 되면 배너가 그대로 남고, 그것이 곧 사용자에게 보이는 결과다.
                void dismiss().catch(() => undefined)
              }}
            >
              다시 보지 않기
            </Button>
            <Button
              variant="primaryOutline"
              size="compact"
              hitSlop={BUTTON_HIT_SLOP}
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
