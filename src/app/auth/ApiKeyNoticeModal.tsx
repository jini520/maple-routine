/**
 * 저장된 키로 조회가 막힌 것을 알리는 모달들.
 *
 * 즉시 이동은 사용자가 이유를 읽기도 전에 화면을 바꿔버려 원인과 결과가 이어지지 않는다.
 * 토스트는 스스로 사라지기까지 한다. 그래서 원래 화면이 뒤에 남은 채 이 모달이 덮인다.
 *
 * 무효 키와 넥슨 로그인 만료는 확인을 눌러야 이동한다. 저장된 수단으로는 앞으로 갈 수 없다는 것이 둘 다 같아 아이콘과 문구만
 * 갈린다. 닫을 수 없다. 그 상태에서는 어느 화면도 제 기능을 못 하므로 닫아서 돌아갈 곳이 없다.
 *
 * 429 는 키를 지우지 않는 다시 시도 모달(`RateLimitNoticeModal`)이다. 메인 키의 `다른 키 입력` 은 이 컴포넌트가 든 키 입력
 * 시트를 연다. 시트는 알림을 닫은 뒤에도 서 있어야 해서 알림과 따로 든다.
 */
import { useEffect, useState } from 'react'

import { useAuthStore } from '../../features/auth/store'
import type { ApiKeyNoticeKind } from '../../features/auth/state'
import { pullRefresh } from '../../features/refresh/pull'

import { CircleUserRoundIcon, KeyRoundIcon } from '../../components/atoms'
import { NoticeModal } from '../../components/organisms/NoticeModal/NoticeModal'
import { ApiKeySheet } from './ApiKeySheet'
import { DevelopmentStageKeyModal } from './DevelopmentStageKeyModal'
import { RateLimitNoticeModal } from './RateLimitNoticeModal'

interface NoticeCopy {
  icon: typeof KeyRoundIcon
  title: string
  body: string
}

const NOTICE_COPY: Record<Exclude<ApiKeyNoticeKind, 'rateLimited'>, NoticeCopy> = {
  // 다음에 무슨 일이 일어나는지 먼저 말한다. 확인을 누르면 화면이 바뀌기 때문이다.
  invalid: {
    icon: KeyRoundIcon,
    title: 'API 키가 더 이상 유효하지 않습니다',
    body: '키 입력 화면으로 이동합니다.',
  },
  // 다음에 무슨 일이 일어나는지 말하지 않는다. 이 원인만 **사용자마다 다르다** - API 키가 남아
  // 있으면 확인을 눌러도 화면이 그대로다. 대신 두 갈래에서 모두 참인 처방을 말한다.
  signInRequired: {
    icon: CircleUserRoundIcon,
    title: '넥슨 로그인이 만료됐습니다',
    body: '다시 로그인해주세요.',
  },
}

export function ApiKeyNoticeModal(): React.JSX.Element | null {
  const apiKeyNotice = useAuthStore((state) => state.apiKeyNotice)
  const confirmApiKeyNotice = useAuthStore((state) => state.confirmApiKeyNotice)
  // 429 모달의 `다른 키 입력` 이 연 키 입력 시트. 알림을 닫은 뒤에도 서 있어야 해서 알림과 따로 든다.
  const [replacing, setReplacing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [keyRole, setKeyRole] = useState<'main' | 'sub' | null>(null)

  const rateLimited = apiKeyNotice?.kind === 'rateLimited' ? apiKeyNotice : null
  useEffect(() => {
    if (rateLimited === null) return
    let alive = true
    setKeyRole(null)
    void useAuthStore
      .getState()
      .rateLimitedKeyRole(rateLimited.apiKey)
      .then((role) => {
        if (alive) setKeyRole(role)
      })
    return () => {
      alive = false
    }
  }, [rateLimited])

  const retry = (): void => {
    useAuthStore.getState().retryRateLimitNotice()
    void pullRefresh()
  }
  const enterOtherKey = (): void => {
    useAuthStore.getState().retryRateLimitNotice()
    setReplacing(true)
  }
  const submitOtherKey = async (apiKey: string): Promise<void> => {
    setSubmitting(true)
    const result = await useAuthStore.getState().replaceMainApiKey(apiKey)
    setSubmitting(false)
    if (result !== 'replaced') return
    setReplacing(false)
    void pullRefresh()
  }

  return (
    <>
      {/* falsy 검사인 것이 의도다. `=== null` 이면 스토어를 부분 모킹한 테스트에서 `undefined` 가 와 **모든 화면 위에 닫을 수
          없는 모달이 떠버린다**. 차단 UI 는 "켜라고 명시했을 때만" 켜지는 쪽이 안전하다. */}
      {apiKeyNotice && rateLimited !== null && (
        <RateLimitNoticeModal
          attempt={rateLimited.attempt ?? 1}
          canEnterOtherKey={keyRole === 'main'}
          onRetry={retry}
          onEnterOtherKey={enterOtherKey}
        />
      )}
      {apiKeyNotice && apiKeyNotice.kind !== 'rateLimited' && (
        // 톤은 두 원인 모두 `error` 다. 아이콘만 원인을 가리킨다: 무효 키는 `KeyRound`, 로그인 만료는 사람(`CircleUserRound`).
        <NoticeModal
          icon={NOTICE_COPY[apiKeyNotice.kind].icon}
          tone="error"
          title={NOTICE_COPY[apiKeyNotice.kind].title}
          description={NOTICE_COPY[apiKeyNotice.kind].body}
          action={{ label: '확인', onPress: () => void confirmApiKeyNotice() }}
          // 닫을 수 없다. 뒤에 있는 화면이 이미 제 기능을 못 해 닫아서 돌아갈 곳이 없다.
          onClose={() => {}}
          testId="api-key-notice-overlay"
        />
      )}
      {replacing && (
        <ApiKeySheet
          purpose="replace"
          isSubmitting={submitting}
          onSubmit={(apiKey) => void submitOtherKey(apiKey)}
          onClose={() => setReplacing(false)}
        />
      )}
      {replacing && <DevelopmentStageKeyModal />}
    </>
  )
}
