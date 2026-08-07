import { useState } from 'react'
import { Eye, EyeOff, ExternalLink } from 'lucide-react'
import { MapleSpinner } from '../../components/atoms/MapleSpinner/MapleSpinner'
import { Button } from '../../components/atoms/Button/Button'
import { BUTTON_VARIANT_CLASS } from '../../components/atoms/Button/variants'

export interface ApiKeyFormProps {
  isSubmitting: boolean
  onSubmit: (apiKey: string) => void
}

export function ApiKeyForm(props: ApiKeyFormProps): React.JSX.Element {
  const [apiKey, setApiKey] = useState('')
  const [isRevealed, setIsRevealed] = useState(false)

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
        이 화면에 오는 사람은 둘뿐이다 — 키가 있는 사람과 없는 사람. ADR-110 이 두 링크를
        "중복이 아니라 서로 다른 두 진입점"이라 적은 것을 화면 구조로 옮긴다(갈림길 레이아웃):
        폼이 먼저이고 넥슨 바로 가기가 인풋에 붙으며, 가이드는 구분선 뒤에서 처음으로 누를 수
        있는 크기가 된다. 하이브리드 앱이라 둘 다 시스템 브라우저로 나가지만, 재개 지점이 저장된
        값에서 파생되므로(ADR-086 결정 1) 키를 넣기 전에 나갔다 돌아와도 이 화면 그대로다.
      */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text">넥슨 API 키를 입력해주세요</h2>
        <p className="text-sm text-text-muted">스케줄러 API를 사용하려면 개인 API 키가 필요해요</p>
        {/* 키는 기기에 저장된다(storage/api-key, ADR-007) — "저장하지 않는다"는 약속은 지킬 수
            없다. 사실인 것은 백엔드가 없어(ADR-003) 우리가 수집하지 않는다는 것뿐이다. */}
        <p className="text-xs text-text-muted">
          입력한 키는 이 기기에만 저장되고 넥슨 외 어디로도 전송되지 않아요
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="nexon-api-key" className="text-sm font-medium text-text">
          Nexon Open API 키
        </label>
        <div className="relative flex items-center">
          {/* 키는 손으로 치는 값이 아니라 붙여넣는 긴 문자열이라, 가려 두면 잘못 붙여넣었는지
              확인할 방법이 없다(실패해도 401 토스트만 뜬다). type 이 text 가 되는 구간이
              생기므로 자동 대문자·자동 수정을 함께 끈다 — 모바일 키보드가 첫 글자를 대문자로
              바꾸면 조용히 틀린 키가 된다. */}
          <input
            id="nexon-api-key"
            type={isRevealed ? 'text' : 'password'}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="발급받은 API 키를 입력하세요"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-[10px] bg-surface border border-border px-4 py-3 pr-11 text-text"
          />
          <button
            type="button"
            onClick={() => setIsRevealed((revealed) => !revealed)}
            aria-label={isRevealed ? '키 숨기기' : '키 표시'}
            className="absolute right-3 flex text-text-muted hover:text-text"
          >
            {isRevealed ? (
              <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" />
            ) : (
              <Eye className="h-[18px] w-[18px]" aria-hidden="true" />
            )}
          </button>
        </div>
        {/* 이미 키를 발급받은 사용자의 동선 — 인풋에 붙여 한 덩어리로 읽히게 한다. */}
        <a
          href="https://openapi.nexon.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 pt-0.5 text-xs text-primary-ink hover:text-primary-hover"
        >
          openapi.nexon.com에서 확인
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
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

      {/* 구분선이 두 사용자군을 가른다 — 주 CTA 바로 아래 같은 pill 이 하나 더 서는 위험을
          막는 것도 이 줄이다(색·크기 차이와 함께). */}
      <div className="flex items-center gap-2.5 text-xs text-text-muted">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        아직 API 키가 없나요?
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>

      <div className="space-y-1">
        {/* 외부 URL로 나가는 이동이라 <button> 이 아니라 <a> 다 — 링크 시맨틱을 유지한 채
            겉모습만 outline 변형을 입는다. */}
        <a
          href="https://mapleroutine.store/api-key"
          target="_blank"
          rel="noopener noreferrer"
          className={`${BUTTON_VARIANT_CLASS.outline} flex w-full items-center justify-center gap-1.5`}
        >
          API 키 발급 방법 보기
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
        {/* 무엇이 기다리는지 모른 채 앱을 떠나지 않게 한다. */}
        <p className="text-center text-xs text-text-muted">넥슨 오픈 API에서 키를 받는 7단계 안내</p>
      </div>
    </form>
  )
}
