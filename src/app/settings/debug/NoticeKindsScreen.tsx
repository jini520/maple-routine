/**
 * 임시 점검 화면. 공지 네 갈래를 **넥슨이 주는 것**과 **우리 서버가 든 것** 양쪽으로 본다.
 *
 * 출처가 둘인 것이 이 도구의 전부다. 둘을 나란히 보면 «넥슨에는 있는데 서버에 없다»(폴러가
 * 아직 안 돌았다)와 «양쪽 다 없다»(넥슨이 진짜 안 준다)가 갈린다. 제품 화면(설정 > 공지사항)은
 * 켠 토글만 보여 주고 조회 실패를 빈 목록으로 접어서 그 구분을 못 한다.
 *
 * ⚠️ **임시다.** 폐기 절차는 넷이다.
 * ① `src/app/settings/debug/` 폴더 삭제
 * ② `navigation/routes.ts` 의 `SettingsDebugNoticeKinds` 두 자리(파라미터 목록 · `ROUTE_TABLE`) 삭제
 * ③ `navigation/RootNavigator.tsx` 의 등록 한 줄과 import 삭제
 * ④ `app/settings/SettingsScreen.tsx` 의 행 삭제
 * 딸린 테스트 단언도 ⚠️ 표시를 따라가면 나온다(`SettingsScreen.test.tsx` · `routes.test.ts`).
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
import { NoticeBlocks } from '../NoticeBlocks'
import { parseContents } from './html-preview'
import {
  describeContents,
  probeNexonDetail,
  probeNexonList,
  type NexonNoticeKind,
  type NexonProbe,
  type NexonRow,
} from './nexon-probe'
import { probeDetail, probeList, type ProbeResult, type RawNotice } from './probe'

type Source = 'nexon' | 'server'

/**
 * 미리보기에서 한 번에 그리는 블록 수.
 *
 * 업데이트 한 건이 797블록이다(실측). 다 그리면 펼치는 순간 화면이 멎어 도구를 못 쓴다.
 * 자른 사실은 아래 줄이 말한다 - 몇 개 중 몇 개인지 안 적으면 그것대로 거짓말이 된다.
 */
const PREVIEW_BLOCK_LIMIT = 200

/** 넥슨에서 오는 넷만 본다. 앱 공지는 제품 화면이 이미 보여 준다. */
const KINDS: readonly { kind: NexonNoticeKind; label: string }[] = [
  { kind: 'game', label: '게임 공지' },
  { kind: 'update', label: '업데이트' },
  { kind: 'event', label: '이벤트' },
  { kind: 'cashshop', label: '캐시샵' },
]

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

/** 한 줄 아래에 붙는 회색 메타. 목록마다 적는 것이 달라 문자열로 받는다. */
function Meta(props: { children: string }): React.JSX.Element {
  return <Text className="text-[10px] leading-3 text-text-disabled">{props.children}</Text>
}

/**
 * 넥슨 상세. 원문 HTML 을 **서버와 같은 파서로 블록으로 바꿔** 보여 준다.
 *
 * 원문을 그대로 세우면 태그가 글자의 90%를 넘어 읽을 것이 없다(공지 한 건이 HTML 17,596자에
 * 텍스트 826자다). 여기서 보이는 것이 곧 서버 배포 뒤 사용자가 볼 화면이다.
 */
function NexonDetail(props: { kind: NexonNoticeKind; noticeId: number }): React.JSX.Element {
  const [result, setResult] = useState<NexonProbe<{ contents?: string }> | null>(null)

  useEffect(() => {
    let alive = true
    void probeNexonDetail(props.kind, props.noticeId).then((next) => {
      if (alive) setResult(next)
    })
    return () => {
      alive = false
    }
  }, [props.kind, props.noticeId])

  if (result === null) return <Text className="py-2 text-xs text-text-disabled">받는 중…</Text>
  if (result.error !== null || result.data === null) {
    return (
      <Text className="py-2 text-xs text-error-ink">상세 실패 · {result.error ?? '본문 없음'}</Text>
    )
  }

  const contents = result.data.contents ?? ''
  const blocks = parseContents(contents)
  const counts: Record<string, number> = {}
  for (const block of blocks) counts[block.type] = (counts[block.type] ?? 0) + 1

  return (
    <View className="gap-2 pb-3">
      <Meta>{`${result.ms}ms · ${describeContents(contents)}`}</Meta>
      <Meta>{`파싱 → 블록 ${blocks.length}개 ${JSON.stringify(counts)}`}</Meta>
      {blocks.length > PREVIEW_BLOCK_LIMIT && (
        <Meta>{`${blocks.length}개 중 앞 ${PREVIEW_BLOCK_LIMIT}개만 그린다`}</Meta>
      )}
      {blocks.length === 0 ? (
        <Text className="text-xs text-text-disabled">
          {contents === '' ? '(contents 가 비어 있다)' : '(파싱 결과가 비었다)'}
        </Text>
      ) : (
        <NoticeBlocks blocks={blocks.slice(0, PREVIEW_BLOCK_LIMIT)} />
      )}
    </View>
  )
}

/** 우리 서버 상세. 여기에만 `blocks` 가 실려 온다(목록은 안 싣는다). */
function ServerDetail(props: { id: string }): React.JSX.Element {
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
    <View className="gap-2 pb-3">
      <Meta>
        {`${result.status} · ${result.ms}ms · ${
          blocks === undefined
            ? 'blocks 가 없다 (서버가 아직 옛 코드이거나 앱 공지다)'
            : `블록 ${blocks.length}개 ${JSON.stringify(counts)}`
        }`}
      </Meta>
      {blocks === undefined ? (
        <Text className="text-sm leading-5 text-text">{result.data.body ?? '(body 도 없다)'}</Text>
      ) : (
        <NoticeBlocks blocks={blocks} />
      )}
    </View>
  )
}

/** 기간을 든 분류만 그 줄을 더 적는다. 이벤트와 캐시샵의 필드 이름이 서로 다르다. */
function periodOf(row: NexonRow): string | null {
  const start = row.date_event_start ?? row.date_sale_start
  const end = row.date_event_end ?? row.date_sale_end
  if (start == null && end == null) {
    return row.ongoing_flag === 'true' ? '상시' : null
  }
  return `${start ?? '?'} ~ ${end ?? '?'}`
}

export function NoticeKindsScreen(): React.JSX.Element {
  const navigation = useSettingsNavigation()
  const [source, setSource] = useState<Source>('nexon')
  const [kind, setKind] = useState<NexonNoticeKind>('game')
  const [nexon, setNexon] = useState<NexonProbe<NexonRow[]> | null>(null)
  const [server, setServer] = useState<ProbeResult<{
    items: RawNotice[]
    nextCursor: string | null
  }> | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  /** 같은 조건을 다시 조회하는 열쇠. 값이 안 바뀌면 이펙트가 안 돈다. */
  const [attempt, setAttempt] = useState(0)

  // 비우는 것은 누른 자리가 한다. 이펙트 안에서 동기로 비우면 그 자체가 한 번 더 그리게 한다.
  const reset = (): void => {
    setNexon(null)
    setServer(null)
    setOpenKey(null)
  }

  useEffect(() => {
    let alive = true
    if (source === 'nexon') {
      void probeNexonList(kind).then((next) => {
        if (alive) setNexon(next)
      })
    } else {
      void probeList(kind).then((next) => {
        if (alive) setServer(next)
      })
    }
    return () => {
      alive = false
    }
  }, [source, kind, attempt])

  const nexonRows = nexon?.data ?? []
  const serverRows = server?.data?.items ?? []
  const pending = source === 'nexon' ? nexon === null : server === null
  const error = source === 'nexon' ? nexon?.error : server?.error
  const count = source === 'nexon' ? nexonRows.length : serverRows.length
  const path = source === 'nexon' ? nexon?.path : server?.url

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
          <Chip
            label="넥슨 Open API"
            on={source === 'nexon'}
            onPress={() => {
              if (source === 'nexon') return
              reset()
              setSource('nexon')
            }}
          />
          <Chip
            label="우리 서버"
            on={source === 'server'}
            onPress={() => {
              if (source === 'server') return
              reset()
              setSource('server')
            }}
          />
        </View>

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
            {pending
              ? '조회 중…'
              : error != null
                ? `실패 · ${error}`
                : `${source === 'nexon' ? '넥슨' : '서버'} · ${count}건`}
          </Text>
          <Meta>{path ?? '…'}</Meta>
          {!pending && error == null && count === 0 && (
            <Text className="pt-1 text-xs text-text-disabled">
              {source === 'nexon'
                ? '넥슨이 이 분류로 주는 것이 지금 없다.'
                : '조회는 됐고 서버에 이 분류가 없다. 서버 배포와 첫 폴링이 끝나야 찬다.'}
            </Text>
          )}
        </Card>

        {source === 'nexon' && nexonRows.length > 0 && (
          <Card className="px-4">
            {nexonRows.map((row, index) => {
              const key = String(row.notice_id ?? index)
              const period = periodOf(row)
              return (
                <View key={key} className={index === 0 ? '' : 'border-t border-border'}>
                  <Pressable
                    role="button"
                    aria-label={`${row.title ?? key} 펼치기`}
                    onPress={() => setOpenKey(openKey === key ? null : key)}
                    className="flex-row items-center gap-2 py-3"
                  >
                    <View className="shrink gap-0.5">
                      <Text className="text-sm text-text">{row.title ?? '(title 없음)'}</Text>
                      <Meta>{`${row.date ?? '(date 없음)'} · notice_id=${row.notice_id ?? '없음'}`}</Meta>
                      {period !== null && <Meta>{period}</Meta>}
                    </View>
                    {openKey === key ? (
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
                  {openKey === key && row.notice_id !== undefined && (
                    <NexonDetail kind={kind} noticeId={row.notice_id} />
                  )}
                </View>
              )
            })}
          </Card>
        )}

        {source === 'server' && serverRows.length > 0 && (
          <Card className="px-4">
            {serverRows.map((notice, index) => (
              <View key={notice.id ?? index} className={index === 0 ? '' : 'border-t border-border'}>
                <Pressable
                  role="button"
                  aria-label={`${notice.title ?? notice.id} 펼치기`}
                  onPress={() => setOpenKey(openKey === notice.id ? null : (notice.id ?? null))}
                  className="flex-row items-center gap-2 py-3"
                >
                  <View className="shrink gap-0.5">
                    <Text className="text-sm text-text">{notice.title ?? '(title 없음)'}</Text>
                    {/* `kind` 가 비면 서버가 아직 옛 코드다. 그것이 이 자리가 답하는 질문이다. */}
                    <Meta>
                      {`${
                        notice.publishedAt === undefined
                          ? '(publishedAt 없음)'
                          : formatNoticeDate(notice.publishedAt)
                      } · ${notice.id ?? '(id 없음)'} · kind=${notice.kind ?? '없음'}`}
                    </Meta>
                  </View>
                  {openKey === notice.id ? (
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
                {openKey === notice.id && notice.id !== undefined && <ServerDetail id={notice.id} />}
              </View>
            ))}
          </Card>
        )}
      </View>
    </ScreenScroll>
  )
}
