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
    <form onSubmit={handleSubmit} className="rounded-[14px] bg-white border border-[#F0DFD1] p-6 space-y-4">
      <div className="h-32 flex items-center justify-center rounded-[10px] border-2 border-dashed border-[#F0DFD1]">
        <p className="text-sm text-[#B7A490]">API 키 발급 화면 예시</p>
      </div>

      <p className="text-sm text-[#8A7362]">
        <a
          href="https://openapi.nexon.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#C2410C] hover:text-[#E6652E] underline"
        >
          openapi.nexon.com
        </a>
        에서 발급받은 개인 API 키를 입력해주세요.
      </p>

      <div className="space-y-1">
        <label htmlFor="nexon-api-key" className="text-sm font-medium text-[#2B1B10]">
          Nexon Open API 키
        </label>
        <input
          id="nexon-api-key"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="발급받은 API 키를 입력하세요"
          className="w-full rounded-[10px] bg-white border border-[#F0DFD1] px-4 py-3 text-[#2B1B10]"
        />
      </div>

      {props.errorMessage !== null && <p className="text-sm text-[#B91C1C]">{props.errorMessage}</p>}

      <button
        type="submit"
        disabled={props.isSubmitting || apiKey.trim().length === 0}
        className="rounded-full bg-[#FF7033] text-[#2B1206] font-semibold hover:bg-[#E6652E] px-5 py-2.5 disabled:opacity-50"
      >
        확인
      </button>
    </form>
  )
}
