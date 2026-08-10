import { ArrowLeft } from 'lucide-react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { findFeatureGuide } from '../../data/feature-guides'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { StackScreen } from '../../components/templates/StackScreen/StackScreen'
import { resolveParentPath } from '../../lib/stack-transition'
import { useStackBack } from '../../lib/use-stack-back'

// 기능 사용법 안내 상세([[ADR-125]]) — 그 기능이 어디 있고 어떻게 쓰는지.
//
// 골격은 다른 하위 페이지와 같다: 공용 `StackScreen`(오버레이 + 푸시/팝 + 스와이프 백) +
// `PageHeader`(fixed + 실측 spacer).
//
// **이 화면은 두 부모 아래 각각 라우팅된다**(결정 3 정정, 2026-08-10):
//
//     /settings/guide/:guideId          기능 설명 목록에서
//     /settings/release-notes/:guideId  개발 노트 항목에서
//
// 한쪽으로 몰고 다른 쪽에서 그리로 보내는 방법은 **쓸 수 없다.** `resolveStackDirection`
// (`lib/stack-transition.ts`)이 push/pop 을 **경로의 접두 관계**로 판정하는데, `/settings/release-notes`
// 에서 `/settings/guide/x` 로 가면 서로 접두가 아니라 `replace` 로 떨어져 **밀려 들어오는 전환이
// 사라진다.** 라우트를 둘 두면 양쪽 모두 자기 부모의 자식이라 정상적인 push 다.
//
// 화면과 데이터는 한 벌이고 **경로만 둘**이다 — 그래서 부모를 상수로 박지 않고 **현재 경로에서
// 깎아** 쓴다. 어디서 왔든 그리로 돌아가야 하고(개발 노트에서 들어왔는데 기능 설명 목록으로 튀면
// 읽던 자리를 잃는다), 딥링크 폴백도 같은 값이어야 한다.
//
// **데이터는 앱 번들 안에 있다**(결정 4) — 글도 이미지도 `src/` 에서 온다. 그래서 이 화면에는
// 로딩·에러·오프라인 상태가 없다.

export function SettingsFeatureGuideScreen(): React.JSX.Element {
  const { guideId } = useParams()
  const { pathname } = useLocation()
  // `/settings/guide/x` → `/settings/guide` · `/settings/release-notes/x` → `/settings/release-notes`
  const parentPath = resolveParentPath(pathname)
  const goBack = useStackBack(parentPath)
  const guide = guideId === undefined ? undefined : findFeatureGuide(guideId)

  // 옛 딥링크·오타의 착지점이 빈 화면이면 안 된다. 히스토리에 남겨 뒤로가기가 다시 그리로 가게 둘
  // 이유도 없으므로 push 가 아니라 **replace** 다([[ADR-125]] 결정 3).
  if (guide === undefined) {
    return <Navigate to={parentPath} replace />
  }

  return (
    <StackScreen parentPath={parentPath}>
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
          <h1 className="min-w-0 truncate text-lg font-semibold text-text">{guide.title}</h1>
        </div>
      </PageHeader>

      {/* 블록을 **데이터 순서 그대로** 쌓는다 — 이미지만·문단만·둘 다가 모두 정상이고([[ADR-125]]
          결정 6), 화면이 다시 배열하지 않는다. */}
      <div className="space-y-5 px-4 pb-6">
        {guide.blocks.map((block, index) => (
          <div key={index} data-testid="guide-block" className="space-y-2">
            {block.image !== undefined && (
              // 대체 텍스트는 타입이 강제한다(`FeatureGuideImage`) — 안내 화면에서 이미지는
              // 장식이 아니라 정보를 나른다.
              <img
                src={block.image.src}
                alt={block.image.alt}
                className="w-full rounded-[14px] border border-border"
              />
            )}
            {block.text !== undefined && (
              <p className="text-sm leading-relaxed text-text-muted">{block.text}</p>
            )}
          </div>
        ))}
      </div>
    </StackScreen>
  )
}
