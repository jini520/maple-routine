/**
 * 앱 설정. 더보기 머리의 톱니바퀴가 여는 자리다.
 *
 * **더보기에서 떼어 냈다.** 그 탭이 든 것이 셋인데 성질이 다르다 - 매일 바뀌는 소식 · 평생
 * 한 번 누르는 응원 · 가끔 바꾸는 설정. 셋을 한 화면에 세우면 매일 보는 것이 가끔 쓰는 것에
 * 밀려 내려간다. 설정을 머리의 아이콘 뒤로 보내면 더보기는 `읽는 화면` 하나로 남는다.
 *
 * **위 카드는 값을 고르는 행**(모달이 뜨고, 고르면 그 자리에서 끝난다), **아래 카드는 화면이
 * 넘어가는 행**(하위 페이지로 이동한다). 두 무리를 가르는 것은 카드 경계뿐이고 섹션 제목은
 * 달지 않는다. 두 무리를 덮는 제목은 행 이름보다 덜 구체적이라 읽는 사람이 얻는 것이 없다.
 */
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'

import type { CacheDataSizes } from '../../features/settings/cache-data'
import { loadCacheDataSizes } from '../../features/settings/cache-data'
import { TRACKING_MODE_LABELS } from '../../features/tracking-mode/copy'
import { useThemeStore } from '../../features/theme/store'
import { useTrackingModeStore } from '../../features/tracking-mode/store'
import { useContentSchedulerStore } from '../../features/content-scheduler/store'
import { formatBytes } from '../../lib/format-bytes'

import packageJson from '../../../package.json'
import { ArrowLeftIcon, Badge, Card, Text } from '../../components/atoms'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { SettingsRow } from './SettingsRow'
import { SETTINGS_ROW_DIVIDER_CLASS } from './row-class'
import { ThemeModal } from './ThemeModal'
import { TrackingModeModal } from './TrackingModeModal'

type OpenModal = 'theme' | 'trackingMode' | null

/** 고를 수 있는 값. 눌러서 바꾸는 것이라 배지로 선다. */
function ValueBadge(props: { children: React.ReactNode }): React.JSX.Element {
  return <Badge variant="outline">{props.children}</Badge>
}

/** 이동 행의 대표값. 배지가 아니라 평문이다(고를 수 있는 값이 아니라 안을 미리 보여주는 값). */
function SummaryValue(props: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Text style={TABULAR_NUMS} className="text-sm text-text-muted">
      {props.children}
    </Text>
  )
}

export function AppSettingsScreen(): React.JSX.Element {
  const { theme } = useThemeStore()
  const { mode: trackingMode } = useTrackingModeStore()
  const { trackedOcids } = useContentSchedulerStore()
  const navigation = useSettingsNavigation()

  const [openModal, setOpenModal] = useState<OpenModal>(null)
  const [sizes, setSizes] = useState<CacheDataSizes | null>(null)

  // `계정 및 데이터` 행의 대표값. 들어가지 않고도 안을 짐작하게 한다. 실패는 자리표시(`- KB`).
  useEffect(() => {
    loadCacheDataSizes()
      .then(setSizes)
      .catch(() => {})
  }, [])

  const displayedVersion = packageJson.version
  // 행에 쓰는 총합은 그룹별 용량의 합으로 파생한다.
  const totalCacheBytes = sizes === null ? null : sizes.general + sizes.records

  return (
    <>
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
              <Text className="text-lg font-semibold text-text">설정</Text>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        <View className="gap-4 px-4 pb-4" testID="screen-AppSettings">
          {/* **알림이 맨 위에 혼자 선다.** 이 화면에서 유일하게 밖으로 나가는 설정이라 성질이
              다르다 - 나머지는 앱 안에서만 도는 값이고 이것은 기기에 알림이 뜨느냐를 정한다.
              카드를 나눈 것이 그 말을 하는 유일한 방법이다. */}
          <Card className="px-6" testID="app-settings-card">
            <SettingsRow
              label="알림 설정"
              onPress={() => navigation.navigate('SettingsNoticeAlerts')}
            />
          </Card>

          {/* 값을 고르는 행. 배지(현재값) + chevron 병기. */}
          <Card className="px-6" testID="app-settings-card">
            <SettingsRow
              label="스케줄 관리 방법"
              onPress={() => setOpenModal('trackingMode')}
              rightContent={<ValueBadge>{TRACKING_MODE_LABELS[trackingMode]}</ValueBadge>}
            />
            <View className={SETTINGS_ROW_DIVIDER_CLASS}>
              <SettingsRow
                label="테마"
                onPress={() => setOpenModal('theme')}
                rightContent={<ValueBadge>{theme}</ValueBadge>}
              />
            </View>
            {/* `테마` 아래. 이 카드에 남는 것은 성질이 같기 때문이다. 배지는 추적 캐릭터 수이고
                아직 못 읽었으면(`null`) 그리지 않는다. `null` 은 0개가 아니다. 단위가 명 이
                아니라 개 인 것은 캐릭터가 사람이 아니어서다. */}
            <View className={SETTINGS_ROW_DIVIDER_CLASS}>
              <SettingsRow
                label="캐릭터 관리"
                onPress={() => navigation.navigate('SettingsCharacters')}
                rightContent={
                  trackedOcids === null ? undefined : <ValueBadge>{trackedOcids.length}개</ValueBadge>
                }
              />
            </View>
          </Card>

          {/* 화면이 넘어가는 행. 대표값(있으면) + chevron. */}
          <Card className="px-6" testID="app-settings-card">
            <SettingsRow
              label="계정 및 데이터"
              onPress={() => navigation.navigate('SettingsAccountData')}
              rightContent={
                // 조회 전에도 값과 같은 폭·타이포로 자리를 잡는다.
                <SummaryValue>
                  {totalCacheBytes !== null ? formatBytes(totalCacheBytes) : '- KB'}
                </SummaryValue>
              }
            />
            <View className={SETTINGS_ROW_DIVIDER_CLASS}>
              <SettingsRow
                label="앱 정보"
                onPress={() => navigation.navigate('SettingsAbout')}
                rightContent={<SummaryValue>{displayedVersion}</SummaryValue>}
              />
            </View>
          </Card>
        </View>
      </ScreenScroll>

      {openModal === 'trackingMode' && <TrackingModeModal onClose={() => setOpenModal(null)} />}
      {openModal === 'theme' && <ThemeModal onClose={() => setOpenModal(null)} />}
    </>
  )
}
