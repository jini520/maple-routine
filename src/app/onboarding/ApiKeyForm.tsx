import { useState } from 'react'
import { MapleSpinner } from '../../components/atoms/MapleSpinner/MapleSpinner'
import { Button } from '../../components/atoms/Button/Button'

export interface ApiKeyFormProps {
  isSubmitting: boolean
  onSubmit: (apiKey: string) => void
}

export function ApiKeyForm(props: ApiKeyFormProps): React.JSX.Element {
  const [apiKey, setApiKey] = useState('')

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (props.isSubmitting) return
    const trimmed = apiKey.trim()
    if (trimmed.length === 0) return
    props.onSubmit(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      {/*
        발급 절차(7단계)는 앱 밖에 있고, 안내도 앱 번들이 아니라 안내 사이트가 담당한다(ADR-110).
        링크는 둘이다 — 처음 쓰는 사용자를 넥슨 첫 화면에 떨궈 놓지 않도록 가이드가 1차 경로이고,
        이미 키를 발급받은 사용자가 7단계 안내를 경유하지 않도록 바로 가기를 아래 줄에 둔다.
        하이브리드 앱이라 둘 다 시스템 브라우저로 나가지만, 재개 지점이 저장된 값에서 파생되므로
        (ADR-086 결정 1) 키를 넣기 전에 나갔다 돌아와도 이 화면 그대로다.
      */}
      <div className="space-y-1">
        <p className="text-sm text-text-muted">
          <a
            href="https://mapleroutine.store/api-key"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-ink hover:text-primary-hover underline"
          >
            API 키 발급 방법
          </a>
          을 보고 받은 개인 API 키를 입력해주세요.
        </p>
        <p className="text-xs text-text-muted">
          이미 발급받았다면{' '}
          <a
            href="https://openapi.nexon.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-ink hover:text-primary-hover underline"
          >
            openapi.nexon.com
          </a>
          에서 바로 확인하세요.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="nexon-api-key" className="text-sm font-medium text-text">
          Nexon Open API 키
        </label>
        <input
          id="nexon-api-key"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="발급받은 API 키를 입력하세요"
          className="w-full rounded-[10px] bg-surface border border-border px-4 py-3 text-text"
        />
      </div>

      <Button
        variant="primary"
        type="submit"
        disabled={props.isSubmitting || apiKey.trim().length === 0}
        aria-busy={props.isSubmitting}
        className="flex w-full items-center justify-center gap-2 disabled:opacity-50"
      >
        {/* ADR-061 결정 5·9: 버튼 안은 스피너 + 말줄임표 없는 '~중' 라벨을 함께 둔다 — 라벨이
            남아야 무엇이 진행 중인지 글자로 확인된다(파괴적 동작과 형태를 맞춘다). */}
        {props.isSubmitting && <MapleSpinner size={16} />}
        {props.isSubmitting ? '확인 중' : '확인'}
      </Button>
    </form>
  )
}
