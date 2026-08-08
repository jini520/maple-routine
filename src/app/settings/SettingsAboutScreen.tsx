import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { Card } from '../../components/atoms/Card/Card'
import { useScreenNavigate } from '../../lib/use-screen-navigate'
import { AppUpdateSection } from './AppUpdateSection'
import { SettingsLinkRow } from './SettingsLinkRow'

// 설정 하위 페이지 「앱 정보」(ADR-118 결정 2) — 현재 버전·상태·업데이트 확인 + 개인정보 처리방침.
//
// 골격은 새로 만들지 않고 `/boss/manage`·`/content/manage` 와 같은 것을 쓴다(ADR-035 결정 18):
// 공용 `ScreenScroll` + `PageHeader`(fixed + 실측 spacer) + `useScreenNavigate`. 그 셸은
// ADR-085·ADR-099·ADR-112 가 실기기에서 여러 번 틀린 끝에 얻은 것이라 다시 짤 이유가 없다.
export function SettingsAboutScreen(): React.JSX.Element {
  // 화면을 통째로 바꾸는 이동은 이동 전에 스크롤을 최상단으로 옮긴다(ADR-098 결정 1).
  const navigateToScreen = useScreenNavigate()

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
          <h1 className="text-lg font-semibold text-text">앱 정보</h1>
        </div>
      </PageHeader>

      <div className="space-y-4 px-4 pb-4">
        <AppUpdateSection />

        {/*
          Play 사용자 데이터 정책은 스토어 등록정보와 앱 안 양쪽에 개인정보 처리방침 링크를
          요구한다 — 콘솔에 URL을 넣는 것만으로는 충족되지 않는다(docs/foundation/release.md).
          다만 요구하는 것은 "앱 안에 링크"이지 "첫 화면에 링크"가 아니라, 설정 고지 문구
          사이에서 이 화면의 행으로 내려왔다(ADR-118 결정 7). 본문은 앱에 사본을 두지 않고
          PRIVACY.md 를 렌더링한 사이트로 보낸다 — 법적 문서를 두 벌로 만들지 않는다.
        */}
        <Card className="px-6">
          <SettingsLinkRow label="개인정보 처리방침" href="https://mapleroutine.store/privacy" />
        </Card>
      </div>
    </ScreenScroll>
  )
}
