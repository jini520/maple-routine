import { ArrowLeft } from 'lucide-react'
import { Navigate, useParams } from 'react-router-dom'
import { findReleaseNoteGuide } from '../../data/release-note-guides'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { StackScreen } from '../../components/templates/StackScreen/StackScreen'
import { useStackBack } from '../../lib/use-stack-back'

// 개발 노트 하위 페이지 「기능 안내」([[ADR-125]]) — 그 기능이 어디 있고 어떻게 쓰는지.
//
// 골격은 다른 하위 페이지와 같다: 공용 `StackScreen`(오버레이 + 푸시/팝 + 스와이프 백) +
// `PageHeader`(fixed + 실측 spacer). 부모가 `/settings` 가 아니라 `/settings/release-notes` 인 것은
// **개발 노트 항목에서 열리기 때문**이다 — `/settings/about/privacy` 에 이은 두 번째 2단 스택이다.
//
// **데이터는 앱 번들 안에 있다**([[ADR-125]] 결정 4) — 글도 이미지도 `src/` 에서 온다. 그래서 이
// 화면에는 로딩·에러·오프라인 상태가 없다.
//
// `:guideId` 는 **버전이 아니라 항목 식별자**다(결정 3). 한 버전에 안내를 가진 항목이 여럿일 수 있고,
// 딥링크가 가리켜야 하는 것은 "그 버전"이 아니라 "그 기능"이다.

const PARENT_PATH = '/settings/release-notes'

export function SettingsFeatureGuideScreen(): React.JSX.Element {
  const { guideId } = useParams()
  const goBack = useStackBack(PARENT_PATH)
  const guide = guideId === undefined ? undefined : findReleaseNoteGuide(guideId)

  // 옛 딥링크·오타의 착지점이 빈 화면이면 안 된다. 히스토리에 남겨 뒤로가기가 다시 그리로 가게 둘
  // 이유도 없으므로 push 가 아니라 **replace** 다([[ADR-125]] 결정 3).
  if (guide === undefined) {
    return <Navigate to={PARENT_PATH} replace />
  }

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
          <h1 className="min-w-0 truncate text-lg font-semibold text-text">{guide.title}</h1>
        </div>
      </PageHeader>

      {/* 블록을 **데이터 순서 그대로** 쌓는다 — 이미지만·문단만·둘 다가 모두 정상이고([[ADR-125]]
          결정 6), 화면이 다시 배열하지 않는다. */}
      <div className="space-y-5 px-4 pb-6">
        {guide.blocks.map((block, index) => (
          <div key={index} data-testid="guide-block" className="space-y-2">
            {block.image !== undefined && (
              // 대체 텍스트는 타입이 강제한다(`ReleaseNoteGuideImage`) — 안내 화면에서 이미지는
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
