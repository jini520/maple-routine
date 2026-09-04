/**
 * 설정 하위 페이지 `개인정보 처리방침`. 사이트를 `WebView` 로 그대로 싣는 화면.
 *
 * 사본을 두지 않는다. `PRIVACY.md` 가 저장소 루트의 단일 원본이고 사이트가 그것을 렌더링한다.
 * 대가는 오프라인에서 안 뜨는 것이고, 어긋난 처방침이 안 보이는 처방침보다 나쁘다고 봤다. 대신
 * 실패를 감지해 `브라우저로 열기` 를 준다.
 *
 * 실패 신호가 둘이다. 즉시 실패는 `onError` 가 잡고, 8초 타임아웃은 **받아 놓고 응답하지 않는**
 * 매달림만 맡는다.
 *
 * 부모가 `settings` 가 아니라 `settings/about` 이다. 이 앱에서 스택이 2단이 되는 자리가 여기뿐이다.
 */
import { useEffect, useState } from 'react'
import { Linking, Pressable, View } from 'react-native'
import { WebView } from 'react-native-webview'

import { ArrowLeftIcon, Text } from '../../components/atoms'
import { ErrorState } from '../../components/molecules/ErrorState/ErrorState'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { useBottomSafeAreaPx, useTopSafeAreaPx } from '../../lib/safe-area'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'

export const PRIVACY_URL = 'https://mapleroutine.store/privacy'

/** 매달린 요청의 상한. 즉시 실패는 `onError` 가 먼저 잡는다. */
const LOAD_TIMEOUT_MS = 8000

type LoadStatus = 'loading' | 'loaded' | 'failed'

export function SettingsPrivacyScreen(): React.JSX.Element {
  const navigation = useSettingsNavigation()
  const topSafeAreaPx = useTopSafeAreaPx()
  const bottomSafeAreaPx = useBottomSafeAreaPx()
  const [status, setStatus] = useState<LoadStatus>('loading')

  useEffect(() => {
    if (status !== 'loading') return
    const timer = setTimeout(() => {
      setStatus('failed')
    }, LOAD_TIMEOUT_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [status])

  return (
    // `screen-<라우트 이름>` 은 자리표시자에게서 물려받은 계약이다(`SettingsAboutScreen` 주석).
    <View
      testID="screen-SettingsPrivacy"
      className="flex-1"
      style={{ paddingTop: topSafeAreaPx, paddingBottom: bottomSafeAreaPx }}
    >
      {/* 상단 여백은 없다. 바깥 상자가 안전영역만큼 내려온 자리에서 곧바로 시작한다. 그
          안전영역은 인셋이 아니라 `useTopSafeAreaPx()` 다. 헤더를 쓰는 화면들과 같은 값이어야
          하위 페이지를 오갈 때 제목이 안 튄다. */}
      <PageHeaderTitleRow className="gap-2 px-4 pb-2">
        <Pressable
          role="button"
          aria-label="뒤로"
          onPress={() => navigation.goBack()}
          className="-ml-1 p-1"
        >
          <ArrowLeftIcon className="h-5 w-5 text-text-muted" strokeWidth={2} aria-hidden />
        </Pressable>
        <Text className="text-lg font-semibold text-text">개인정보 처리방침</Text>
      </PageHeaderTitleRow>

      <View className="flex-1">
        {status === 'failed' ? (
          <View className="p-4">
            <ErrorState
              title="처리방침을 불러오지 못했습니다"
              description="인터넷에 연결한 뒤 다시 열어 주세요. 브라우저에서도 볼 수 있습니다."
              action={{
                label: '브라우저로 열기',
                // 실패의 원인을 실제로 푸는 행동이다. 여기서 안 되는 것을
                // 되는 곳으로 보낸다. "다시 시도"는 오프라인에서 같은 실패를 반복할 뿐이다.
                onClick: () => void Linking.openURL(PRIVACY_URL),
              }}
            />
          </View>
        ) : (
          <>
            <WebView
              testID="privacy-frame"
              source={{ uri: PRIVACY_URL }}
              onLoad={() => {
                setStatus('loaded')
              }}
              onError={() => {
                setStatus('failed')
              }}
              // 다 그려지기 전의 빈 흰 면을 로딩 표시가 덮게 한다.
              style={{ opacity: status === 'loaded' ? 1 : 0, backgroundColor: 'transparent' }}
              className="flex-1"
            />
            {status === 'loading' && (
              <View className="absolute inset-0 items-center justify-center">
                <LoadingState message="불러오는 중" size="page" />
              </View>
            )}
          </>
        )}
      </View>
    </View>
  )
}
