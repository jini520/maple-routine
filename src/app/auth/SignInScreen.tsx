/**
 * 로그인 화면. **넥슨 로그인 하나를 앞에 세우고, API 키는 경고를 거쳐 상단 시트에서 받는다.**
 *
 * 앞으로 일부 기능은 넥슨 로그인으로만 쓸 수 있게 된다. 그래서 키로 가는 길은 화면 맨 아래의 작은 글자 버튼 하나이고,
 * 누르면 경고 모달이 먼저 뜬다. 경고를 넘긴 사람에게만 키 입력 상단 시트를 연다.
 *
 * **실패해도 화면이 안 바뀐다.** 검증 실패는 스토어가 토스트로 알리고 시트는 그대로 서 있다.
 * 검증(캐릭터 목록 조회)은 보통 1초 미만이라 별도 로딩 문구를 안 띄우고 제출 버튼만 스피너로 바꾼다.
 *
 * **온보딩 스택의 맨 아래다.** 로그인이 성공하면 캐릭터 설정을 밀고, 부팅이 온보딩 중간을 찾으면 그 단계까지
 * 스택을 다시 놓는다. 그래야 그 위 화면들에서 뒤로가기가 이 화면까지 온다. 다시 섰을 때 키 입력칸에는 저장된 키가 있다.
 *
 * @see docs/features/auth.md 정책
 */
import { useEffect, useState } from 'react'
import { Image, Pressable, View } from 'react-native'

import appIcon from '../../../assets/icon.png'

import { useAppEntryStore } from '../../features/app-entry/store'
import { NEXON_LOGIN_ENABLED } from '../../features/auth/nexon-login-enabled'
import { loadSavedApiKey } from '../../features/auth/saved-key'
import { useAuthStore } from '../../features/auth/store'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'
import { boxShadowOf, type ShadowLayer } from '../../lib/shadow'
import { useThemeAppearance } from '../../theme/context'

import { ExternalLinkIcon, Text } from '../../components/atoms'
import { NexonLoginButton } from '../../components/molecules/NexonLoginButton/NexonLoginButton'
import { EntryScroll } from '../../components/templates/EntryScroll/EntryScroll'
import { openInAppBrowser } from '../../native/browser'
import { ApiKeyForm } from './ApiKeyForm'
import { ApiKeySheet } from './ApiKeySheet'
import { ApiKeyWarningModal } from './ApiKeyWarningModal'
import { DevelopmentStageKeyModal } from './DevelopmentStageKeyModal'

/**
 * 넥슨이 `게임 데이터 활용 로그인` 을 설명하는 곳. 그 다섯 문장을 앱이 싣지 않고 여기로 보낸다.
 * 넥슨이 문구를 고치면 앱을 안 고쳐도 따라간다.
 */
const DATA_UTIL_LOGIN_URL = 'https://openapi.nexon.com/ko/data-util/introduction/'

/** 아이콘 바탕과 페이지 색의 밝기가 거의 같아 경계가 필요하다. 테두리 대신 그림자로 가른다. */
const ICON_SHADOW: ShadowLayer = { opacity: 0.6, radius: 12, y: 6 }

export function SignInScreen(): React.JSX.Element {
  const status = useAuthStore((state) => state.status)
  const signIn = useAuthStore((state) => state.signIn)
  const signInWithNexonAccount = useAuthStore((state) => state.signInWithNexonAccount)
  const resumeTo = useAppEntryStore((state) => state.resumeTo)
  const navigation = useScreenNavigation()
  const { definition } = useThemeAppearance()
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [warningOpen, setWarningOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

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
    // 다음 화면으로 넘어가며 시트를 걷는다. 남겨 두면 뒤로가기로 돌아왔을 때 시트가 열린 채로 서 있다.
    setSheetOpen(false)
    // 앱이 열리면(`ready`) 스택이 통째로 바뀌어 밀 것이 없다.
    if (useAppEntryStore.getState().stage !== 'ready') navigation.navigate('CharacterSetup')
  }

  const keyForm = (
    // 저장된 키가 늦게 읽히면 폼을 새로 세워 그 키로 채운다.
    <ApiKeyForm
      key={savedKey ?? ''}
      initialApiKey={savedKey ?? undefined}
      isSubmitting={status === 'verifying'}
      onSubmit={(apiKey) => void submit(apiKey)}
    />
  )

  // `testID` 는 내비게이션 계약이다. `RootNavigator` 의 분기 테스트가 이 이름으로 "지금 이 화면이
  // 떠 있는가"를 묻는다(`screen-<라우트 이름>` 규약).
  return (
    <View testID="screen-SignIn" className="flex-1">
      <EntryScroll>
        <View className="flex-1">
          <View className="flex-1 justify-center gap-8 px-2">
            <View className="items-center gap-4">
              <View
                className="rounded-[22px]"
                style={{ boxShadow: boxShadowOf(definition.shadowColor, ICON_SHADOW) }}
              >
                <Image testID="app-icon" source={appIcon} className="h-24 w-24 rounded-[22px]" accessible={false} />
              </View>
              <View className="items-center gap-2">
                <Text className="text-2xl font-bold text-text">메이플 루틴</Text>
                {/* 두 줄이 한 문장이라 사이를 안 벌린다. 줄 높이(20)가 곧 문단의 리듬이다. */}
                <View>
                  <Text className="text-center text-sm text-text-muted">
                    내 메이플 스토리 스케줄 정보 조회를 위해서
                  </Text>
                  {/* 넥슨 로그인이 꺼져 있으면 로그인을 말하지 않는다. 없는 수단을 찾게 된다. */}
                  <Text className="text-center text-sm text-text-muted">
                    {NEXON_LOGIN_ENABLED ? '넥슨 로그인이 필요해요.' : 'API 키 입력이 필요해요.'}
                  </Text>
                </View>
              </View>
            </View>

            {/*
              **수단이 없을 때 서는 유일한 화면이다.** 로그아웃하면 탭 자체를 못 보므로, 여기 버튼이
              없으면 나간 사용자가 다시 들어올 길이 없다.
            */}
            {NEXON_LOGIN_ENABLED ? (
              <View className="gap-3">
                <NexonLoginButton onPress={() => void signInWithNexonAccount()} />
                {/* 글자 폭만큼만 차지한다. 줄 전체로 늘리면 옆 빈 자리를 눌러도 반응해 어디까지가 링크인지 알 수 없다. */}
                <Pressable
                  role="link"
                  onPress={() => openInAppBrowser(DATA_UTIL_LOGIN_URL)}
                  className="flex-row items-center gap-1 self-center px-3 py-0.5"
                >
                  <Text className="text-13 text-primary-ink">게임 데이터 활용 로그인이란?</Text>
                  <ExternalLinkIcon className="h-3.5 w-3.5 text-primary-ink" aria-hidden />
                </Pressable>
              </View>
            ) : (
              // 넥슨 로그인이 없으면 키가 유일한 방법이라 경고와 시트를 거치지 않는다.
              <View className="rounded-[14px] bg-surface p-4">{keyForm}</View>
            )}
          </View>

          {NEXON_LOGIN_ENABLED && (
            <Pressable role="button" onPress={() => setWarningOpen(true)} className="self-center px-3 py-2">
              <Text className="text-xs text-text-muted">API 키로 시작하기</Text>
            </Pressable>
          )}
        </View>
      </EntryScroll>

      {warningOpen && (
        <ApiKeyWarningModal
          onClose={() => setWarningOpen(false)}
          onNexonLogin={() => {
            setWarningOpen(false)
            void signInWithNexonAccount()
          }}
          onContinueWithApiKey={() => {
            setWarningOpen(false)
            setSheetOpen(true)
          }}
        />
      )}
      {sheetOpen && (
        <ApiKeySheet
          key={savedKey ?? ''}
          initialApiKey={savedKey ?? undefined}
          isSubmitting={status === 'verifying'}
          onSubmit={(apiKey) => void submit(apiKey)}
          onClose={() => setSheetOpen(false)}
        />
      )}
      {/* 폼과 직교한다. 스스로 떠 있을 때만 그리므로 이 한 줄로 시트 위에 덮인다. */}
      <DevelopmentStageKeyModal />
    </View>
  )
}
