import { ArrowLeft } from 'lucide-react'
import { Outlet, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { StackScreen } from '../../components/templates/StackScreen/StackScreen'
import { Card } from '../../components/atoms/Card/Card'
import { useStackBack } from '../../lib/use-stack-back'
import { AppUpdateSection } from './AppUpdateSection'
import { SettingsRow } from './SettingsRow'

// 설정 하위 페이지 「앱 정보」(ADR-118 결정 2) — 현재 버전·상태·업데이트 확인 + 개인정보 처리방침.
//
// 골격은 새로 만들지 않고 `/boss/manage`·`/content/manage` 와 같은 것을 쓴다(ADR-035 결정 18):
// 공용 `StackScreen`(오버레이 + 푸시/팝 + 스와이프 백) + `PageHeader`(fixed + 실측 spacer). 그 셸은
// ADR-085·ADR-099·ADR-112 가 실기기에서 여러 번 틀린 끝에 얻은 것이라 다시 짤 이유가 없다.
// 부모 탭 — 딥링크로 이 화면에 직접 들어왔을 때 뒤로가 갈 곳([[ADR-120]] 결정 9).
const PARENT_PATH = '/settings'

export function SettingsAboutScreen(): React.JSX.Element {
  // 뒤로는 진짜 pop 이다(ADR-120 결정 9) — 앞으로 새 라우트를 밀어 넣지 않는다.
  const goBack = useStackBack(PARENT_PATH)
  const navigate = useNavigate()

  return (
    <StackScreen parentPath={PARENT_PATH}>
      <PageHeader>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goBack}
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
          사이에서 이 화면의 행으로 내려왔다(ADR-118 결정 7).

          **앱을 벗어나지 않는다**([[ADR-120]] 결정 11) — 외부 브라우저로 나가던 것을 앱 안
          화면으로 바꿨다. 사본을 만드는 것이 아니라 같은 사이트를 `iframe` 으로 실을 뿐이라,
          "법적 문서를 두 벌로 만들지 않는다"는 원칙은 그대로다. 그래서 링크 행이 아니라
          **하위 페이지로 미는 행**이고, 이 앱에서 유일하게 2단이 되는 스택이다.
        */}
        <Card className="px-6">
          <SettingsRow label="개인정보 처리방침" onClick={() => navigate('/settings/about/privacy')} />
        </Card>
      </div>

      {/* 처방침이 이 자리에서 열린다 — DOM 은 `StackScreen` 이 포털로 붙인다([[ADR-120]] 결정 3). */}
      <Outlet />
    </StackScreen>
  )
}
