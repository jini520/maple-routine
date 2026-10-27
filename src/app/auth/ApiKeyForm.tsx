/**
 * API 키 입력. 키 입력 상단 시트(`ApiKeySheet`)의 본문이고, 넥슨 로그인 입구가 꺼진 빌드에서는 첫 화면에 그대로 선다.
 *
 * 제목은 이 폼이 들지 않는다. 시트에서는 시트의 머리 줄이, 입구가 꺼진 첫 화면에서는 화면 머리가 갖는다.
 *
 * 두 링크는 중복이 아니라 서로 다른 두 진입점이다. 넥슨 바로 가기는 키를 이미 가진 사람의 동선이라 라벨 줄에 붙고,
 * 발급 안내는 키가 없는 사람의 것이라 확인 버튼 아래로 간다. 둘 중 하나를 빼면 그 사람의 다음 걸음이 사라진다.
 *
 * 키는 이 컴포넌트가 저장하지 않는다. `onSubmit` 으로 넘기면 스토어가 `storage/api-key` 를 거친다.
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { Button, ExternalLinkIcon, EyeIcon, EyeOffIcon, Text, TextInput } from '../../components/atoms'
import { openInAppBrowser } from '../../native/browser'

import { GUIDE_URL, NEXON_OPEN_API_URL } from './api-key-links'

export interface ApiKeyFormProps {
  isSubmitting: boolean
  onSubmit: (apiKey: string) => void
  /** 처음 채울 키. 온보딩에서 로그인 화면으로 돌아왔을 때 저장된 키다 */
  initialApiKey?: string
  /** 서자마자 입력칸에 초점을 줄지. 시트는 키를 치려고 연 것이라 준다 */
  autoFocus?: boolean
}

export function ApiKeyForm(props: ApiKeyFormProps): React.JSX.Element {
  const [apiKey, setApiKey] = useState(props.initialApiKey ?? '')
  const [isRevealed, setIsRevealed] = useState(false)

  function handleSubmit(): void {
    if (props.isSubmitting) return
    const trimmed = apiKey.trim()
    if (trimmed.length === 0) return
    props.onSubmit(trimmed)
  }

  const isSubmitDisabled = props.isSubmitting || apiKey.trim().length === 0

  return (
    <View className="w-full gap-4">
      <View className="gap-1.5">
        <View className="flex-row items-center justify-between px-0.5">
          <Text className="text-13 font-medium text-text-muted">Nexon Open API 키</Text>
          {/* 이미 키를 발급받은 사용자의 동선. 라벨 줄에 붙여 입력칸과 한 덩어리로 읽히게 한다. */}
          <Pressable
            role="link"
            onPress={() => openInAppBrowser(NEXON_OPEN_API_URL)}
            className="flex-row items-center gap-1 py-0.5"
          >
            <Text className="text-xs text-primary-ink">openapi.nexon.com에서 확인</Text>
            <ExternalLinkIcon className="h-3 w-3 text-primary-ink" aria-hidden />
          </Pressable>
        </View>
        <View className="relative flex-row items-center">
          <TextInput
            aria-label="Nexon Open API 키"
            value={apiKey}
            onChangeText={setApiKey}
            onSubmitEditing={handleSubmit}
            placeholder="발급받은 API 키를 입력하세요"
            secureTextEntry={!isRevealed}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoFocus={props.autoFocus}
            className="h-12 w-full rounded-[10px] bg-card-inset px-3.5 pr-11 text-base text-text"
          />
          <Pressable
            role="button"
            onPress={() => setIsRevealed((revealed) => !revealed)}
            aria-label={isRevealed ? '키 숨기기' : '키 표시'}
            className="absolute right-3 flex"
          >
            {isRevealed ? (
              <EyeOffIcon className="h-[18px] w-[18px] text-text-muted" aria-hidden />
            ) : (
              <EyeIcon className="h-[18px] w-[18px] text-text-muted" aria-hidden />
            )}
          </Pressable>
        </View>
      </View>

      {/* 채운 알약이 아니다. 키 경로를 넥슨 버튼과 같은 무게로 보이지 않게 한다. */}
      <Button
        variant="tint"
        onPress={handleSubmit}
        disabled={isSubmitDisabled}
        busy={props.isSubmitting}
        className={`w-full flex-row items-center justify-center${isSubmitDisabled ? ' opacity-50' : ''}`}
      >
        확인
      </Button>

      <Pressable
        role="link"
        onPress={() => openInAppBrowser(GUIDE_URL)}
        className="flex-row items-center gap-1 self-center px-3 py-0.5"
      >
        <Text className="text-13 text-primary-ink">API 키 발급 방법 보기</Text>
        <ExternalLinkIcon className="h-3.5 w-3.5 text-primary-ink" aria-hidden />
      </Pressable>
    </View>
  )
}
