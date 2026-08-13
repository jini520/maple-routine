// 설정 본화면 — 카드 둘 · 6행([[ADR-118]] 결정 1 · [[ADR-125]] 결정 1 정정).
//
// **위 카드는 값을 고르는 행**(모달이 뜨고, 고르면 그 자리에서 끝난다), **아래 카드는 화면이
// 넘어가는 행**(하위 페이지로 이동한다). 두 무리를 가르는 것은 카드 경계뿐이고 섹션 제목은 달지
// 않는다 — 두 무리를 덮는 제목(「동작·표시」류)은 행 이름보다 덜 구체적이라 읽는 사람이 얻는
// 것이 없다.
//
// **이 화면에는 고정 헤더(`PageHeader`)를 두지 않는다**([[ADR-098]] 결정 3). 그 ADR 이 단 재판단
// 조건은 *"행이 늘어 세로가 길어지면"* 인데, 이 개편은 섹션 둘과 footer 한 줄을 하위 페이지로
// 내려보내 **순감**이라 조건에 걸리지 않는다.
//
// ── RN 으로 옮기며 갈린 것 넷 ────────────────────────────────────────────────────────
//
// ① **상단 안전영역을 화면이 아니라 셸이 먹는다.** 웹은 `ScreenScroll` 안쪽 래퍼의 `-mt` 가
//    콘텐츠를 y=0 으로 끌어올려서, 헤더 없는 이 화면이 `pt-[calc(1rem+var(--sa-top))]` 로 직접
//    되돌려야 했다(실기기 보고 2026-08-09 — 제목이 노치에 깔렸다). RN 의 `ScreenScroll` 은 헤더가
//    없으면 **스크롤포트 상자 자체를** `insets.top` 만큼 내리므로(그 파일 「상단」절) 그 트릭도
//    되돌릴 것도 없다. 남는 것은 웹의 `1rem` 몫인 `pt-4` 뿐이다.
// ② **`<Outlet />` 이 사라진다.** 하위 페이지는 이 화면의 자식 라우트가 아니라 **루트 스택 위로
//    push** 된다([[ADR-120]] 결정 4 를 구조로 만족 — `RootNavigator` 주석). 그래서 이 화면은
//    떠날 때 언마운트되지 않고 아래에 남고, 보던 스크롤 자리도 `ScrollView` 가 그대로 들고 있다.
// ③ **모달을 셸 밖에 두는 이유가 없어진다.** 웹은 `fixed` 셸이 만든 스태킹 컨텍스트에 `z-50` 이
//    갇혀 탭바 아래로 그려지는 것을 피하려고 스크롤 셸 **바깥** 형제로 뒀는데, RN 의 `Modal` 은
//    별도 네이티브 윈도우라 갇힐 상자가 없다. 그래도 **같은 자리에 둔다** — 두 앱을 나란히 읽을 때
//    구조가 같은 편이 낫고, 잃는 것이 없다.
// ④ **실행 중인 OTA 번들 버전을 물을 수 없다.** 웹은 `useLiveUpdateStore().loadCurrentVersion()`
//    으로 채웠는데 RN 에서는 그 스토어를 **값으로 import 하는 것만으로 죽는다**([[ADR-128]] 결정 7 —
//    `AppUpdateSection` 파일 머리에 벽 둘이 적혀 있다). 그래서 웹이 `currentVersion === null` 일 때
//    쓰던 **폴백 경로만 남는다**: 빌드 시점 `package.json` 버전. 값을 지어내지 않고 웹에 이미 있던
//    분기 하나로 좁힌 것이다.
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import type { CacheDataSizes } from '@core/features/settings/cache-data'
import { loadCacheDataSizes } from '@core/features/settings/cache-data'
import { TRACKING_MODE_LABELS } from '@core/features/tracking-mode/copy'
import { useThemeStore } from '@core/features/theme/store'
import { useTrackingModeStore } from '@core/features/tracking-mode/store'
import { formatBytes } from '@core/lib/format-bytes'

import packageJson from '../../../package.json'
import { Card } from '../../components/atoms/Card/Card'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { useSettingsNavigation } from './use-settings-navigation'
import { TABULAR_NUMS } from '../../lib/text-styles'
import { SettingsRow } from './SettingsRow'
import { SETTINGS_ROW_DIVIDER_CLASS } from './row-class'
import { ThemeModal } from './ThemeModal'
import { TrackingModeModal } from './TrackingModeModal'

type OpenModal = 'theme' | 'trackingMode' | null

export function SettingsScreen(): React.JSX.Element {
  const { theme } = useThemeStore()
  const { mode: trackingMode } = useTrackingModeStore()
  const navigation = useSettingsNavigation()

  const [openModal, setOpenModal] = useState<OpenModal>(null)
  const [sizes, setSizes] = useState<CacheDataSizes | null>(null)

  // ADR-118 결정 5: `계정 및 데이터` 행의 대표값. 캐시 행이 한 층 내려가면서 그 값은 한 층
  // 올라와, 들어가지 않고도 안을 짐작하게 한다. 실패는 자리표시(`- KB`)로 남긴다.
  useEffect(() => {
    loadCacheDataSizes()
      .then(setSizes)
      .catch(() => {})
  }, [])

  const displayedVersion = packageJson.version
  // 행에 쓰는 총합은 그룹별 용량의 합으로 파생한다(ADR-058 결정 8).
  const totalCacheBytes = sizes === null ? null : sizes.general + sizes.bossRecords

  return (
    <>
      <ScreenScroll>
        {/* `screen-Settings` 는 나머지 세 탭 화면과 같은 관례다(`screen-Content`·`-Boss`·`-Profit`).
            이것이 없어서 내비게이션 테스트가 **자리표시자의 같은 testID 를 보고 초록**이었고,
            설정 탭이 통째로 빠진 것을 아무도 못 잡았다(2026-08-13 실기기 관측). */}
        <View className="gap-4 px-4 pb-4 pt-4" testID="screen-Settings">
          <Text className="text-lg font-semibold text-text">설정</Text>

          {/* 값을 고르는 행 — 배지(현재값) + chevron 병기(ADR-118 결정 4). */}
          <Card className="px-6" testID="settings-card">
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
          </Card>

          {/* 화면이 넘어가는 행 — 대표값(있으면) + chevron. */}
          <Card className="px-6" testID="settings-card">
            {/* 「기능 설명」이 「개발 노트」 위다([[ADR-125]] 결정 1 정정) — *"이 앱을 어떻게 쓰나"*
                가 *"무엇이 바뀌었나"* 보다 자주 묻는 질문이고, 설명의 원천도 이쪽이다.
                대표값을 비우는 것은 개발 노트와 같은 이유다(결정 5). */}
            <SettingsRow
              label="기능 설명"
              onPress={() => navigation.navigate('SettingsFeatureGuideList')}
            />
            {/* 대표값을 비운다(결정 5) — "최신 버전"은 아래 `앱 정보` 행과 같은 값이라 중복이고,
                "n개"는 개수가 늘어난다고 뜻이 생기지 않는다. 없는 대표값을 지어내지 않는다. */}
            <View className={SETTINGS_ROW_DIVIDER_CLASS}>
              <SettingsRow
                label="개발 노트"
                onPress={() => navigation.navigate('SettingsReleaseNotes')}
              />
            </View>
            <View className={SETTINGS_ROW_DIVIDER_CLASS}>
              <SettingsRow
                label="계정 및 데이터"
                onPress={() => navigation.navigate('SettingsAccountData')}
                rightContent={
                  // ADR-061 결정 7: 조회 전에도 값과 같은 폭·타이포로 자리를 잡는다.
                  <SummaryValue>
                    {totalCacheBytes !== null ? formatBytes(totalCacheBytes) : '- KB'}
                  </SummaryValue>
                }
              />
            </View>
            <View className={SETTINGS_ROW_DIVIDER_CLASS}>
              <SettingsRow
                label="앱 정보"
                onPress={() => navigation.navigate('SettingsAbout')}
                rightContent={<SummaryValue>{displayedVersion}</SummaryValue>}
              />
            </View>
          </Card>

          {/* 이용약관 제6조④가 요구하는 출처 표기 — 문구를 의역하지 않고 원문 그대로 노출한다.
              ADR-118 결정 8: 이 블록은 전부 읽고 끝나는 정적 문구라 톤(text-text-disabled)이
              균일하다 — 눌러야 하는 것 하나가 한 단계 밝은 색·밑줄로 섞여 있던 예외는
              /settings/about 의 행으로 내려가면서 사라졌다.
              (`text-center` 가 상자에서 각 `Text` 로 내려온 것은 RN 이 글자 정렬을 상속하지
              않기 때문이다 — `EmptyState` 와 같은 자리.) */}
          <View className="gap-1 pt-4" testID="settings-footer">
            <Text className="text-center text-xs text-text-disabled">v{displayedVersion}</Text>
            <Text className="text-center text-xs text-text-disabled">
              © {new Date().getFullYear()} 메이플 루틴
            </Text>
            <Text className="text-center text-xs text-text-disabled">
              Data based on NEXON Open API
            </Text>
            {/* 비제휴 고지는 약관이 요구하는 것이 아니라 동종 서비스(maple.gg·chuchu.gg·
                maplescouter)의 공통 관행이다 — 출처 표기만 있으면 넥슨 공식 서비스로 오인될
                여지가 남는다. 문구도 그 3사와 같은 영문 형태로 맞춘다. */}
            <Text className="text-center text-xs text-text-disabled">
              Maple Routine is not associated with NEXON Korea
            </Text>
          </View>
        </View>
      </ScreenScroll>

      {openModal === 'trackingMode' && <TrackingModeModal onClose={() => setOpenModal(null)} />}
      {openModal === 'theme' && <ThemeModal onClose={() => setOpenModal(null)} />}
    </>
  )
}

/** 설정 행의 현재값 배지 — 값을 고르는 두 행이 공유한다. */
function ValueBadge(props: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Text className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted">
      {props.children}
    </Text>
  )
}

/** 이동 행의 대표값 — 배지가 아니라 평문이다(고를 수 있는 값이 아니라 안을 미리 보여주는 값). */
function SummaryValue(props: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Text style={TABULAR_NUMS} className="text-sm text-text-muted">
      {props.children}
    </Text>
  )
}
