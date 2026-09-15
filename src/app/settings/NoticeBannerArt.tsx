/**
 * 이벤트 · 캐시샵 배너 그림 한 칸. 분류가 정한 비율로 자리를 먼저 잡는다.
 *
 * 그림을 받은 뒤 비율을 재면 목록이 그림마다 한 번씩 흔들린다. 넥슨 썸네일은 분류마다 크기가 하나라(이벤트 285×120 ·
 * 캐시샵 443×130 실측) 비율을 미리 정하고, 크기가 바뀌어도 잘리지 않게 `contain` 으로 그린다.
 */
import { useState } from 'react'
import { Image, View } from 'react-native'

import { noticeBannerRatio } from '../../features/notice/notice-display'
import type { Notice } from '../../types/notice'

/** 그림이 없거나 못 받으면 빈 자리만 남는다. 제목은 부르는 쪽(배너 칸의 캡슐 · 카드의 제목 줄)이 적는다. */
export function NoticeBannerArt(props: { notice: Notice }): React.JSX.Element {
  const { notice } = props
  // 주소가 바뀌면 실패 기록도 새로 시작한다. 사본에서 받은 목록으로 바뀌며 주소가 생기는 경우다.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const url = notice.thumbnailUrl
  const showImage = url !== undefined && failedUrl !== url

  return (
    <View className="w-full overflow-hidden bg-surface-2" style={{ aspectRatio: noticeBannerRatio(notice.kind) }}>
      {showImage ? (
        <Image
          testID="notice-banner-image"
          accessibilityIgnoresInvertColors
          source={{ uri: url }}
          resizeMode="contain"
          style={{ width: '100%', height: '100%' }}
          onError={() => setFailedUrl(url)}
        />
      ) : null}
    </View>
  )
}
