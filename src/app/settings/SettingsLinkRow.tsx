import { ExternalLink } from 'lucide-react'
import { SETTINGS_ROW_CLASS } from './row-class'

export interface SettingsLinkRowProps {
  label: string
  href: string
}

// 앱을 떠나 시스템 브라우저로 가는 행(ADR-118 결정 4 의 "외부 링크 행", 결정 7).
//
// `SettingsRow` 와 골격은 같지만 `<button>` 이 아니라 `<a>` 인 것이 요점이다 — 시맨틱이
// 달라서 한 컴포넌트로 합치지 않는다(합치면 `onClick` 이 선택 필드가 되어 호출부에서 어느
// 쪽인지 타입으로 알 수 없다). 오른쪽 표식도 chevron 이 아니다: chevron 을 쓰면 다른 이동
// 행과 같은 약속을 하고는 다른 일을 한다.
//
// 여는 방식은 `ApiKeyForm` 의 넥슨 링크와 같고 별도 브라우저 플러그인을 들이지 않는다.
// `rel` 을 빼지 말 것 — 하이브리드 앱이라 새 컨텍스트가 `window.opener` 로 원래 문서를
// 만질 수 있으면 안 된다.
export function SettingsLinkRow(props: SettingsLinkRowProps): React.JSX.Element {
  return (
    <a
      href={props.href}
      target="_blank"
      rel="noopener noreferrer"
      className={SETTINGS_ROW_CLASS}
    >
      <span className="text-sm font-medium text-text">{props.label}</span>
      <ExternalLink
        data-testid="settings-row-external"
        className="h-4 w-4 text-text-muted"
        strokeWidth={2}
      />
    </a>
  )
}
