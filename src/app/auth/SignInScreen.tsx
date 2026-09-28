/**
 * 로그인 화면. **넥슨 로그인이 주 경로이고 API 키가 그 아래 선다.**
 *
 * 세 블록이다. 머리(앱 아이콘 + 왜 인증이 필요한지 두 줄) · 넥슨 · 키. 뒤의 둘은 소제목 · 둘째 줄 ·
 * 입력 수단의 같은 골격을 쓰고, 둘째 줄만 성질이 갈려 색이 다르다(넥슨 쪽은 링크, 키 쪽은 설명).
 *
 * 머리에 앱 이름을 안 쓴다. 아이콘이 이미 그 일을 하고, 이름을 적으면 그 줄이 제목 자리를 먹어
 * 정작 필요한 설명이 보조로 밀린다.
 *
 * **실패해도 화면이 안 바뀐다.** 검증 실패는 스토어가 토스트로 알리고 폼은 그대로 서 있다.
 * 계정 목록이라는 것이 없으므로 그릴 수 있는 것이 폼 하나이고, 출구 없는 흰 화면을 만들지 않는다.
 * 그래서 상태에 실패 값이 따로 없고 원인만 `error` 로 남는다.
 *
 * 검증(캐릭터 목록 조회)은 보통 1초 미만이라 별도 로딩 문구를 안 띄우고, 입력 폼을 그대로 유지한
 * 채 제출 버튼만 로딩 스피너로 바꾼다.
 *
 * **온보딩 스택의 맨 아래다.** 로그인이 성공하면 캐릭터 설정을 밀고, 부팅이 온보딩 중간을 찾으면 그 단계까지
 * 스택을 다시 놓는다. 그래야 그 위 화면들에서 뒤로가기가 이 화면까지 온다. 다시 섰을 때 입력칸에는 저장된 키가 있다.
 *
 * @see docs/features/auth.md 정책
 */
import { useEffect, useState } from 'react'
import { Image, Pressable, View } from 'react-native'

import appIcon from '../../../assets/icon.png'

import { useAppEntryStore } from '../../features/app-entry/store'
import { loadSavedApiKey } from '../../features/auth/saved-key'
import { useAuthStore } from '../../features/auth/store'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'

import { ExternalLinkIcon, Text } from '../../components/atoms'
import { NexonLoginButton } from '../../components/molecules/NexonLoginButton/NexonLoginButton'
import { EntryScroll } from '../../components/templates/EntryScroll/EntryScroll'
import { openInAppBrowser } from '../../native/browser'
import { ApiKeyForm } from './ApiKeyForm'
import { DevelopmentStageKeyModal } from './DevelopmentStageKeyModal'

/**
 * 넥슨이 `게임 데이터 활용 로그인` 을 설명하는 곳. 그 다섯 문장을 앱이 싣지 않고 여기로 보낸다.
 * 넥슨이 문구를 고치면 앱을 안 고쳐도 따라간다.
 */
const DATA_UTIL_LOGIN_URL = 'https://openapi.nexon.com/ko/data-util/introduction/'

export function SignInScreen(): React.JSX.Element {
  const status = useAuthStore((state) => state.status)
  const signIn = useAuthStore((state) => state.signIn)
  const signInWithNexonAccount = useAuthStore((state) => state.signInWithNexonAccount)
  const resumeTo = useAppEntryStore((state) => state.resumeTo)
  const navigation = useScreenNavigation()
  const [savedKey, setSavedKey] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void loadSavedApiKey().then((key) => {
      if (alive) setSavedKey(key)
    })
    return () => {
      alive = false
    }
  }, [])

  // 부팅이 찾은 단계까지 한 번 쌓는다. 스플래시가 덮고 있어 밀리는 것이 안 보인다.
  useEffect(() => {
    if (resumeTo === null) return
    navigation.navigate('CharacterSetup')
    if (resumeTo === 'mvpGrade') navigation.navigate('MvpGradePick')
    useAppEntryStore.getState().consumeResume()
  }, [resumeTo, navigation])

  async function submit(apiKey: string): Promise<void> {
    if (!(await signIn(apiKey))) return
    // 앱이 열리면(`ready`) 스택이 통째로 바뀌어 밀 것이 없다.
    if (useAppEntryStore.getState().stage !== 'ready') navigation.navigate('CharacterSetup')
  }

  // `testID` 는 내비게이션 계약이다. `RootNavigator` 의 분기 테스트가 이 이름으로 "지금 이 화면이
  // 떠 있는가"를 묻는다(`screen-<라우트 이름>` 규약).
  return (
    <View testID="screen-SignIn" className="flex-1">
      <EntryScroll>
        <View className="w-full gap-6">
          <View className="items-center gap-3.5">
            {/* 테두리가 있어야 아이콘 바탕과 페이지가 갈린다. 둘 다 밝기가 거의 같다. */}
            <Image
              testID="app-icon"
              source={appIcon}
              className="h-[72px] w-[72px] rounded-2xl border border-border"
              accessible={false}
            />
            {/* 두 줄이 한 문장이라 사이를 안 벌린다. 줄 높이(20)가 곧 문단의 리듬이다. */}
            <View>
              <Text className="text-center text-sm text-text-muted">
                내 메이플 스토리 스케줄 정보 조회를 위해서
              </Text>
              <Text className="text-center text-sm text-text-muted">
                로그인 또는 API 키 입력이 필요해요.
              </Text>
            </View>
          </View>

          {/*
            **수단이 없을 때 서는 유일한 화면이다.** 로그아웃하면 탭 자체를 못 보므로, 여기 버튼이
            없으면 나간 사용자가 다시 들어올 길이 없다.
          */}
          <View className="gap-3.5">
            <View className="gap-0.5">
              <Text className="text-15 font-semibold text-text">
                게임 데이터 활용 로그인으로 시작하기
              </Text>
              {/* 글자 폭만큼만 차지한다. 줄 전체로 늘리면 옆 빈 자리를 눌러도 반응해 어디까지가
                  링크인지 알 수 없다. */}
              <Pressable
                role="link"
                onPress={() => openInAppBrowser(DATA_UTIL_LOGIN_URL)}
                className="flex-row items-center gap-1 self-start py-0.5"
              >
                <Text className="text-13 text-primary-ink">게임 데이터 활용 로그인이란?</Text>
                <ExternalLinkIcon className="h-3.5 w-3.5 text-primary-ink" aria-hidden />
              </Pressable>
            </View>
            <NexonLoginButton onPress={() => void signInWithNexonAccount()} />
          </View>

          {/* 저장된 키가 늦게 읽히면 폼을 새로 세워 그 키로 채운다. */}
          <ApiKeyForm
            key={savedKey ?? ''}
            initialApiKey={savedKey ?? undefined}
            isSubmitting={status === 'verifying'}
            onSubmit={(apiKey) => void submit(apiKey)}
          />
        </View>
      </EntryScroll>
      {/* 폼과 직교한다. 스스로 떠 있을 때만 그리므로 이 한 줄로 폼 위에 덮인다. */}
      <DevelopmentStageKeyModal />
    </View>
  )
}
