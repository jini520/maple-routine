import { useState } from 'react'

export interface ApiKeyFormProps {
  isSubmitting: boolean
  errorMessage: string | null
  onSubmit: (apiKey: string) => void
}

export function ApiKeyForm(props: ApiKeyFormProps): React.JSX.Element {
  const [apiKey, setApiKey] = useState('')

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const trimmed = apiKey.trim()
    if (trimmed.length === 0) return
    props.onSubmit(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full rounded-[14px] bg-surface border border-border p-6 space-y-4">
      <p className="text-sm text-text-muted">
        <a
          href="https://openapi.nexon.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-text hover:text-primary-hover underline"
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

      {props.errorMessage !== null && <p className="text-sm text-error">{props.errorMessage}</p>}

      <button
        type="submit"
        disabled={props.isSubmitting || apiKey.trim().length === 0}
        className="w-full rounded-full bg-primary text-bg font-semibold hover:bg-primary-hover px-5 py-2.5 disabled:opacity-50"
      >
        확인
      </button>
    </form>
  )
}
