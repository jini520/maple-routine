/**
 * 앱 설정. 더보기 머리의 톱니바퀴가 여는 자리다.
 *
 * **더보기에서 떼어 냈다.** 그 탭이 든 것이 셋인데 성질이 다르다 - 매일 바뀌는 소식 · 평생
 * 한 번 누르는 응원 · 가끔 바꾸는 설정. 셋을 한 화면에 세우면 매일 보는 것이 가끔 쓰는 것에
 * 밀려 내려간다. 설정을 머리의 아이콘 뒤로 보내면 더보기는 `읽는 화면` 하나로 남는다.
 *
 * **카드마다 제목을 단다**(사용자 지정). 카드 경계만으로 가르던 것을 바꿨다. 경계는 여기서 무리가
 * 갈린다는 말만 하고 그 무리가 무엇인지는 안 말해서, 안을 보려면 행 이름을 다 읽어야 했다.
 * 제목은 **안에 든 것을 열거한다**(`캐릭터 · 테마`) - 더보기의 `가이드 및 문의` 와 같은 결이다.
 *
 * 카드는 넷이고 성질로 갈린다. `알림` 은 이 화면에서 유일하게 밖으로 나가는 설정이고, 가운데 둘은
 * 눌러서 값을 고르는 행이고(모달이 뜨거나 화면이 넘어간다), `앱 데이터` 는 안을 미리 보여 주는
 * 대표값을 단 이동 행이다.
 */
import { useEffect, useState } from 'react'
import { View } from 'react-native'

import type { CacheDataSizes } from '../../features/settings/cache-data'
import { loadCacheDataSizes } from '../../features/settings/cache-data'
import { TRACKING_MODE_LABELS } from '../../features/tracking-mode/copy'
import { useTrackingModeStore } from '../../features/tracking-mode/store'
import { useThemeStore } from '../../features/theme/store'
import { useContentSchedulerStore } from '../../features/content-scheduler/store'
import { formatBytes } from '../../lib/format-bytes'
import { formatAppVersion } from '../../lib/app-version'

import { useRunningAppVersion } from '../../features/live-update/use-running-app-version'
import { Card, Text } from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { SettingsRow } from './SettingsRow'
import { SETTINGS_ROW_DIVIDER_CLASS } from './row-class'
import { SectionTitle } from './SectionTitle'
import { ThemeModal } from './ThemeModal'
import { TrackingModeModal } from './TrackingModeModal'
import { ValueBadge } from './ValueBadge'

/** 이동 행의 대표값. 배지가 아니라 평문이다(고를 수 있는 값이 아니라 안을 미리 보여주는 값). */
function SummaryValue(props: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Text style={TABULAR_NUMS} className="text-sm text-text-muted">
      {props.children}
    </Text>
  )
}

export function AppSettingsScreen(): React.JSX.Element {
  const { mode: trackingMode } = useTrackingModeStore()
  const { theme } = useThemeStore()
  const { trackedOcids } = useContentSchedulerStore()
  const navigation = useSettingsNavigation()

  const [trackingModeOpen, setTrackingModeOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [sizes, setSizes] = useState<CacheDataSizes | null>(null)

  // `계정 및 데이터` 행의 대표값. 들어가지 않고도 안을 짐작하게 한다. 실패는 자리표시(`- KB`).
  useEffect(() => {
    loadCacheDataSizes()
      .then(setSizes)
      .catch(() => {})
  }, [])

  const displayedVersion = formatAppVersion(useRunningAppVersion())
  // 행에 쓰는 총합은 그룹별 용량의 합으로 파생한다.
  const totalCacheBytes = sizes === null ? null : sizes.general + sizes.records

  return (
    <>
      <ScreenScroll
        hasTabBar={false}
        header={
          <PageHeader>
            <PageHeaderTitleRow className="gap-2">
              <BackButton onPress={() => navigation.goBack()} />
              <Text className="text-lg font-semibold text-text">설정</Text>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        <View className="gap-4 px-4 pb-4" testID="screen-AppSettings">
          {/* **알림이 맨 위에 혼자 선다.** 이 화면에서 유일하게 밖으로 나가는 설정이라 성질이
              다르다 - 나머지는 앱 안에서만 도는 값이고 이것은 기기에 알림이 뜨느냐를 정한다. */}
          <View className="gap-2">
            <SectionTitle>알림</SectionTitle>
            <Card className="px-6" testID="app-settings-card">
              <SettingsRow
                label="알림 설정"
                onPress={() => navigation.navigate('SettingsNoticeAlerts')}
              />
            </Card>
          </View>

          {/* 값을 고르는 행. 배지(현재값) + chevron 병기. */}
          <View className="gap-2">
            <SectionTitle>캐릭터 · 테마</SectionTitle>
            <Card className="px-6" testID="app-settings-card">
              {/* 캐릭터 관리가 위다. 보스 수익과 스케줄러 둘이 빈 상태에서 미는 자리라 테마보다
                  자주 열린다. 배지는 추적 캐릭터 수이고 아직 못 읽었으면(`null`) 그리지 않는다 -
                  `null` 은 0개가 아니다. 단위가 명 이 아니라 개 인 것은 캐릭터가 사람이 아니어서다. */}
              <SettingsRow
                label="캐릭터 관리"
                onPress={() => navigation.navigate('SettingsCharacters')}
                rightContent={
                  trackedOcids === null ? undefined : <ValueBadge>{trackedOcids.length}개</ValueBadge>
                }
              />
              <View className={SETTINGS_ROW_DIVIDER_CLASS}>
                <SettingsRow
                  label="테마"
                  onPress={() => setThemeOpen(true)}
                  rightContent={<ValueBadge>{theme}</ValueBadge>}
                />
              </View>
            </Card>
          </View>

          {/* 앞 카드와 성질이 같은데도(둘 다 값을 고르는 행) 가른 것은 **주제**가 달라서다.
              이쪽은 기록을 어떻게 모으나이고 저쪽은 내 캐릭터와 앱 생김새다. 제목을 달면서 둘을
              한 카드에 두면 제목이 둘을 다 덮는 말이어야 하는데, 그 말이 `설정` 밖에 없다. */}
          <View className="gap-2">
            <SectionTitle>스케줄</SectionTitle>
            <Card className="px-6" testID="app-settings-card">
              <SettingsRow
                label="스케줄 관리 방법"
                onPress={() => setTrackingModeOpen(true)}
                rightContent={<ValueBadge>{TRACKING_MODE_LABELS[trackingMode]}</ValueBadge>}
              />
            </Card>
          </View>

          {/* 화면이 넘어가는 행. 대표값(있으면) + chevron. */}
          <View className="gap-2">
            <SectionTitle>앱 데이터</SectionTitle>
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

          {/* 이용약관 제6조④가 요구하는 출처 표기. 문구를 의역하지 않고 원문 그대로 노출한다.
              더보기 맨 아래에 있다가 여기로 왔다. 더보기가 소식 갈래로 길어져 멀리 밀렸고, 이 화면은 카드 셋이라
              스크롤 없이 보인다. 전부 읽고 끝나는 정적 문구라 톤(text-text-disabled)이 균일하다.
              (`text-center` 가 각 `Text` 에 있는 것은 RN 이 글자 정렬을 상속하지 않기 때문이다.) */}
          <View className="gap-1 pt-4" testID="settings-footer">
            <Text className="text-center text-xs text-text-disabled">v{displayedVersion}</Text>
            <Text className="text-center text-xs text-text-disabled">
              © {new Date().getFullYear()} 메이플 루틴
            </Text>
            <Text className="text-center text-xs text-text-disabled">
              Data based on NEXON Open API
            </Text>
            {/* 비제휴 고지는 약관이 요구하는 것이 아니라 동종 서비스(maple.gg·chuchu.gg·
                maplescouter)의 공통 관행이다. 출처 표기만 있으면 넥슨 공식 서비스로 오인될
                여지가 남는다. 문구도 그 3사와 같은 영문 형태로 맞춘다. */}
            <Text className="text-center text-xs text-text-disabled">
              Maple Routine is not associated with NEXON Korea
            </Text>
          </View>
        </View>
      </ScreenScroll>

      {trackingModeOpen && <TrackingModeModal onClose={() => setTrackingModeOpen(false)} />}
      {themeOpen && <ThemeModal onClose={() => setThemeOpen(false)} />}
    </>
  )
}
