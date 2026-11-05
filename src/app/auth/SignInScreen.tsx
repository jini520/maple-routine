/**
 * 로그인 화면. **넥슨 로그인 하나를 앞에 세우고, API 키는 경고를 거쳐 상단 시트에서 받는다.**
 *
 * 앞으로 일부 기능은 넥슨 로그인으로만 쓸 수 있게 된다. 그래서 키로 가는 길은 화면 맨 아래의 작은 글자 버튼 하나이고,
 * 누르면 경고 모달이 먼저 뜬다. 경고를 넘긴 사람에게만 키 입력 상단 시트를 연다.
 * 넥슨 로그인 입구가 꺼져 있으면 넥슨 버튼 자리에 `API 키로 로그인` 을 두고, 경고 없이 시트를 연다.
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
import { Pressable, View } from 'react-native'
import { Path } from 'react-native-svg'

import { useAppEntryStore } from '../../features/app-entry/store'
import { NEXON_LOGIN_ENABLED } from '../../features/auth/nexon-login-enabled'
import { loadSavedApiKey } from '../../features/auth/saved-key'
import { useAuthStore } from '../../features/auth/store'
import { useFaqSheet } from '../../features/faq/use-faq-sheet'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'
import { Svg } from '../../lib/nativewind-interop'

import { Text } from '../../components/atoms'
import { ApiKeyLoginButton } from '../../components/molecules/ApiKeyLoginButton/ApiKeyLoginButton'
import { NexonLoginButton } from '../../components/molecules/NexonLoginButton/NexonLoginButton'
import { FaqButton } from '../../components/organisms/FaqSheet/FaqButton'
import { EntryScroll } from '../../components/templates/EntryScroll/EntryScroll'
import { SPLASH_LEAF_PATH, SPLASH_LEAF_VIEW_BOX } from '../splash/leaf'
import { WORDMARK_EM_HEIGHT, WORDMARK_GLYPHS, WORDMARK_UNITS_PER_EM } from '../splash/wordmark'
import { ApiKeySheet } from './ApiKeySheet'
import { ApiKeyWarningModal } from './ApiKeyWarningModal'
import { DataUtilLoginLink } from './DataUtilLoginLink'
import { DevelopmentStageKeyModal } from './DevelopmentStageKeyModal'

/** 이름 글자 크기. 잎 높이(117%)와 획 윤곽선(em 의 1000 분의 18)은 스플래시와 같아야 두 화면의 이름이 같은 글자로 보인다. */
const NAME_PX = 34
const LEAF_PX = Math.round(NAME_PX * 1.17)
const WORDMARK_STROKE_UNITS = 18

const GLYPH_OFFSETS = WORDMARK_GLYPHS.map((_, index) =>
  WORDMARK_GLYPHS.slice(0, index).reduce((sum, glyph) => sum + glyph.advance, 0),
)
const WORDMARK_ADVANCE = WORDMARK_GLYPHS.reduce((sum, glyph) => sum + glyph.advance, 0)

/** 스플래시의 잎과 이름 묶음. 이름은 서체 윤곽을 그린 그림이라 글자 크기 설정을 따르지 않는다. */
function NameLockup(): React.JSX.Element {
  return (
    <View accessible role="img" aria-label="메이플 루틴" className="flex-row items-center gap-1.5">
      <Svg width={(LEAF_PX * 127) / 130} height={LEAF_PX} viewBox={SPLASH_LEAF_VIEW_BOX} className="text-primary">
        <Path d={SPLASH_LEAF_PATH} fill="currentColor" />
      </Svg>
      <Svg
        width={(NAME_PX * WORDMARK_ADVANCE) / WORDMARK_UNITS_PER_EM}
        height={NAME_PX}
        viewBox={`0 0 ${WORDMARK_ADVANCE} ${WORDMARK_EM_HEIGHT}`}
        className="text-text"
      >
        {WORDMARK_GLYPHS.map((glyph, index) =>
          glyph.path === '' ? null : (
            <Path
              key={glyph.char}
              d={glyph.path}
              transform={`translate(${GLYPH_OFFSETS[index]} 0)`}
              fill="currentColor"
              stroke="currentColor"
              strokeWidth={WORDMARK_STROKE_UNITS}
              strokeLinejoin="round"
            />
          ),
        )}
      </Svg>
    </View>
  )
}

export function SignInScreen(): React.JSX.Element {
  const faq = useFaqSheet('sign-in')
  const status = useAuthStore((state) => state.status)
  const signIn = useAuthStore((state) => state.signIn)
  const signInWithNexonAccount = useAuthStore((state) => state.signInWithNexonAccount)
  const resumeTo = useAppEntryStore((state) => state.resumeTo)
  const navigation = useScreenNavigation()
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

  // 키로 들어갈 때와 같이 민다. 처음 쓰는 사용자는 고른 캐릭터가 없어 앱이 열리지 않으므로, 안 밀면 이 화면에 머문다.
  async function signInWithNexonAndContinue(): Promise<void> {
    if (!(await signInWithNexonAccount())) return
    if (useAppEntryStore.getState().stage !== 'ready') navigation.navigate('CharacterSetup')
  }

  // `testID` 는 내비게이션 계약이다. `RootNavigator` 의 분기 테스트가 이 이름으로 "지금 이 화면이
  // 떠 있는가"를 묻는다(`screen-<라우트 이름>` 규약).
  return (
    <View testID="screen-SignIn" className="flex-1">
      <EntryScroll>
        {/* 스크롤 내용 안에 띄워 내용과 함께 굴러간다. 화면에 고정하면 낮은 화면에서 굴린 내용과 겹친다. */}
        <View className="absolute left-4 top-0">
          <FaqButton sheet={faq} variant="text" />
        </View>
        <View className="flex-1">
          <View className="flex-1 justify-center gap-8 px-2">
            <View className="items-center gap-16">
              <NameLockup />
              {/* 두 줄이 한 문장이라 사이를 안 벌린다. 줄은 손으로 나눈다. 자동 줄바꿈은 폭에 따라 말 가운데서 꺾는다. */}
              <View>
                <Text className="text-center text-sm text-text-muted">
                  넥슨 Open API의 메이플스토리 스케줄러와 강화 기록을
                </Text>
                {/* 넥슨 로그인이 꺼져 있으면 로그인을 말하지 않는다. 없는 수단을 찾게 된다. */}
                <Text className="text-center text-sm text-text-muted">
                  {NEXON_LOGIN_ENABLED ? '불러오려면 넥슨 로그인이 필요해요.' : '불러오려면 API 키 입력이 필요해요.'}
                </Text>
              </View>
            </View>

            {/*
              **수단이 없을 때 서는 유일한 화면이다.** 로그아웃하면 탭 자체를 못 보므로, 여기 버튼이
              없으면 나간 사용자가 다시 들어올 길이 없다.
            */}
            {NEXON_LOGIN_ENABLED ? (
              <View className="gap-3">
                <NexonLoginButton onPress={() => void signInWithNexonAndContinue()} />
                <DataUtilLoginLink />
              </View>
            ) : (
              // 경고는 넥슨 로그인을 한 번 더 권하는 창이라, 넥슨 로그인이 없으면 거치지 않는다.
              <ApiKeyLoginButton onPress={() => setSheetOpen(true)} />
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
            void signInWithNexonAndContinue()
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
