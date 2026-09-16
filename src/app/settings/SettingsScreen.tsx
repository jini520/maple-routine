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
import { NoticeLines } from './NoticeLines'
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
const NOTICE_SECTIONS: readonly { label: string; kind: NoticeKind; lines?: number }[] = [
  // 앱 공지 갈래의 이름은 영문 `NOTICE` 다(사용자 지정).
  { label: 'NOTICE', kind: 'app', lines: 3 },
  // 넥슨 이벤트 목록은 지금 게시 중인 글만 준다.
  { label: '진행 중인 이벤트', kind: 'event' },
  // 넥슨 캐시샵 공지는 캐시아이템 업데이트 소식이다.
  { label: '캐시샵 업데이트', kind: 'cashshop' },
  { label: '게임 공지사항', kind: 'game', lines: 3 },
  { label: '업데이트', kind: 'update', lines: 2 },
]

const NO_NOTICES = groupNoticesByKind([])

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
  const [notices, setNotices] = useState<Record<NoticeKind, Notice[]>>(NO_NOTICES)

  // 받은 갈래 하나를 화면에 반영한다. 진입 조회와 당김이 같은 함수로 들어온다.
  const showKind = useCallback((kind: NoticeKind, received: Notice[]): void => {
    setNotices((current) => ({ ...current, [kind]: received }))
  }, [])

  // 들어올 때마다 다섯 목록을 다시 받는다. 사본을 먼저 그리고 분류마다 받은 것으로 바꾼다. 실패한 분류는 사본이 선다.
  // 사본을 다 읽은 뒤에 부른다. 거꾸로면 늦게 끝난 사본 읽기가 방금 받은 목록을 덮는다.
  useFocusEffect(
    useCallback(() => {
      let alive = true
      void getNotices()
        .then((copy) => {
          if (alive) setNotices(groupNoticesByKind(copy))
        })
        .catch(() => undefined)
        .then(() => {
          // 진입은 실패해도 조용하다. 사용자가 부탁한 조회가 아니라 탭을 열었을 뿐이다.
          void refreshNoticeKinds(NOTICE_KINDS, (kind, received) => {
            if (alive) showKind(kind, received)
          })
        })
      return () => {
        alive = false
      }
    }, [showKind]),
  )

  // 당김은 사용자가 요청한 조회라 아무 일도 안 일어나면 고장으로 읽힌다. 그래서 전부 실패했을 때만
  // 말한다 - 키가 없으면 넥슨 네 갈래가 언제나 실패라, 일부 실패에도 말하면 앱 공지를 제대로
  // 받고도 매번 토스트가 뜬다.
  const refresh = useCallback(async (): Promise<void> => {
    const { allFailed } = await refreshNoticeKinds(NOTICE_KINDS, showKind)
    if (allFailed) useToastStore.getState().showError('소식을 불러오지 못했습니다')
  }, [showKind])

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
            {/* **소식이 맨 위다.** 이 페이지에서 유일하게 매일 바뀌는 것이고, 나머지는 다 `가끔
                한 번` 이다. 자주 바뀌는 것을 아래 두면 사용자가 스크롤을 배워야 한다. */}
            {NOTICE_SECTIONS.map((section) => {
              const items = notices[section.kind]
              return (
                <View key={section.kind} className="gap-2">
                  <NoticeSectionHeader
                    label={section.label}
                    onOpenAll={() =>
                      navigation.navigate('SettingsNotices', { kinds: [section.kind], title: section.label })
                    }
                  />
                  {items.length === 0 ? (
                    // 갈래를 숨기면 화면 순서가 바뀐다.
                    <Card className="px-5 py-4">
                      <Text className="text-center text-sm text-text-disabled">{emptyNoticeText(section.label)}</Text>
                    </Card>
                  ) : section.lines === undefined ? (
                    // 배너는 화면 양끝까지 닿는다. 화면 좌우 여백을 이 줄만 되돌린다.
                    <View className="-mx-4">
                      <NoticeBannerRail notices={items} onOpen={openNotice} />
                    </View>
                  ) : (
                    <NoticeLines notices={items.slice(0, section.lines)} titleLines={1} onPress={openNotice} />
                  )}
                </View>
              )
            })}

            {/* 읽는 것들. 설정과 갈라 둔 이유는 성질이 달라서다 - 이쪽은 한 번 읽고 끝나고
                설정은 값을 바꾼다. */}
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
            </Card>

            {/* **응원은 맨 아래다.** 평생 한 번 누르는 것이라 자주 쓰는 것 위에 못 올린다.
                사람들이 후원을 찾을 때 관습적으로 화면 끝부터 본다. */}
            <Card className="px-6" testID="settings-card">
              {/* 앱을 떠나 스토어로 가는 행이라 오른쪽이 chevron 이 아니라 외부 링크 표식이다.
                  chevron 을 쓰면 다른 이동 행과 같은 약속을 하고는 앱을 떠나 버린다.

                  후원 행은 수단을 정하면 이 카드로 돌아온다. 행이 하나만 남아도 카드를 지우지 않는
                  이유가 그것이다. */}
              {/* 문의는 응원보다 자주 써서 위다. 메일 앱이 안 열리면 주소를 적은 토스트로만 알린다(복사는 없다). */}
              <SettingsLinkRow
                label="문의하기"
                href={contactMailUrl(contactDeviceOf(Platform, displayedVersion))}
                onOpenFailed={() =>
                  useToastStore.getState().showError(`메일 앱을 열지 못했습니다. ${CONTACT_EMAIL} 으로 보내 주세요`)
                }
              />
              <View className={SETTINGS_ROW_DIVIDER_CLASS}>
                <SettingsLinkRow label="개발자 응원하기(앱 리뷰)" href={storeReviewUrl(Platform.OS)} />
              </View>
            </Card>
          </View>
        </View>
      </ScreenScroll>
  )
}
