// 설정 본화면 — 카드 둘 · 7행([[ADR-118]] 결정 1 · [[ADR-125]] 결정 1 정정 · [[ADR-140]] 결정 1).
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
// ── RN 으로 옮기며 갈린 것 다섯 ──────────────────────────────────────────────────────
//
// ① **상단 안전영역을 화면이 아니라 셸이 먹는다.** 웹은 `ScreenScroll` 안쪽 래퍼의 `-mt` 가
//    콘텐츠를 y=0 으로 끌어올려서, 헤더 없는 이 화면이 `pt-[calc(1rem+var(--sa-top))]` 로 직접
//    되돌려야 했다(실기기 보고 2026-08-09 — 제목이 노치에 깔렸다). RN 의 `ScreenScroll` 은 헤더가
//    없으면 **스크롤포트 상자 자체를** `insets.top` 만큼 내리므로(그 파일 「상단」절) 그 트릭도
//    되돌릴 것도 없다. 웹의 `1rem` 몫인 `pt-4` 도 **없다**([[ADR-139]]) — 헤더가 있는 화면들이
//    그 16 을 버렸고, 이 화면만 남기면 제목 높이가 탭마다 갈린다.
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
// ⑤ **캐릭터 관리가 여기로 들어왔다**([[ADR-140]]) — 웹에는 없는 행이다. 웹뷰 앱은 컨텐츠·보스
//    헤더의 버튼 둘로 같은 피커를 열고, RN 은 그 다섯 자리(헤더 둘·빈 상태 둘·보스 수익 딥링크)를
//    이 행 하나로 모았다. 그래서 이 화면만 **로스터 조회**를 갖는다(아래 「캐릭터 관리」 절).
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useRoute, type RouteProp } from '@react-navigation/native'

import type { CacheDataSizes } from '@core/features/settings/cache-data'
import { loadCacheDataSizes } from '@core/features/settings/cache-data'
import { TRACKING_MODE_LABELS } from '@core/features/tracking-mode/copy'
import { useThemeStore } from '@core/features/theme/store'
import { useTrackingModeStore } from '@core/features/tracking-mode/store'
import { useContentSchedulerStore } from '@core/features/content-scheduler/store'
import { useApiKeyNotice } from '@core/features/onboarding/use-api-key-notice'
import { getCharacterPickerRoster, toScheduleSyncError } from '@core/features/schedule-sync/schedule-sync'
import type { ScheduleSyncError } from '@core/features/schedule-sync/schedule-sync'
import type { CharacterPickerEntry } from '@core/types'
import { formatBytes } from '@core/lib/format-bytes'

import packageJson from '../../../package.json'
import { Card } from '../../components/atoms/Card/Card'
import { CharacterTrackingPicker } from '../../components/organisms/CharacterTrackingPicker/CharacterTrackingPicker'
import { ProgressModal } from '../../components/organisms/ProgressModal/ProgressModal'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import type { TabParamList } from '../../navigation/routes'
import { useSettingsNavigation } from './use-settings-navigation'
import { TABULAR_NUMS } from '../../lib/text-styles'
import { SettingsRow } from './SettingsRow'
import { SETTINGS_ROW_DIVIDER_CLASS } from './row-class'
import { reloadTabStores } from './reload-tab-stores'
import { ThemeModal } from './ThemeModal'
import { TrackingModeModal } from './TrackingModeModal'

type OpenModal = 'theme' | 'trackingMode' | null

export function SettingsScreen(): React.JSX.Element {
  const { theme } = useThemeStore()
  const { mode: trackingMode } = useTrackingModeStore()
  // [[ADR-140]] 결정 4: 저장 로직을 새로 갖지 않는다 — 통합 키 쓰기·수동 모드 시드·추가분만 동기화·
  // 진행률 보고가 이 액션에 이미 한 벌로 들어 있다. 이름이 «컨텐츠» 인 것은 [[ADR-042]] 이전의
  // 흔적이고, 목록 자체는 앱 전역 하나다(그 대가는 ADR 이 적는다).
  const { trackedOcids, saveTrackedOcids } = useContentSchedulerStore()
  const navigation = useSettingsNavigation()
  const route = useRoute<RouteProp<TabParamList, 'Settings'>>()

  const [openModal, setOpenModal] = useState<OpenModal>(null)
  const [sizes, setSizes] = useState<CacheDataSizes | null>(null)
  // [[ADR-140]] 결정 2: 보스 수익의 "캐릭터 선택하러 가기"([[ADR-068]] 결정 4)와 두 스케줄러의 빈
  // 상태 CTA 가 피커를 **열어 둔 채로** 이 탭에 보낸다. 웹의 `?openPicker=1` 자리다.
  const [isPickerOpen, setIsPickerOpen] = useState(() => route.params?.openPicker === true)
  const [roster, setRoster] = useState<CharacterPickerEntry[]>([])
  // [[ADR-053]] 결정 3: 후보 목록 조회의 로딩·실패는 조회를 소유한 화면이 관리해 피커에 내려준다.
  // 초기값은 "마운트 직후 조회가 시작되는가"(= 파라미터로 이미 열려 있는가)와 같다.
  const [isRosterLoading, setIsRosterLoading] = useState(isPickerOpen)
  const [rosterError, setRosterError] = useState<ScheduleSyncError | null>(null)
  // [[ADR-062]]: 재조회 트리거. 피커를 여는 것과 재시도가 같은 초기화(reloadRoster)를 공유하고,
  // 이 값이 바뀌면 아래 조회 effect 가 다시 돈다.
  const [rosterReloadNonce, setRosterReloadNonce] = useState(0)
  const [saveProgress, setSaveProgress] = useState<{ completed: number; total: number } | null>(null)

  // ADR-118 결정 5: `계정 및 데이터` 행의 대표값. 캐시 행이 한 층 내려가면서 그 값은 한 층
  // 올라와, 들어가지 않고도 안을 짐작하게 한다. 실패는 자리표시(`- KB`)로 남긴다.
  useEffect(() => {
    loadCacheDataSizes()
      .then(setSizes)
      .catch(() => {})
  }, [])

  // 열어 둔 채로 들어온 파라미터는 마운트 직후 지운다 — 탭 파라미터는 스택에 남아, 안 지우면 탭을
  // 떠났다 돌아올 때마다 피커가 다시 열린다([[ADR-140]] 결정 2).
  useEffect(() => {
    if (route.params?.openPicker !== true) return
    navigation.setParams({ openPicker: undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // [[ADR-015]]: 후보 목록에 이미지·access_flag 가 필요해져 피커를 열 때만 조회한다.
  // [[ADR-016]]·[[ADR-017]] 결정 6: 캐시가 있으면 즉시 그 값으로 먼저 그리고 응답이 하나씩 도착하는
  // 대로 patch 한다. [[ADR-053]] 결정 3: 401/429 는 reject 로 나오므로 finally 에서 반드시 로딩을
  // 해제해야 스피너가 영구히 걸리지 않는다. roster 는 재조회 시작 시에도 비우지 않는다.
  useEffect(() => {
    if (!isPickerOpen) return
    let cancelled = false
    getCharacterPickerRoster((entries) => {
      if (!cancelled) setRoster(entries)
    })
      .catch((error: unknown) => {
        if (!cancelled) setRosterError(toScheduleSyncError(error))
      })
      .finally(() => {
        if (!cancelled) setIsRosterLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isPickerOpen, rosterReloadNonce])

  // [[ADR-115]] 결정 7 · [[ADR-116]] 결정 1: 로스터가 맞는 401·429 도 키 재입력 진입점으로 간다.
  useApiKeyNotice(rosterError)

  const displayedVersion = packageJson.version
  // 행에 쓰는 총합은 그룹별 용량의 합으로 파생한다(ADR-058 결정 8).
  const totalCacheBytes = sizes === null ? null : sizes.general + sizes.bossRecords

  // [[ADR-053]] 결정 3: 피커를 여는 유일한 경로 — 여는 순간 로딩·실패를 초기화한다(닫았다 다시 열면
  // 위 effect 가 재조회하므로 직전 실패가 남아 있으면 안 된다).
  function reloadRoster(): void {
    setIsRosterLoading(true)
    setRosterError(null)
    setRosterReloadNonce((nonce) => nonce + 1)
  }

  function openPicker(): void {
    setIsPickerOpen(true)
    reloadRoster()
  }

  async function handleSaveTracking(ocids: string[]): Promise<void> {
    setSaveProgress({ completed: 0, total: ocids.length })
    // 저장이 실패해도(스토어가 처리 못한 예외 등) 진행률 모달은 항상 닫는다 — 안 그러면 모달이 멈춘다.
    try {
      await saveTrackedOcids(ocids, (completed, total) => setSaveProgress({ completed, total }))
    } finally {
      setSaveProgress(null)
      setIsPickerOpen(false)
    }
    // 컨텐츠는 빠진다([[ADR-140]] 결정 5) — 저장의 주체가 그 스토어라 이미 최신이다.
    reloadTabStores(['boss', 'profit'])
  }

  return (
    <>
      <ScreenScroll>
        {/* `screen-Settings` 는 나머지 세 탭 화면과 같은 관례다(`screen-Content`·`-Boss`·`-Profit`).
            이것이 없어서 내비게이션 테스트가 **자리표시자의 같은 testID 를 보고 초록**이었고,
            설정 탭이 통째로 빠진 것을 아무도 못 잡았다(2026-08-13 실기기 관측). */}
        <View className="gap-4 px-4 pb-4" testID="screen-Settings">
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
            {/* [[ADR-140]] 결정 1·3: 「테마」 아래(사용자 지정). 이 카드에 드는 이유는 성질이 같기
                때문이다 — 모달이 뜨고, 고르면 그 자리에서 끝난다. 배지는 **추적 인원**이고,
                아직 못 읽었으면(`null`) 그리지 않는다([[ADR-101]] 결정 1 — `null` 은 "0명"이 아니다). */}
            <View className={SETTINGS_ROW_DIVIDER_CLASS}>
              <SettingsRow
                label="캐릭터 관리"
                onPress={openPicker}
                rightContent={
                  trackedOcids === null ? undefined : <ValueBadge>{trackedOcids.length}명</ValueBadge>
                }
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

      {isPickerOpen && (
        <CharacterTrackingPicker
          entries={roster}
          trackedOcids={trackedOcids ?? []}
          isLoading={isRosterLoading}
          loadError={rosterError}
          onSave={handleSaveTracking}
          onClose={() => setIsPickerOpen(false)}
          onRetry={reloadRoster}
        />
      )}
      {/* 저장 중에는 캐릭터 관리 모달 위에 진행률 모달을 띄운다(완료 시 둘 다 닫힌다). */}
      {saveProgress !== null && (
        <ProgressModal
          message="캐릭터 정보를 저장하고 있어요"
          completed={saveProgress.completed}
          total={saveProgress.total}
        />
      )}
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
