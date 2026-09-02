/**
 * 설정 하위 페이지 `계정 및 데이터`. 파괴적 행 둘.
 *
 * **이 앱에는 계정 변경이 없다**. 계정을 바꾸는 일이 `캐릭터 관리`의
 * 드롭다운 안으로 들어갔고, 그래서 카드가 하나다. 이 요구한 분리
 * (파괴적 행을 `계정 변경`과 다른 카드로 내린다)는 **그 짝이 없어져 저절로 성립한다**. 카드
 * 경계를 남겨 두는 것은 뜻이 사라져서가 아니라 위험 색 라벨 둘을 담는 그릇이 계속 필요해서다.
 * 아래 카드에 제목을 달지 않는 이유는 위험 색 라벨 둘과 카드 경계가 이미 그 말을 하고 있어서다.
 *
 * ══ 캐시 삭제 **범위**는 이 파일에 없다 ════════════════════════════════════════════
 *
 * 화면이 하는 일은 `CacheDataSelection` 두 불리언을 `clearCacheDataAndReload` 에 넘기는 것뿐이고,
 * 어떤 키와 어떤 테이블이 지워지는지는 core 의 `storage/cache-data.ts` 가 혼자 정한다(
 * 결정 2 의 단일 진실 공급원 · CLAUDE.md CRITICAL). **전환하며 그 파일을 한 글자도 건드리지
 * 않았으므로 범위는 웹과 같은 코드가 정한다**. 여기서 넓히거나 좁힐 자리가 구조적으로 없다.
 * 삭제 뒤 흐름(타임아웃 경쟁 → `closeBossProfitDb()` → 스플래시 → 리로드)도
 * 같은 이유로 core 에 그대로 있다.
 */
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { reloadAppAsync } from 'expo'

import type { CacheDataSizes } from '../../features/settings/cache-data'
import { clearCacheDataAndReload, loadCacheDataSizes } from '../../features/settings/cache-data'
import { useSettingsStore } from '../../features/settings/store'
import { formatBytes } from '../../lib/format-bytes'
import type { CacheDataSelection } from '../../storage/cache-data'

import { ArrowLeftIcon, Card, Text } from '../../components/atoms'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { CacheClearConfirm } from './CacheClearConfirm'
import { DisconnectConfirm } from './DisconnectConfirm'
import { SETTINGS_ROW_DIVIDER_CLASS } from './row-class'
import { SettingsRow } from './SettingsRow'
import { useSettingsNavigation } from './use-settings-navigation'

export interface SettingsAccountDataScreenProps {
  /** 테스트 주입용. 기본은 지금 도는 번들의 재실행(파일 머리 ③). */
  reload?: () => void
}

export function SettingsAccountDataScreen(
  props: SettingsAccountDataScreenProps = {},
): React.JSX.Element {
  const { disconnect } = useSettingsStore()
  const navigation = useSettingsNavigation()

  const [isCacheClearOpen, setIsCacheClearOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [sizes, setSizes] = useState<CacheDataSizes | null>(null)
  const [isDisconnectOpen, setIsDisconnectOpen] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  useEffect(() => {
    loadCacheDataSizes()
      .then(setSizes)
      .catch(() => {})
  }, [])

  // 행에 쓰는 총합은 그룹별 용량의 합으로 파생한다.
  const totalBytes = sizes === null ? null : sizes.general + sizes.records

  async function handleClear(selection: CacheDataSelection): Promise<void> {
    setIsClearing(true)
    await clearCacheDataAndReload(
      selection,
      props.reload ?? (() => void reloadAppAsync('캐시 데이터 삭제')),
    )
  }

  async function handleDisconnectConfirm(): Promise<void> {
    setIsDisconnecting(true)
    await disconnect()
  }

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
              <Text className="text-lg font-semibold text-text">계정 및 데이터</Text>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        {/* `screen-<라우트 이름>` 은 자리표시자에게서 물려받은 계약이다(`SettingsAboutScreen` 주석). */}
        <View className="gap-4 px-4 pb-4" testID="screen-SettingsAccountData">
          {/* `settings-card` 는 본화면과 같은 이름이다. 같은 프리미티브라 같은 표식을 쓴다.
              웹 테스트가 카드 경계를 `Card` atom 의 라운딩 클래스로 잡던 자리이고, RN 에는 그
              클래스가 스타일로 컴파일돼 사라져 표식이 필요하다. */}
          <Card className="px-6" testID="settings-card">
            <SettingsRow
              label="캐시 데이터 삭제"
              onPress={() => setIsCacheClearOpen(true)}
              danger
              showChevron={false}
              // : 조회 전에도 값과 같은 폭·타이포로 자리를 잡는다(빈 문자열이면
              // 값이 툭 나타나며 행이 밀린다).
              rightContent={
                <Text style={TABULAR_NUMS} className="text-sm text-text-muted">
                  {totalBytes !== null ? formatBytes(totalBytes) : '- KB'}
                </Text>
              }
            />
            <View className={SETTINGS_ROW_DIVIDER_CLASS}>
              <SettingsRow
                label="연결 해제"
                onPress={() => setIsDisconnectOpen(true)}
                danger
                showChevron={false}
              />
            </View>
          </Card>
        </View>
      </ScreenScroll>

      {/* 모달은 카드 밖이자 스크롤 상자 밖의 형제다. 카드 안에 두면 구분선이 하나 더 그려진다.
          웹이 셸의 `overlays` 프롭을 거쳐야 했던 이유는 RN 에 없다(파일 머리 ②). */}
      <CacheClearConfirm
        isOpen={isCacheClearOpen}
        isClearing={isClearing}
        sizes={sizes}
        onConfirm={(selection) => {
          void handleClear(selection)
        }}
        onCancel={() => setIsCacheClearOpen(false)}
      />

      <DisconnectConfirm
        isOpen={isDisconnectOpen}
        isDisconnecting={isDisconnecting}
        onConfirm={() => {
          void handleDisconnectConfirm()
        }}
        onCancel={() => setIsDisconnectOpen(false)}
      />
    </>
  )
}
