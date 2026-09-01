// API 키 입력 — 온보딩의 첫 관문([[ADR-003]] · [[ADR-007]] · [[ADR-110]]).
//
// 갈림길 레이아웃(`docs/features/onboarding.md`)을 그대로 옮긴다: 이 화면에 오는 사람은 둘뿐이라
// (키가 있는 사람 / 없는 사람) 폼이 먼저이고 넥슨 바로 가기가 인풋에 붙으며, 가이드는 구분선 뒤에서
// 처음으로 누를 수 있는 크기가 된다. [[ADR-110]] 이 두 링크를 *"중복이 아니라 서로 다른 두 진입점"*
// 이라 적은 것을 화면 구조로 옮긴 것이라, 둘 중 하나를 빼면 그 결정이 깨진다.
//
// 키는 이 컴포넌트가 저장하지 않는다 — `onSubmit` 으로 넘기면 스토어가 `storage/api-key` 를 거친다
// (CLAUDE.md CRITICAL · [[ADR-003]] 백엔드 없음).
//
// ── RN 으로 옮기며 갈린 것 일곱 ─────────────────────────────────────────────────────
//
// ① **`<form>` 이 없다.** 제출 경로가 둘로 갈린다 — 버튼의 `onPress` 와 키보드 완료 키의
//    `onSubmitEditing`. 웹의 `event.preventDefault()` 는 사라지지만 **가드는 그대로 남는다**
//    (제출 중이거나 값이 비면 안 부른다) — 웹 테스트가 그 가드를 따로 검사하던 이유가 여기서도 같다.
// ② `type={isRevealed ? 'text' : 'password'}` → **`secureTextEntry={!isRevealed}`**. 토글의 뜻은
//    같다: 붙여넣은 긴 문자열을 눈으로 확인할 수 있어야 한다(가려 두면 실패해도 401 토스트뿐이다).
// ③ `autoCorrect="off"` → `autoCorrect={false}`(RN 은 boolean). `autoCapitalize="none"` ·
//    `spellCheck={false}` 는 이름이 같다. **셋 다 남기는 이유가 갈리지 않는다** — 모바일 키보드가
//    첫 글자를 대문자로 바꾸면 조용히 틀린 키가 된다.
// ④ **`<label htmlFor>` 이 없다.** 라벨 글자는 `Text` 로 남기고, 접근성 이름은 `TextInput` 의
//    `aria-label` 이 직접 갖는다(RN 에 라벨-컨트롤 연결이 없다).
// ⑤ **`<a target="_blank">` → `Pressable role="link"` + `Linking.openURL`.** 하이브리드 앱에서
//    시스템 브라우저로 나가던 동작이 RN 에서는 이 호출이다. `rel="noopener noreferrer"` 는 브라우저
//    탭 사이의 문제라 짝이 없다 — OS 브라우저가 열리는 순간 관계 자체가 없다.
//    가이드 버튼은 `Button` atom 에 `role="link"` 를 덮어 쓴다(atom 이 `{...rest}` 를 뒤에 펼친다) —
//    **겉모습만 outline 을 입고 시맨틱은 링크**라는 [[ADR-110]] 후속 결정이 그대로 산다.
// ⑥ `hover:` 제거(터치 기기에 hover 가 없다 — atoms 와 같은 규칙), `disabled:opacity-50` 는 CSS
//    의사 클래스라 RN 프롭과 안 이어져 조건부 클래스가 된다.
// ⑦ **`placeholder` 색을 지정하지 않는다.** 웹도 지정하지 않아 브라우저 기본값이었고, 여기서도
//    플랫폼 기본값에 맡긴다 — 색을 새로 정하면 웹에 없던 결정을 여기서 만드는 것이 된다.
import { useState } from 'react'
import { Linking, Pressable, View } from 'react-native'

import { Button, Text, TextInput } from '../../components/atoms'
import { ExternalLinkIcon, EyeIcon, EyeOffIcon } from '../../lib/icons'

/** 1차 경로 — 처음 쓰는 사용자를 넥슨 첫 화면에 떨궈 놓지 않는다([[ADR-110]]). */
const GUIDE_URL = 'https://mapleroutine.store/api-key'
/** 이미 키를 발급받은 사용자의 동선 — 7단계 안내를 경유시키지 않는다. */
const NEXON_OPEN_API_URL = 'https://openapi.nexon.com'

export interface ApiKeyFormProps {
  isSubmitting: boolean
  onSubmit: (apiKey: string) => void
}

export function ApiKeyForm(props: ApiKeyFormProps): React.JSX.Element {
  const [apiKey, setApiKey] = useState('')
  const [isRevealed, setIsRevealed] = useState(false)

  // 웹 `handleSubmit` 그대로 — `preventDefault` 만 빠졌다(파일 머리 ①).
  function handleSubmit(): void {
    if (props.isSubmitting) return
    const trimmed = apiKey.trim()
    if (trimmed.length === 0) return
    props.onSubmit(trimmed)
  }

  const isSubmitDisabled = props.isSubmitting || apiKey.trim().length === 0

  return (
    <View className="w-full gap-4">
      <View className="gap-1">
        <Text className="text-lg font-semibold text-text">넥슨 API 키를 입력해주세요</Text>
        <Text className="text-sm text-text-muted">스케줄러 API를 사용하려면 개인 API 키가 필요해요</Text>
        {/* 키는 기기에 저장된다(storage/api-key, [[ADR-007]]) — "저장하지 않는다"는 약속은 지킬 수
            없다. 사실인 것은 백엔드가 없어([[ADR-003]]) 우리가 수집하지 않는다는 것뿐이다. */}
        <Text className="text-xs text-text-muted">
          입력한 키는 이 기기에만 저장되고 넥슨 외 어디로도 전송되지 않아요
        </Text>
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
            className="w-full rounded-[10px] border border-border bg-surface px-4 py-3 pr-11 text-text"
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
        {/* 이미 키를 발급받은 사용자의 동선 — 인풋에 붙여 한 덩어리로 읽히게 한다. */}
        <Pressable
          role="link"
          onPress={() => void Linking.openURL(NEXON_OPEN_API_URL)}
          className="flex-row items-center gap-1 pt-0.5"
        >
          <Text className="text-xs text-primary-ink">openapi.nexon.com에서 확인</Text>
          <ExternalLinkIcon className="h-3 w-3 text-primary-ink" aria-hidden />
        </Pressable>
      </View>

      <Button
        variant="primary"
        onPress={handleSubmit}
        disabled={isSubmitDisabled}
        busy={props.isSubmitting}
        className={`w-full flex-row items-center justify-center${isSubmitDisabled ? ' opacity-50' : ''}`}
      >
        확인
      </Button>

      {/* 구분선이 두 사용자군을 가른다 — 주 CTA 바로 아래 같은 pill 이 하나 더 서는 위험을
          막는 것도 이 줄이다(색·크기 차이와 함께). */}
      <View className="flex-row items-center gap-2.5">
        <View className="h-px flex-1 bg-border" aria-hidden />
        <Text className="text-xs text-text-muted">아직 API 키가 없나요?</Text>
        <View className="h-px flex-1 bg-border" aria-hidden />
      </View>

      <View className="gap-1">
        {/* 외부 URL 로 나가는 이동이라 시맨틱은 링크이고 겉모습만 outline 변형을 입는다(파일 머리 ⑤). */}
        <Button
          variant="outline"
          role="link"
          onPress={() => void Linking.openURL(GUIDE_URL)}
          className="w-full flex-row items-center justify-center gap-1.5"
        >
          API 키 발급 방법 보기
          <ExternalLinkIcon className="h-3.5 w-3.5 text-text" aria-hidden />
        </Button>
        {/* 무엇이 기다리는지 모른 채 앱을 떠나지 않게 한다. */}
        <Text className="text-center text-xs text-text-muted">넥슨 오픈 API에서 키를 받는 7단계 안내</Text>
      </View>
    </View>
  )
}
