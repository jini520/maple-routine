/**
 * 설정 하위 페이지 `계정 및 데이터`. 캐시 삭제와 연결 해제 둘을 담는 화면.
 *
 * 카드가 하나다. 계정을 바꾸는 일이 캐릭터 관리의 드롭다운 안으로 들어가 이 화면에 계정 변경이
 * 없다. 카드 경계를 남기는 것은 위험 색 라벨 둘을 담는 그릇이 계속 필요해서다.
 *
 * **캐시 삭제 범위는 이 파일에 없다.** 화면은 불리언 둘을 넘길 뿐이고 어떤 키와 어떤 테이블이
 * 지워지는지는 `storage/cache-data.ts` 가 혼자 정한다.
 *
 * @see docs/features/settings.md 정책
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
  /** 테스트 주입용. 기본은 지금 도는 번들의 재실행. */
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
              // 조회 전에도 값과 같은 폭·타이포로 자리를 잡는다(빈 문자열이면
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

      {/* 모달은 카드 밖이자 스크롤 상자 밖의 형제다. 카드 안에 두면 구분선이 하나 더 그려진다. */}
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
