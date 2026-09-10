/**
 * 임시 점검 화면. 서버가 분류별로 무엇을 들고 있는지 눈으로 본다.
 *
 * 만든 이유는 새로 들인 네 갈래가 **앱에서 한 번도 안 보인 상태**라서다. 제품 화면
 * (설정 > 공지사항)은 켠 토글만 보여 주고 실패를 빈 목록으로 접으므로, 서버에 그 분류가 아직
 * 없는 것인지 조회가 실패한 것인지 거기서는 못 가린다. 이 화면은 **HTTP 상태와 사유를 그대로**
 * 적는다.
 *
 * ⚠️ **임시다.** 폐기 절차는 넷이다.
 * ① `src/app/settings/debug/` 폴더 삭제
 * ② `navigation/routes.ts` 의 `SettingsDebugNoticeKinds` 한 줄 삭제
 * ③ `navigation/RootNavigator.tsx` 의 등록 한 줄과 import 삭제
 * ④ `app/settings/SettingsScreen.tsx` 의 행 삭제
 */
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'

import {
  ArrowLeftIcon,
  Card,
  ChevronDownIcon,
  ChevronRightIcon,
  FlaskConicalIcon,
  RefreshCwIcon,
  Text,
} from '../../../components/atoms'
import { PageHeader } from '../../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../../components/templates/ScreenScroll/ScreenScroll'
import { formatNoticeDate } from '../../../features/notice/format'
import { useSettingsNavigation } from '../../../hooks/useSettingsNavigation'
import type { NoticeKind } from '../../../types/notice'
import { NoticeBlocks } from '../NoticeBlocks'
import { probeDetail, probeList, type ProbeResult, type RawNotice } from './probe'

/** 넥슨에서 오는 넷만 본다. 앱 공지는 제품 화면이 이미 보여 준다. */
const KINDS: readonly { kind: NoticeKind; label: string }[] = [
  { kind: 'game', label: '게임 공지' },
  { kind: 'update', label: '업데이트' },
  { kind: 'event', label: '이벤트' },
  { kind: 'cashshop', label: '캐시샵' },
]

type ListResult = ProbeResult<{ items: RawNotice[]; nextCursor: string | null }>

function Chip(props: { label: string; on: boolean; onPress: () => void }): React.JSX.Element {
  return (
    <Pressable
      role="button"
      aria-label={`${props.label} 보기`}
      onPress={props.onPress}
      className={`rounded-full px-3 py-1.5 ${props.on ? 'bg-primary' : 'bg-surface-2'}`}
    >
      <Text className={`text-xs ${props.on ? 'text-white' : 'text-text-muted'}`}>{props.label}</Text>
    </Pressable>
  )
}

/** 펼친 한 건. 상세를 따로 받아야 `blocks` 가 온다(목록은 안 싣는다). */
function ExpandedDetail(props: { id: string }): React.JSX.Element {
  const [result, setResult] = useState<ProbeResult<RawNotice> | null>(null)

  useEffect(() => {
    let alive = true
    void probeDetail(props.id).then((next) => {
      if (alive) setResult(next)
    })
    return () => {
      alive = false
    }
  }, [props.id])

  if (result === null) return <Text className="py-2 text-xs text-text-disabled">받는 중…</Text>

  if (result.error !== null || result.data === null) {
    return (
      <Text className="py-2 text-xs text-error-ink">
        상세 실패 · {result.status ?? '응답 없음'} · {result.error ?? '본문 없음'}
      </Text>
    )
  }

  const blocks = result.data.blocks
  const counts: Record<string, number> = {}
  for (const block of blocks ?? []) counts[block.type] = (counts[block.type] ?? 0) + 1

  return (
    <View className="gap-2 py-2">
      <Text className="text-xs text-text-disabled">
        {result.status} · {result.ms}ms ·{' '}
        {blocks === undefined
          ? 'blocks 가 없다 (서버가 아직 옛 코드이거나 앱 공지다)'
          : `블록 ${blocks.length}개 ${JSON.stringify(counts)}`}
      </Text>
      {blocks === undefined ? (
        <Text className="text-sm leading-5 text-text">{result.data.body ?? '(body 도 없다)'}</Text>
      ) : (
        <NoticeBlocks blocks={blocks} />
      )}
    </View>
  )
}

export function NoticeKindsScreen(): React.JSX.Element {
  const navigation = useSettingsNavigation()
  const [kind, setKind] = useState<NoticeKind>('game')
  const [result, setResult] = useState<ListResult | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  /** 같은 분류를 다시 조회하는 열쇠. 값이 안 바뀌면 이펙트가 안 돈다. */
  const [attempt, setAttempt] = useState(0)

  // 비우는 것은 누른 자리가 한다. 이펙트 안에서 동기로 비우면 그 자체가 한 번 더 그리게 한다.
  const reset = (): void => {
    setResult(null)
    setOpenId(null)
  }

  useEffect(() => {
    let alive = true
    void probeList(kind).then((next) => {
      if (alive) setResult(next)
    })
    return () => {
      alive = false
    }
  }, [kind, attempt])

  const items = result?.data?.items ?? []

  return (
    <ScreenScroll
      hasTabBar={false}
      header={
        <PageHeader>
          <PageHeaderTitleRow className="gap-2">
            <Pressable
              role="button"
              aria-label="뒤로"
              onPress={() => navigation.goBack()}
              className="-ml-1 p-1"
            >
              <ArrowLeftIcon className="h-5 w-5 text-text-muted" strokeWidth={2} aria-hidden />
            </Pressable>
            <Text className="text-lg font-semibold text-text">공지 분류 점검</Text>
            <FlaskConicalIcon className="h-4 w-4 text-text-disabled" strokeWidth={2} aria-hidden />
            <Pressable
              role="button"
              aria-label="다시 조회"
              onPress={() => {
                reset()
                setAttempt((n) => n + 1)
              }}
              className="ml-auto p-1"
            >
              <RefreshCwIcon className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
            </Pressable>
          </PageHeaderTitleRow>
        </PageHeader>
      }
    >
      <View className="gap-3 px-4 pb-4" testID="screen-SettingsDebugNoticeKinds">
        <View className="flex-row flex-wrap gap-2">
          {KINDS.map((one) => (
            <Chip
              key={one.kind}
              label={one.label}
              on={one.kind === kind}
              onPress={() => {
                if (one.kind === kind) return
                reset()
                setKind(one.kind)
              }}
            />
          ))}
        </View>

        <Card className="gap-1 p-4">
          {/* 조회의 사실을 그대로 적는다. 0건과 실패를 가르는 것이 이 화면의 일이다. */}
          <Text testID="probe-status" className="text-xs text-text-muted">
            {result === null
              ? '조회 중…'
              : result.error !== null
                ? `실패 · ${result.status ?? '응답 없음'} · ${result.error}`
                : `${result.status} · ${result.ms}ms · ${items.length}건`}
          </Text>
          <Text className="text-[10px] leading-3 text-text-disabled">
            {result?.url ?? `…?kind=${kind}`}
          </Text>
          {result !== null && result.error === null && items.length === 0 && (
            <Text className="pt-1 text-xs text-text-disabled">
              조회는 됐고 서버에 이 분류가 없다. 서버 배포와 첫 폴링이 끝나야 찬다.
            </Text>
          )}
        </Card>

        {items.length > 0 && (
          <Card className="px-4">
            {items.map((notice, index) => (
              <View key={notice.id ?? index} className={index === 0 ? '' : 'border-t border-border'}>
                <Pressable
                  role="button"
                  aria-label={`${notice.title ?? notice.id} 펼치기`}
                  onPress={() => setOpenId(openId === notice.id ? null : (notice.id ?? null))}
                  className="flex-row items-center gap-2 py-3"
                >
                  <View className="shrink">
                    <Text className="text-sm text-text">{notice.title ?? '(title 없음)'}</Text>
                    {/* `kind` 가 비면 서버가 아직 옛 코드다. 그것이 이 도구가 답하는 질문이다. */}
                    <Text className="text-[10px] text-text-disabled">
                      {notice.publishedAt === undefined
                        ? '(publishedAt 없음)'
                        : formatNoticeDate(notice.publishedAt)}{' '}
                      · {notice.id} · kind={notice.kind ?? '없음'}
                    </Text>
                  </View>
                  {openId === notice.id ? (
                    <ChevronDownIcon
                      className="ml-auto h-4 w-4 shrink-0 text-text-disabled"
                      strokeWidth={2}
                      aria-hidden
                    />
                  ) : (
                    <ChevronRightIcon
                      className="ml-auto h-4 w-4 shrink-0 text-text-disabled"
                      strokeWidth={2}
                      aria-hidden
                    />
                  )}
                </Pressable>
                {openId === notice.id && notice.id !== undefined && (
                  <ExpandedDetail id={notice.id} />
                )}
              </View>
            ))}
          </Card>
        )}
      </View>
    </ScreenScroll>
  )
}
