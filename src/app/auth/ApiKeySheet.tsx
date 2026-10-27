/**
 * 키 입력 상단 시트. 경고 모달에서 `그래도 API 키로 시작하기` 를 고른 사람만 온다.
 *
 * 위에서 내려오는 것은 키보드 때문이다. 키보드는 아래에서 올라오므로 위에 선 입력칸과 `확인` 을 가리지 않는다.
 * 머리 줄의 배지는 경고를 지나온 뒤에도 키 경로가 제한된 경로라는 것을 한 줄로 남긴다.
 *
 * 닫으면 친 키를 버린다. 다시 열면 이 컴포넌트가 새로 서므로 입력칸도 처음 값으로 돌아간다.
 */
import { View } from 'react-native'

import { AlertTriangleIcon, KeyRoundIcon, Text } from '../../components/atoms'
import { TopSheet } from '../../components/organisms/TopSheet/TopSheet'
import { ApiKeyForm } from './ApiKeyForm'

export function ApiKeySheet(props: {
  isSubmitting: boolean
  onSubmit: (apiKey: string) => void
  onClose: () => void
  /** 저장된 키. 온보딩 중간에서 로그인 화면으로 돌아왔을 때 채워 둔다 */
  initialApiKey?: string
}): React.JSX.Element {
  return (
    <TopSheet label="API 키 입력" testId="api-key-sheet" onClose={props.onClose}>
      <View className="gap-4">
        <View className="flex-row items-center gap-2.5">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-primary-tint">
            <KeyRoundIcon className="h-4 w-4 text-primary-ink" strokeWidth={1.75} aria-hidden />
          </View>
          <Text className="flex-1 text-base font-semibold text-text">API 키로 시작하기</Text>
          {/* 경고 삼각형이 든 알약이라 `Badge` 를 쓰지 않는다. 배지 부품은 글자만 받는다. */}
          <View className="flex-row items-center gap-1 rounded-full bg-error-tint px-2 py-1">
            <AlertTriangleIcon className="h-3 w-3 text-error-ink" strokeWidth={2} aria-hidden />
            <Text className="text-11 font-semibold text-error-ink">일부 기능 제한</Text>
          </View>
        </View>
        <ApiKeyForm
          isSubmitting={props.isSubmitting}
          onSubmit={props.onSubmit}
          initialApiKey={props.initialApiKey}
        />
      </View>
    </TopSheet>
  )
}
