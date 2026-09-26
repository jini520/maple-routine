/**
 * 더보기 탭. **읽는 것만 남은 화면이다.**
 *
 * 이름이 `설정` 이 아닌 이유. 이 탭이 드는 것이 성질로 셋이었다 - 매일 바뀌는 소식 · 평생 한 번
 * 누르는 응원 · 가끔 바꾸는 설정. 셋을 덮는 말은 `여러 가지` 뿐이라 이름이 아무 말도 못 한다.
 * 그래서 **설정을 머리의 톱니바퀴 뒤로 보내고**(`AppSettingsScreen`) 여기에는 읽을 것만 남겼다.
 *
 * 순서는 **얼마나 자주 바뀌는가**로 정한다. 소식이 맨 위이고 응원이 맨 아래다. 자주 바뀌는 것을
 * 아래 두면 사용자가 스크롤을 배워야 한다.
 *
 * 소식은 행을 눌러 여는 목록이 아니라 첫 화면에 갈래로 펼친다. 이벤트 · 캐시샵은 본문이 그림 한 장이라 제목만으로는 무엇인지
 * 알 수 없어 배너로 세운다. 버전 · 출처 표기는 설정 화면 맨 아래에 있다. 소식 갈래로 길어진 이 화면 끝에 두면 멀리 밀린다.
 *
 * **이 화면에는 고정 헤더(`PageHeader`)를 두지 않는다**. 그 ADR 이 단 재판단 조건은 *"행이 늘어
 * 세로가 길어지면"* 인데, 설정을 내보내 **순감**이라 조건에 걸리지 않는다.
 */
import { useCallback, useEffect, useState } from 'react'
import { Platform, Pressable, View } from 'react-native'
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native'


import { useRunningAppVersion } from '../../features/live-update/use-running-app-version'
import { useToastStore } from '../../features/toast/store'
import { Card, GearIcon, Text } from '../../components/atoms'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import type { TabParamList } from '../../navigation/routes'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { tapFeedback } from '../../native/haptics'
import { emptyNoticeText } from '../../features/notice/notice-display'
import { groupNoticesByKind, refreshNoticeKinds } from '../../features/notice/notice-feed'
import { getNotices } from '../../storage/notices'
import { NOTICE_KINDS, type Notice, type NoticeKind } from '../../types/notice'
import { NoticeBannerRail } from './NoticeBannerRail'
import { NoticeBannerSkeleton, NoticeLinesSkeleton } from './NoticeSkeleton'
import { NexonLoginButton } from '../../components/molecules/NexonLoginButton/NexonLoginButton'
import { hasNexonLogin } from '../../features/auth/saved-key'
import { signInWithNexon } from '../../features/auth/nexon-login'
import { NoticeLines } from './NoticeLines'
import { SectionTitle } from './SectionTitle'
import { SettingsLinkRow } from './SettingsLinkRow'
import { SettingsRow } from './SettingsRow'
import { SETTINGS_ROW_DIVIDER_CLASS } from './row-class'
import { CONTACT_EMAIL, contactDeviceOf, contactMailUrl } from './contact-mail'
import { storeReviewUrl } from './store-review-link'

/**
 * 소식 갈래 다섯. 순서는 사용자가 정했다.
 *
 * 앱 공지와 게임 공지가 갈래 둘인 이유. 앱 공지는 이 앱의 일(점검·새 버전)이고 게임 공지는 넥슨의 일이라, 섞이면 한 줄만 보고
 * 어느 쪽 이야기인지 모른다. 이름은 `전체` 목록 화면의 제목이자 빈 문구에 들어간다.
 *
 * `lines` 는 글 갈래가 보이는 최근 글 수다. 배너 갈래는 받은 것 전부를 넘긴다.
 */
interface NoticeSection {
  label: string
  kind: NoticeKind
  /** 글 갈래가 보이는 최근 글 수. 없으면 배너 갈래다 */
  lines?: number
}

const NOTICE_SECTIONS: readonly NoticeSection[] = [
  // 앱 공지 갈래의 이름은 영문 `NOTICE` 다(사용자 지정).
  { label: 'NOTICE', kind: 'app', lines: 3 },
  // 넥슨 이벤트 목록은 지금 게시 중인 글만 준다.
  { label: '진행 중인 이벤트', kind: 'event' },
  // 넥슨 캐시샵 공지는 캐시아이템 업데이트 소식이다.
  { label: '캐시샵 업데이트', kind: 'cashshop' },
  // 넥슨 게임 공지. 이름에 `게임` 을 안 붙인다(사용자 지정).
  { label: '공지 사항', kind: 'game', lines: 3 },
  { label: '업데이트', kind: 'update', lines: 2 },
]

/**
 * 갈래 하나의 상태. `null` 은 **아직 모른다** 이고 빈 배열은 **받아 봤는데 없다** 다.
 *
 * 둘을 가르지 않으면 받아 보기도 전에 `아직 받은 진행 중인 이벤트가 없습니다` 를 말하게 된다.
 */
type NoticeState = Record<NoticeKind, Notice[] | null>

function noticeStateOf(pick: (kind: NoticeKind) => Notice[] | null): NoticeState {
  return Object.fromEntries(NOTICE_KINDS.map((kind) => [kind, pick(kind)])) as NoticeState
}

/** 첫 프레임. 다섯 갈래가 전부 스켈레톤으로 선다. */
const UNKNOWN_NOTICES = noticeStateOf(() => null)

/** 갈래 제목 줄. 이름과 그 갈래의 목록 화면을 여는 `전체` 다. */
function NoticeSectionHeader(props: { label: string; onOpenAll: () => void }): React.JSX.Element {
  return (
    <View testID="notice-section" className="flex-row items-center justify-between px-1">
      <Text className="text-sm font-semibold text-text">{props.label}</Text>
      <Pressable role="button" aria-label={`${props.label} 전체`} onPress={props.onOpenAll} hitSlop={8}>
        <Text className="text-xs font-semibold text-primary-ink">전체</Text>
      </Pressable>
    </View>
  )
}

/**
 * 갈래 하나의 본문. **상태 셋을 가르는 자리다** - 아직 모른다 · 받아 봤는데 없다 · 글이 있다.
 *
 * 셋을 안 가르면 받아 보기 전에 `없습니다` 를 말하고, 그러고 나서 내용이 도착할 때 아래가 밀린다.
 *
 * @param props.items `null` 이면 아직 모르는 갈래다
 */
function NoticeSectionBody(props: {
  section: NoticeSection
  items: Notice[] | null
  onOpen: (notice: Notice) => void
}): React.JSX.Element {
  const { section, items } = props
  const { lines } = section

  if (items === null) {
    return lines === undefined ? (
      // 배너는 화면 양끝까지 닿는다. 화면 좌우 여백을 이 줄만 되돌린다.
      <View className="-mx-4">
        <NoticeBannerSkeleton kind={section.kind} />
      </View>
    ) : (
      <NoticeLinesSkeleton lines={lines} />
    )
  }

  if (items.length === 0) {
    // 갈래를 숨기면 화면 순서가 바뀐다.
    return (
      <Card className="px-5 py-4">
        <Text className="text-center text-sm text-text-disabled">{emptyNoticeText(section.label)}</Text>
      </Card>
    )
  }

  return lines === undefined ? (
    <View className="-mx-4">
      <NoticeBannerRail notices={items} onOpen={props.onOpen} />
    </View>
  ) : (
    <NoticeLines notices={items.slice(0, lines)} titleLines={1} onPress={props.onOpen} />
  )
}

export function SettingsScreen(): React.JSX.Element {
  // 저장 로직을 새로 갖지 않는다. 통합 키 쓰기·수동 모드 시드·추가분만 동기화·
  // 진행률 보고가 이 액션에 이미 한 벌로 들어 있다. 이름이 **컨텐츠** 인 것은 이전의
  const navigation = useSettingsNavigation()
  const route = useRoute<RouteProp<TabParamList, 'Settings'>>()

  // 보스 수익의 "캐릭터 선택하러 가기"와 두 스케줄러의 빈
  // 상태 CTA 가 캐릭터 관리를 **열어 둔 채로** 이 탭에 보낸다.
  // 목적지가 모달에서 화면으로 바뀌어도 계약은 그대로다.
  //
  // 파라미터는 **마운트 직후 지운다**. 탭 파라미터는 스택에 남아, 안 지우면 탭을 떠났다 돌아올
  // 때마다 그 화면이 다시 밀려 들어온다.
  useEffect(() => {
    if (route.params?.openPicker !== true) return
    navigation.setParams({ openPicker: undefined })
    navigation.navigate('SettingsCharacters')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const displayedVersion = useRunningAppVersion()
  const [notices, setNotices] = useState<NoticeState>(UNKNOWN_NOTICES)

  // 받은 갈래 하나를 화면에 반영한다. 진입 조회와 당김이 같은 함수로 들어온다.
  // 빈 배열이어도 그대로 둔다 - 넥슨이 `지금 게시 중인 글이 없다` 고 답한 것이라 확정이다.
  const showKind = useCallback((kind: NoticeKind, received: Notice[]): void => {
    setNotices((current) => ({ ...current, [kind]: received }))
  }, [])

  // 조회가 끝났다. 아직 모르는 갈래를 없는 것으로 확정한다. 실패한 갈래는 `showKind` 를 안 부르므로
  // (`refreshNoticeKinds` 의 계약) 이 마무리가 없으면 그 갈래가 영영 스켈레톤으로 남는다.
  const settleUnknown = useCallback((): void => {
    setNotices((current) => noticeStateOf((kind) => current[kind] ?? []))
  }, [])

  // 들어올 때마다 다섯 목록을 다시 받는다. 사본을 먼저 그리고 분류마다 받은 것으로 바꾼다. 실패한 분류는 사본이 선다.
  // 사본을 다 읽은 뒤에 부른다. 거꾸로면 늦게 끝난 사본 읽기가 방금 받은 목록을 덮는다.
  useFocusEffect(
    useCallback(() => {
      let alive = true
      void getNotices()
        .then((copy) => {
          // 사본에 글이 있는 갈래만 그린다. 빈 갈래를 `[]` 로 내리면 아직 도는 조회를 두고
          // `없습니다` 를 말한다.
          const grouped = groupNoticesByKind(copy)
          if (alive) setNotices(noticeStateOf((kind) => (grouped[kind].length > 0 ? grouped[kind] : null)))
        })
        .catch(() => undefined)
        .then(() => {
          // 진입은 실패해도 조용하다. 사용자가 부탁한 조회가 아니라 탭을 열었을 뿐이다.
          void refreshNoticeKinds(NOTICE_KINDS, (kind, received) => {
            if (alive) showKind(kind, received)
          }).then(() => {
            if (alive) settleUnknown()
          })
        })
      return () => {
        alive = false
      }
    }, [showKind, settleUnknown]),
  )

  // 당김은 사용자가 요청한 조회라 아무 일도 안 일어나면 고장으로 읽힌다. 그래서 전부 실패했을 때만
  // 말한다 - 키가 없으면 넥슨 네 갈래가 언제나 실패라, 일부 실패에도 말하면 앱 공지를 제대로
  // 받고도 매번 토스트가 뜬다.
  const refresh = useCallback(async (): Promise<void> => {
    const { allFailed } = await refreshNoticeKinds(NOTICE_KINDS, showKind)
    settleUnknown()
    if (allFailed) useToastStore.getState().showError('소식을 불러오지 못했습니다')
  }, [showKind, settleUnknown])

  // 로그인이 붙어 있으면 버튼을 안 세운다. **모르는 동안에도 안 세운다** - 세웠다 지우면
  // 소식이 한 칸 튀어오른다.
  const [showNexonLogin, setShowNexonLogin] = useState(false)

  useFocusEffect(
    useCallback(() => {
      let alive = true
      void hasNexonLogin().then((has) => {
        if (alive) setShowNexonLogin(!has)
      })
      return () => {
        alive = false
      }
    }, []),
  )

  // 창을 여는 것부터 세션을 적는 것까지 `signInWithNexon` 안에 있다. 여기서 하는 일은 끝을
  // 화면에 옮기는 것뿐이다.
  async function handleNexonLogin(): Promise<void> {
    const result = await signInWithNexon()
    // 사용자가 창을 닫은 것이라 아무 일도 안 일어난 것이다. 안내를 띄우면 자기가 닫아 놓고
    // 무엇이 잘못됐나 찾게 된다.
    if (result.kind === 'cancelled') return
    if (result.kind === 'failed') {
      // 버튼은 남긴다. 치우면 다시 눌러 볼 길이 없다.
      useToastStore.getState().showError('넥슨 로그인에 실패했습니다')
      return
    }
    setShowNexonLogin(false)
    useToastStore.getState().showSuccess('넥슨 계정을 연결했어요')
  }

  const openNotice = (notice: Notice): void => navigation.navigate('SettingsNoticeDetail', { noticeId: notice.id })

  return (
    <ScreenScroll onRefresh={refresh}>
      {/* `screen-Settings` 는 나머지 세 탭 화면과 같은 관례다(`screen-Content`·`-Boss`·`-Profit`).
          이것이 없어서 내비게이션 테스트가 **자리표시자의 같은 testID 를 보고 초록**이었고,
          설정 탭이 통째로 빠진 것을 아무도 못 잡았다(실기기 관측). */}
      <View className="gap-2 px-4 pb-4" testID="screen-Settings">
        {/* 이 화면에는 `PageHeader` 가 없지만 제목 줄은 다른 탭과 **같은
            프리미티브**다. 셸이 달라도 제목이 서는 선은 같아야 한다. */}
        {/* 설정은 머리의 아이콘 뒤에 산다. 본문에 두면 매일 보는 소식이 가끔 쓰는 설정에
            밀려 내려간다. 톱니바퀴가 하단 바에서 여기로 옮겨 온 그림이다. */}
        <PageHeaderTitleRow>
          <Text className="text-lg font-semibold text-text">더보기</Text>
          <Pressable
            role="button"
            aria-label="설정"
            onPress={() => {
              tapFeedback()
              navigation.navigate('AppSettings')
            }}
            className="ml-auto p-1"
          >
            {/* 제목 글자(18)보다 크다. 이 화면에서 유일하게 누를 수 있는 머리 요소라 뒤로
                가기(20)와 같은 크기면 눈에 안 걸린다. */}
            <GearIcon className="h-6 w-6 text-text-muted" strokeWidth={2} aria-hidden />
          </Pressable>
        </PageHeaderTitleRow>

        {/* 영역 사이만 넓힌다. 머리와 첫 영역까지 벌리면 제목이 내용과 떨어져 보인다. */}
        <View className="gap-7">
          {/*
            **키로 이미 들어온 사용자의 유일한 진입점이다.** 로그인 화면은 저장된 수단이 하나도
            없을 때만 서서 그 사용자에게는 다시 안 보이고, 설정은 톱니바퀴 뒤라 한 단계 더 깊다.

            이 탭 안에서도 소식 아래면 안 보인다. 갈래 셋에 배너 둘이 커서 첫 화면을 넘게 쓴다
            (시뮬레이터 확인. 한 번 넘겨도 버튼이 안 나왔다).

            **한 번 누르면 끝이라** 이 화면의 소식이 맨 위다 와 영구히 부딪치지 않는다. 로그인하면
            버튼이 사라져 소식이 다시 맨 위로 올라온다.
          */}
          {showNexonLogin && <NexonLoginButton onPress={() => void handleNexonLogin()} />}
          {/* **소식이 맨 위다.** 이 페이지에서 유일하게 매일 바뀌는 것이고, 나머지는 다 `가끔
              한 번` 이다. 자주 바뀌는 것을 아래 두면 사용자가 스크롤을 배워야 한다. */}
          {NOTICE_SECTIONS.map((section) => (
            <View key={section.kind} className="gap-2">
              <NoticeSectionHeader
                label={section.label}
                onOpenAll={() =>
                  navigation.navigate('SettingsNotices', { kinds: [section.kind], title: section.label })
                }
              />
              <NoticeSectionBody section={section} items={notices[section.kind]} onOpen={openNotice} />
            </View>
          ))}

          {/* **읽는 행 넷이 한 카드다.** 앞 둘은 읽고 끝나고 뒤 둘은 앱을 떠나는데, 카드를
              갈라 두던 근거가 사라졌다 - 응원이 맨 아래여야 한다는 것이었고 고지 네 줄이 설정
              화면으로 가면서 아래 카드가 곧 화면 끝이 됐다. 그러면 두 카드의 경계가 말하는 것이
              없다.

              제목은 `가이드 및 문의` 다(사용자 지정). 앞 둘이 가이드이고 뒤 둘이 문의다. */}
          <View className="gap-2">
            <SectionTitle>가이드 및 문의</SectionTitle>
            <Card className="px-6" testID="settings-card">
              {/* `기능 설명` 이 `개발 노트` 위다. 이 앱을 어떻게 쓰나 가 무엇이 바뀌었나 보다
                  자주 묻는 질문이고 설명의 원천도 이쪽이다. */}
              <SettingsRow
                label="기능 설명"
                onPress={() => navigation.navigate('SettingsFeatureGuideList')}
              />
              <View className={SETTINGS_ROW_DIVIDER_CLASS}>
                <SettingsRow
                  label="개발 노트"
                  onPress={() => navigation.navigate('SettingsReleaseNotes')}
                />
              </View>
              {/* 앱을 떠나 메일·스토어로 가는 행 둘이라 오른쪽이 chevron 이 아니라 외부 링크
                  표식이다. chevron 을 쓰면 다른 이동 행과 같은 약속을 하고는 앱을 떠나 버린다.

                  문의는 응원보다 자주 써서 위다. 메일 앱이 안 열리면 주소를 적은 토스트로만
                  알린다(복사는 없다). */}
              <View className={SETTINGS_ROW_DIVIDER_CLASS}>
                <SettingsLinkRow
                  label="문의하기"
                  href={contactMailUrl(contactDeviceOf(Platform, displayedVersion))}
                  onOpenFailed={() =>
                    useToastStore.getState().showError(`메일 앱을 열지 못했습니다. ${CONTACT_EMAIL} 으로 보내 주세요`)
                  }
                />
              </View>
              {/* 평생 한 번 누르는 것이라 맨 아래다. */}
              <View className={SETTINGS_ROW_DIVIDER_CLASS}>
                <SettingsLinkRow label="개발자 응원하기(앱 리뷰)" href={storeReviewUrl(Platform.OS)} />
              </View>
            </Card>
          </View>
        </View>
      </View>
    </ScreenScroll>
  )
}
