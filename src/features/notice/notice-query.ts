/**
 * 소식 목록을 분류마다 드는 쿼리. 더보기 · 소식 목록 · today 배너 · 상세가 같은 캐시를 본다.
 *
 * 기기에 저장된다(`persist`). 앱을 켜면 저장된 목록이 먼저 서고 조회가 그것을 바꾼다. 전에는 Preferences 에 사본을 따로
 * 두고 화면마다 사본 읽기 → 조회 → 덮기를 했는데, 저장된 쿼리가 같은 일을 하므로 사본을 걷었다.
 *
 * `staleTime` 이 0 이라 보는 화면이 포커스될 때마다 다시 받고, 복귀에도 받는다(#812 A7 · A8). 실패하면 든 값을 지킨다.
 * 빈 배열은 실패가 아니라 지금 게시 중인 글이 없다는 답이다.
 */
import { queryOptions, useQueries, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'

import { keepDismissedNotices } from '../../storage/notice-banner'
import { NOTICE_KINDS, type Notice, type NoticeKind } from '../../types/notice'
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'
import { receiveNoticeKind } from './notice-feed'
import { pickBannerNotice } from './pick-banner-notice'
import { useNoticeDismissal } from './banner-dismissal'

export function noticesOptions(kind: NoticeKind) {
  return queryOptions<Notice[]>({
    queryKey: queryKeys.notices(kind),
    queryFn: async () => {
      const received = await receiveNoticeKind(kind)
      // 실패를 던져야 쿼리가 든 값을 지킨다. `null` 을 데이터로 넣으면 있던 목록이 사라진다.
      if (received === null) throw new Error(`소식(${kind})을 받지 못했다`)
      // 닫은 기록은 앱 공지 id 만 든다. 앱 공지를 받은 자리에서만 정리해야 게임 공지 응답으로 닫아 둔 배너가 되살아나지 않는다.
      if (kind === 'app') await keepDismissedNotices(received.map((notice) => notice.id)).catch(() => undefined)
      return received
    },
    staleTime: 0,
    refetchOnWindowFocus: 'always',
    meta: { persist: true, source: 'server' },
  })
}

/**
 * 분류마다의 목록. `null` 은 **아직 모른다**(첫 조회 중)이고 빈 배열은 없다는 답이다. 실패했는데 든 값도 없으면 빈 배열이다.
 * 아직 도는 조회를 두고 `없습니다` 를 말하지 않으면서, 실패한 갈래가 영영 스켈레톤으로 남지도 않는다.
 */
export type NoticesByKind = Readonly<Record<NoticeKind, Notice[] | null>>

export function useNotices(kinds: readonly NoticeKind[]): NoticesByKind {
  const combine = useCallback(
    (results: { data: Notice[] | undefined; isPending: boolean }[]) => {
      const byKind = {} as Record<NoticeKind, Notice[] | null>
      kinds.forEach((kind, index) => {
        const result = results[index]
        byKind[kind] = result.data ?? (result.isPending ? null : [])
      })
      return byKind as NoticesByKind
    },
    [kinds],
  )
  return useQueries({ queries: kinds.map((kind) => noticesOptions(kind)), combine })
}

/**
 * 갈래 여럿을 신선해도 다시 받는다. 당김이 부른다.
 *
 * @returns `allFailed` 는 준 갈래가 **전부** 실패했을 때만 참. 키가 없으면 넥슨 네 갈래가 언제나 실패라 일부 실패는 정상이다
 */
export async function refreshNoticeKinds(kinds: readonly NoticeKind[]): Promise<{ allFailed: boolean }> {
  const outcomes = await Promise.all(
    kinds.map((kind) =>
      queryClient.fetchQuery({ ...noticesOptions(kind), staleTime: 0 }).then(
        () => true,
        () => false,
      ),
    ),
  )
  return { allFailed: outcomes.every((succeeded) => !succeeded) }
}

/** 캐시에 든 공지 하나. 상세 화면이 조회를 기다리기 전에 먼저 그리는 데 쓴다. 없으면 `null`. */
export function findCachedNotice(id: string): Notice | null {
  for (const kind of NOTICE_KINDS) {
    const found = queryClient.getQueryData<Notice[]>(queryKeys.notices(kind))?.find((notice) => notice.id === id)
    if (found !== undefined) return found
  }
  return null
}

/** 서버가 없다고 답한 공지를 캐시에서 뺀다. 닫은 기록도 함께 정리한다. */
export async function forgetNotice(id: string): Promise<void> {
  for (const kind of NOTICE_KINDS) {
    queryClient.setQueryData<Notice[]>(queryKeys.notices(kind), (notices) =>
      notices === undefined ? undefined : notices.filter((notice) => notice.id !== id),
    )
  }
  await useNoticeDismissal.getState().forget(id)
}

/** 앱 공지가 새로 왔을 수 있다는 신호. 앞에 있을 때 받은 푸시가 부른다. 보고 있는 화면이 있으면 그 자리에서 다시 받는다. */
export async function invalidateAppNotices(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.notices('app') })
}

export interface NoticeBannerState {
  /** 세울 공지. `null` 이면 배너가 렌더 자체를 안 한다. */
  notice: Notice | null
  /** 세워진 공지를 배너에서 닫는다. 목록과 상세에는 그대로 남는다. */
  dismiss: () => Promise<void>
}

/** today 배너가 세우는 공지 하나. 앱 공지 쿼리에서 닫은 것을 빼고 고른다. */
export function useNoticeBanner(): NoticeBannerState {
  const { data } = useQuery(noticesOptions('app'))
  const dismissedIds = useNoticeDismissal((state) => state.dismissedIds)
  const restore = useNoticeDismissal((state) => state.restore)
  useEffect(() => {
    void restore()
  }, [restore])

  const notice = data === undefined ? null : pickBannerNotice(data, dismissedIds)
  return {
    notice,
    dismiss: () => (notice === null ? Promise.resolve() : useNoticeDismissal.getState().dismiss(notice.id)),
  }
}
