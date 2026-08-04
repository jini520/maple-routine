import { useState } from 'react'
import { MapleSpinner } from '../../components/MapleSpinner/MapleSpinner'
import { Button } from '../../components/Button/Button'

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
      <p className="text-sm text-text-muted">
        <a
          href="https://openapi.nexon.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-ink hover:text-primary-hover underline"
        >
          openapi.nexon.com
        </a>
        에서 발급받은 개인 API 키를 입력해주세요.
      </p>

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
