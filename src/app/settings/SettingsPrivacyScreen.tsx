import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { StackScreen } from '../../components/templates/StackScreen/StackScreen'
import { ErrorState } from '../../components/molecules/ErrorState/ErrorState'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { useStackBack } from '../../lib/use-stack-back'

// 설정 하위 페이지 「개인정보 처리방침」([[ADR-120]] 결정 11) — **사이트를 그대로 싣는다.**
//
// 지금까지는 외부 브라우저로 나갔다([[ADR-118]] 결정 7). 그 결정이 지키려던 것은 "법적 문서를
// 두 벌로 만들지 않는다"였고, **그건 그대로 지켜진다** — `PRIVACY.md` 는 여전히 저장소 루트의
// 단일 원본이고 사이트가 그것을 렌더링하며, 이 화면은 그 사이트를 보여줄 뿐 사본을 두지 않는다.
// 바뀐 것은 "앱을 벗어나느냐"뿐이다.
//
// **`iframe` 이 성립하는 근거**: GitHub Pages 는 `X-Frame-Options`·CSP `frame-ancestors` 를 보내지
// 않는다(응답 헤더 확인 2026-08-08). **이 사실에 의존한다** — 헤더가 생기면 이 화면이 빈다.
//
// **대가는 오프라인이다.** 사본을 두는 선택(기각)은 오프라인에서 뜨지만 OTA 지연만큼 사이트와
// 어긋난 법적 문서가 된다 — 어긋난 처방침이 안 보이는 처방침보다 나쁘다고 봤다. 대신 실패를
// 감지해 "브라우저로 열기"를 준다.
//
// 부모가 `/settings` 가 아니라 `/settings/about` 인 것은 그 화면의 행에서 열리기 때문이다 —
// 이 앱에서 유일하게 2단인 스택이다.

const PARENT_PATH = '/settings/about'
export const PRIVACY_URL = 'https://mapleroutine.store/privacy'

// 이만큼 기다려도 `load` 가 오지 않으면 실패로 본다. 교차 출처 `iframe` 은 네트워크 실패에
// `error` 를 신뢰성 있게 발화하지 않으므로, 시간이 유일한 신호다.
const LOAD_TIMEOUT_MS = 8000

type LoadStatus = 'loading' | 'loaded' | 'failed'

export function SettingsPrivacyScreen(): React.JSX.Element {
  const goBack = useStackBack(PARENT_PATH)
  // 오프라인인 것이 이미 확실하면 8초를 기다리게 하지 않는다.
  const [status, setStatus] = useState<LoadStatus>(() =>
    typeof navigator !== 'undefined' && navigator.onLine === false ? 'failed' : 'loading',
  )

  useEffect(() => {
    if (status !== 'loading') return
    const timer = window.setTimeout(() => {
      setStatus('failed')
    }, LOAD_TIMEOUT_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [status])

  return (
    <StackScreen parentPath={PARENT_PATH} scroll={false}>
      {/* 화면이 뷰포트를 꽉 채우고 `iframe` 이 자기 스크롤을 갖는다 — 그래서 셸의 스크롤 상자를
          쓰지 않고(`scroll={false}`) 안전영역도 여기서 직접 비운다. 하단은 `iframe` 안쪽 문서에
          우리가 여백을 넣을 수 없으므로 **상자 자체를 홈 인디케이터 위에서 끝낸다**. */}
      <div className="flex h-full flex-col pt-[var(--sa-top)] pb-[var(--sa-bottom)]">
        <header className="flex items-center gap-2 px-4 pb-2 pt-4">
          <button
            type="button"
            onClick={goBack}
            aria-label="뒤로"
            className="-ml-1 p-1 text-text-muted hover:text-text"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
          <h1 className="text-lg font-semibold text-text">개인정보 처리방침</h1>
        </header>

        <div className="relative flex-1">
          {status === 'failed' ? (
            <div className="p-4">
              <ErrorState
                title="처리방침을 불러오지 못했습니다"
                description="인터넷에 연결한 뒤 다시 열어 주세요. 브라우저에서도 볼 수 있습니다."
                action={{
                  label: '브라우저로 열기',
                  // 실패의 원인을 실제로 푸는 행동이다([[ADR-062]] 결정 3) — 여기서 안 되는 것을
                  // 되는 곳으로 보낸다. "다시 시도"는 오프라인에서 같은 실패를 반복할 뿐이다.
                  onClick: () => window.open(PRIVACY_URL, '_blank', 'noopener'),
                }}
              />
            </div>
          ) : (
            <>
              {status === 'loading' && (
                <div className="absolute inset-0 grid place-items-center">
                  <LoadingState message="불러오는 중" size="page" />
                </div>
              )}
              <iframe
                title="개인정보 처리방침"
                data-testid="privacy-frame"
                src={PRIVACY_URL}
                onLoad={() => {
                  setStatus('loaded')
                }}
                className="absolute inset-0 h-full w-full border-0"
                style={{ opacity: status === 'loaded' ? 1 : 0 }}
              />
            </>
          )}
        </div>
      </div>
    </StackScreen>
  )
}
