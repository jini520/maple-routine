/**
 * today 머리의 `넥슨 ID 연동하기`. 캐릭터 관리 버튼 왼쪽의 글자 버튼이고, 누르면 연동 시트를 연다.
 *
 * 키로 이미 들어온 사용자가 앱 안에서 넥슨 로그인으로 가는 입구다. 로그인 화면은 저장된 수단이 하나도 없을 때만 선다.
 *
 * @see docs/features/auth.md 넥슨 로그인
 */
import { useCallback, useState } from 'react'
import { Pressable } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

import { Text } from '../../components/atoms'
import { NEXON_LOGIN_ENABLED } from '../../features/auth/nexon-login-enabled'
import { hasNexonLogin } from '../../features/auth/saved-key'
import { useAuthStore } from '../../features/auth/store'
import { NexonLinkSheet } from '../auth/NexonLinkSheet'

const LABEL = '넥슨 ID 연동하기'

export function NexonLinkButton(): React.JSX.Element | null {
  // 확인하기 전에는 세우지 않는다. 로그인한 사용자에게 보였다가 사라지면 버튼이 깜빡인다.
  const [visible, setVisible] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const signInWithNexonAccount = useAuthStore((state) => state.signInWithNexonAccount)

  // 들어올 때마다 다시 본다. 로그인이 만료돼 지워지면 다음 포커스에서 버튼이 돌아온다.
  useFocusEffect(
    useCallback(() => {
      let alive = true
      void hasNexonLogin().then((has) => {
        if (alive) setVisible(!has)
      })
      return () => {
        alive = false
      }
    }, []),
  )

  async function signIn(): Promise<void> {
    // 시트가 토스트보다 위에 그려진다. 먼저 닫지 않으면 실패 토스트가 시트에 가려진다.
    setSheetOpen(false)
    if (await signInWithNexonAccount()) setVisible(false)
  }

  if (!NEXON_LOGIN_ENABLED || !visible) return null

  return (
    <>
      <Pressable
        role="button"
        aria-label={LABEL}
        onPress={() => setSheetOpen(true)}
        // 글자 줄이 29 라 손가락 자리를 위아래로 넓힌다.
        hitSlop={{ top: 8, bottom: 8 }}
        className="px-3.5 py-1.5"
      >
        <Text className="text-xs font-semibold text-primary-ink">{LABEL}</Text>
      </Pressable>

      {sheetOpen && <NexonLinkSheet onClose={() => setSheetOpen(false)} onSignIn={() => void signIn()} />}
    </>
  )
}
