import { useEffect } from 'react'
import { ArrowLeft, FileText } from 'lucide-react'
import packageJson from '../../../package.json'
import { RELEASE_NOTES } from '../../data/release-notes'
import { useLiveUpdateStore } from '../../features/live-update/store'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { Badge } from '../../components/atoms/Badge/Badge'
import { Card } from '../../components/atoms/Card/Card'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { useScreenNavigate } from '../../lib/use-screen-navigate'

// 설정 하위 페이지 「개발노트」(ADR-118 결정 2 · ADR-119) — 버전별 변경 목록.
//
// 골격은 `/settings/about`·`/settings/account-data` 와 같다: 공용 `ScreenScroll` + `PageHeader`
// (fixed + 실측 spacer) + `useScreenNavigate`.
//
// **데이터는 앱 번들 안에 있다**(ADR-119 결정 1) — `src/data/release-notes.ts` 를 그대로 읽으므로
// 네트워크 0회이고 오프라인에서도 과거 전체가 보인다. 그래서 이 화면에는 로딩·에러 상태가 없다.
// 원격 조회는 업데이트 모달의 몫이고 그쪽은 `latest.json` 을 쓴다(원천 하나 + 소비 둘).
//
// **배열을 정렬하지 않는다** — "최신이 먼저"는 데이터 파일의 계약이고 그 강제는 데이터 테스트가
// 한다. 화면이 다시 정렬하면 같은 규칙의 진실이 두 곳에 생긴다.
export function SettingsReleaseNotesScreen(): React.JSX.Element {
  const { currentVersion, loadCurrentVersion } = useLiveUpdateStore()
  // 화면을 통째로 바꾸는 이동은 이동 전에 스크롤을 최상단으로 옮긴다(ADR-098 결정 1).
  const navigateToScreen = useScreenNavigate()

  // 지금 실행 중인 OTA 번들 버전 — `SettingsScreen`·`AppUpdateSection` 과 같은 방식이다.
  // 이 화면 스스로 값을 채워야 다른 컴포넌트의 부수효과에 의존하지 않는다.
  useEffect(() => {
    void loadCurrentVersion()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 폴백까지 했는데도 일치하는 노트가 없으면 아무 배지도 붙지 않는다 — 1.0.2 이전 사용자는
  // 자기 버전이 목록에 없고(ADR-119 결정 4), 없는 것을 지어내지 않는다.
  const runningVersion = currentVersion ?? packageJson.version

  return (
    <ScreenScroll>
      <PageHeader>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigateToScreen('/settings')}
            aria-label="뒤로"
            className="p-1 -ml-1 text-text-muted hover:text-text"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
          <h1 className="text-lg font-semibold text-text">개발노트</h1>
        </div>
      </PageHeader>

      <div className="space-y-3 px-4 pb-4">
        {RELEASE_NOTES.length === 0 ? (
          // 지금은 도달할 수 없는 자리다(1.0.3 한 건이 있다) — 그래도 데이터가 비어도 화면이
          // 깨지지 않아야 한다. 목록 빈 상태라 컨텍스트 아이콘 + inline 크기(ADR-060).
          <EmptyState icon={FileText} title="아직 기록된 변경 내역이 없습니다" />
        ) : (
          RELEASE_NOTES.map((note) => (
            <Card key={note.version} data-testid="release-note" className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <span
                  data-testid="release-note-version"
                  className="text-sm font-semibold tabular-nums text-text"
                >
                  {note.version}
                </span>
                {note.version === runningVersion && <Badge tone="primary">사용 중</Badge>}
                <span className="ml-auto text-xs tabular-nums text-text-disabled">{note.date}</span>
              </div>

              <ul className="space-y-2">
                {note.items.map((item) => (
                  <li key={item.text} className="flex gap-2 text-sm text-text-muted">
                    <span aria-hidden="true" className="text-text-disabled">
                      ·
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p>{item.text}</p>
                      {/* ADR-119 결정 3: 표식은 버전이 아니라 이 항목에 붙는다. 톤은 스토어
                          이동을 말하는 다른 자리(UpdatePromptModal 의 store-required)와 같은
                          third 다. */}
                      {item.requiresStoreUpdate === true && (
                        <p>
                          <Badge tone="third">스토어 업데이트 필요</Badge>
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </div>
    </ScreenScroll>
  )
}
