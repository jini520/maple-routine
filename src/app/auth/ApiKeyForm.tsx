/**
 * API 키 입력. 로그인 화면의 **둘째** 경로다.
 *
 * 넥슨 블록과 같은 골격을 쓴다. 소제목 한 줄, 그 아래 한 줄, 그리고 입력 수단. 그래서 이 폼은
 * 화면의 제목을 안 든다 - 제목은 `SignInScreen` 의 머리 블록이 갖는다.
 *
 * 두 링크는 중복이 아니라 서로 다른 두 진입점이다. 넥슨 바로 가기는 키를 이미 가진 사람의
 * 동선이라 인풋에 붙고, 발급 안내는 키가 없는 사람의 것이라 확인 버튼 아래로 간다. 둘 중 하나를
 * 빼면 그 결정이 깨진다.
 *
 * 키는 이 컴포넌트가 저장하지 않는다. `onSubmit` 으로 넘기면 스토어가 `storage/api-key` 를 거친다.
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { Button, EyeIcon, EyeOffIcon, Text, TextInput } from '../../components/atoms'
import { openInAppBrowser } from '../../native/browser'

import { GUIDE_URL, NEXON_OPEN_API_URL } from './api-key-links'

export interface ApiKeyFormProps {
  isSubmitting: boolean
  onSubmit: (apiKey: string) => void
  /** 처음 채울 키. 온보딩에서 로그인 화면으로 돌아왔을 때 저장된 키다 */
  initialApiKey?: string
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
    <View className="w-full gap-3.5">
      <View className="gap-0.5">
        <Text className="text-15 font-semibold text-text">API 키로 시작하기</Text>
        <Text className="text-13 text-text-muted">넥슨 오픈 API에서 받은 키를 직접 넣어요</Text>
      </View>

      <View className="gap-1">
        <Text className="text-sm font-medium text-text">Nexon Open API 키</Text>
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
            className="h-12 w-full rounded-[10px] border border-border bg-surface px-4 pr-11 text-base text-text"
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
        {/* 이미 키를 발급받은 사용자의 동선. 인풋에 붙여 한 덩어리로 읽히게 한다. */}
        <Pressable
          role="link"
          onPress={() => openInAppBrowser(NEXON_OPEN_API_URL)}
          className="self-start pt-0.5"
        >
          <Text className="text-xs text-primary-ink">openapi.nexon.com에서 확인</Text>
        </Pressable>
      </View>

      {/* 채운 알약이 아니다. 넥슨 버튼이 파란 채움이라 그 아래 주황 채움이 또 서면 무엇을 먼저
          눌러야 하는지가 색으로 안 갈린다. */}
      <Button
        variant="tint"
        onPress={handleSubmit}
        disabled={isSubmitDisabled}
        busy={props.isSubmitting}
        className={`w-full flex-row items-center justify-center${isSubmitDisabled ? ' opacity-50' : ''}`}
      >
        확인
      </Button>

      <View className="gap-1">
        <Pressable
          role="link"
          onPress={() => openInAppBrowser(GUIDE_URL)}
          className="self-center px-3 py-0.5"
        >
          <Text className="text-13 font-medium text-primary-ink">API 키 발급 방법 보기</Text>
        </Pressable>
        {/* 키는 기기에 저장된다(storage/api-key). "저장하지 않는다"는 약속은 지킬 수 없다.
            사실인 것은 백엔드가 없어 우리가 수집하지 않는다는 것뿐이다. */}
        <Text className="text-center text-xs text-text-muted">
          입력한 키는 이 기기에만 저장되고 넥슨 외 어디로도 전송되지 않아요
        </Text>
      </View>
    </View>
  )
}
