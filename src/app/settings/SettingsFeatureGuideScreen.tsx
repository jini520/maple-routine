import { useEffect, useRef } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { findFeatureGuide } from '@core/data/feature-guides'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { StackScreen } from '../../components/templates/StackScreen/StackScreen'
import { GUIDE_SECTION_PARAM } from '../../lib/guide-route'
import { resolveParentPath } from '../../lib/stack-transition'
import { useStackBack } from '../../lib/use-stack-back'

// 기능 사용법 안내 상세([[ADR-125]]) — 그 기능이 어디 있고 어떻게 쓰는지.
//
// 골격은 다른 하위 페이지와 같다: 공용 `StackScreen`(오버레이 + 푸시/팝 + 스와이프 백) +
// `PageHeader`(fixed + 실측 spacer).
//
// **이 화면은 두 부모 아래 각각 라우팅된다**(결정 3 정정):
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
// **마디(`?s=`)는 경로가 아니라 쿼리다**(결정 7). 세그먼트로 만들면 `resolveStackDirection` 이
// 스택 한 단이 더 쌓인 것으로 읽어 목차를 누를 때마다 화면이 밀려 들어온다 — 같은 화면 안의
// 이동이므로 스택은 움직이면 안 된다.
//
// **데이터는 앱 번들 안에 있다**(결정 4) — 글도 이미지도 `src/` 에서 온다. 그래서 이 화면에는
// 로딩·에러·오프라인 상태가 없다.

function sectionDomId(guideId: string, sectionId: string): string {
  return `guide-${guideId}-${sectionId}`
}

export function SettingsFeatureGuideScreen(): React.JSX.Element {
  const { guideId } = useParams()
  const { pathname } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  // `/settings/guide/x` → `/settings/guide` · `/settings/release-notes/x` → `/settings/release-notes`
  const parentPath = resolveParentPath(pathname)
  const goBack = useStackBack(parentPath)
  const guide = guideId === undefined ? undefined : findFeatureGuide(guideId)

  const requestedSection = searchParams.get(GUIDE_SECTION_PARAM)
  // 한 번 스크롤한 뒤에는 다시 하지 않는다 — 목차를 눌러 다른 마디로 옮겨 놓고도 이 효과가
  // 또 돌면 처음 마디로 되끌려 간다.
  const scrolledTo = useRef<string | null>(null)

  useEffect(() => {
    if (guide === undefined || requestedSection === null) return
    if (scrolledTo.current === requestedSection) return
    const target = document.getElementById(sectionDomId(guide.id, requestedSection))
    if (target === null) return
    scrolledTo.current = requestedSection
    // 즉시(`smooth` 아님) — 밀려 들어오는 전환과 부드러운 스크롤이 겹치면 둘 다 어그러진다.
    // 들어온 순간 이미 그 마디에 서 있는 편이 낫다.
    target.scrollIntoView({ block: 'start' })
  }, [guide, requestedSection])

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

      <div className="space-y-5 px-4 pb-6">
        {/* 목차. **마디가 둘 이상일 때만** 뜻이 있다 — 하나뿐이면 아래 소제목과 같은 말을 두 번
            하는 것이다. 누르면 스택을 건드리지 않고 `?s=` 만 갈아 끼워(replace) 그 자리로 간다. */}
        {guide.sections.length > 1 && (
          // **카드 껍데기를 두르지 않는다**(사용자 지정, 2026-08-11) — 아래가 전부 같은 글이라
          // 목차만 상자에 담기면 본문이 아니라 위젯으로 읽힌다. 제목 + 번호 목록으로 충분하다.
          // 묶음 제목의 생김새는 개발 노트의 카테고리 제목과 같다.
          <nav aria-labelledby="guide-toc-heading" className="space-y-1.5">
            <p id="guide-toc-heading" className="text-xs font-semibold text-text-muted">
              목차
            </p>
            <ol className="space-y-1">
              {guide.sections.map((section, index) => (
                <li key={section.id} className="flex gap-1.5 text-sm">
                  {/* 번호는 **버튼 밖**이다 — 안에 넣으면 누를 수 있는 이름이 "1. 제목"이 되고,
                      `<ol>` 이 이미 순서를 읽어 주므로 화면 낭독에는 중복이다. */}
                  <span aria-hidden="true" className="tabular-nums text-text-disabled">
                    {index + 1}.
                  </span>
                  <button
                    type="button"
                    data-testid="guide-toc-item"
                    onClick={() => {
                      scrolledTo.current = null
                      setSearchParams({ [GUIDE_SECTION_PARAM]: section.id }, { replace: true })
                    }}
                    className="min-w-0 flex-1 text-left text-primary-ink"
                  >
                    {section.title}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* 마디도 그 안의 블록도 **데이터 순서 그대로** 쌓는다 — 이미지만·문단만·둘 다가 모두
            정상이고([[ADR-125]] 결정 6), 화면이 다시 배열하지 않는다. */}
        {guide.sections.map((section) => (
          <section
            key={section.id}
            id={sectionDomId(guide.id, section.id)}
            data-testid="guide-section"
            className="scroll-mt-4 space-y-2"
          >
            <h2 className="text-base font-semibold text-text">{section.title}</h2>
            {section.blocks.map((block, index) => (
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
          </section>
        ))}
      </div>
    </StackScreen>
  )
}
