import { useState } from 'react'
import { ArrowLeft, BookOpen, ChevronRight } from 'lucide-react'
import { Outlet, useNavigate } from 'react-router-dom'
import {
  FEATURE_GUIDES,
  FEATURE_GUIDE_GROUP_LABELS,
  FEATURE_GUIDE_GROUP_ORDER,
} from '@core/data/feature-guides'
import type { FeatureGuideGroup } from '@core/types'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { StackScreen } from '../../components/templates/StackScreen/StackScreen'
import { Card } from '../../components/atoms/Card/Card'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { buildGuidePath } from '../../lib/guide-route'
import { useStackBack } from '../../lib/use-stack-back'

// 설정 하위 페이지 「기능 설명」([[ADR-125]] 결정 1 정정, 2026-08-10) — 앱 기능을 **기능 축**으로
// 나열한 카탈로그이고, 사용법 설명의 **원천**이다.
//
// 처음엔 이 화면이 없었다. 안내가 개발 노트 항목에 붙어 버전 축으로만 존재했는데, 그러면
// *"지금 이 앱을 어떻게 쓰나"* 에 답할 자리가 없다 — 오래된 기능이 옛 버전 카드 안에 묻힌다.
// 지금은 **여기가 원천이고 개발 노트는 링크만 건다**(같은 설명을 두 벌 두면 반드시 갈라진다).
//
// **탭은 하단 탭바와 같은 축**이다(사용자 지정) — 이미 아는 구획이라 안내를 찾을 때 새로 배울
// 것이 없다. `유틸리티` 만 그 축 밖이고 **지금은 비어 있어 탭이 뜨지 않는다.**
//
// 한 안내가 **여러 그룹에 설 수 있다** — 「캐릭터 관리」는 컨텐츠·보스가 같은 피커를 쓰므로 양쪽
// 탭에 같은 글로 선다. 사본을 두면 갈라진다.
//
// 골격은 `/settings/release-notes` 와 같다: 공용 `StackScreen` + `PageHeader`.

const PARENT_PATH = '/settings'
const SELF_PATH = '/settings/guide'

// 탭 토글은 `design-system.md` 「탭 토글」절 그대로다([[ADR-018]]) — **새 스타일을 만들지 않는다.**
const ACTIVE_TAB_CLASS =
  'rounded-full bg-primary-tint px-3 py-[5px] text-sm font-semibold text-primary-ink'
const INACTIVE_TAB_CLASS = 'px-3 py-[5px] text-sm font-medium text-text-muted'

export function SettingsFeatureGuideListScreen(): React.JSX.Element {
  const navigate = useNavigate()
  const goBack = useStackBack(PARENT_PATH)

  // **비어 있는 그룹은 탭째 감춘다**(개발 노트의 카테고리 묶음·`ThemeSelector` 와 같은 규칙) —
  // 빈 탭을 열면 아무것도 없는 화면을 만난다. 지금은 `유틸리티` 가 그렇다. 순서는 데이터가
  // 아니라 상수가 정한다.
  const groups = FEATURE_GUIDE_GROUP_ORDER.filter((group) =>
    FEATURE_GUIDES.some((guide) => guide.groups.includes(group)),
  )

  // 첫 탭이 기본이다. 그룹이 하나뿐이면 탭 줄 자체를 그리지 않으므로(고를 것이 없다) 이 값은
  // 그대로 그 하나로 남는다.
  const [selected, setSelected] = useState<FeatureGuideGroup | undefined>(() => groups[0])
  const active = selected !== undefined && groups.includes(selected) ? selected : groups[0]
  // 한 안내가 여러 그룹에 설 수 있다 — 「캐릭터 관리」는 컨텐츠·보스 양쪽 탭에 같은 글로 선다.
  const guides = FEATURE_GUIDES.filter(
    (guide) => active !== undefined && guide.groups.includes(active),
  )

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
          <h1 className="text-lg font-semibold text-text">기능 설명</h1>
        </div>
      </PageHeader>

      <div className="space-y-3 px-4 pb-4">
        {groups.length === 0 ? (
          // 지금은 도달할 수 없는 자리다(안내가 열한 벌 있다) — 그래도 데이터가 비어도 화면이
          // 깨지지 않아야 한다. 목록 빈 상태라 컨텍스트 아이콘 + inline 크기([[ADR-060]]).
          <EmptyState icon={BookOpen} title="아직 준비된 기능 설명이 없습니다" />
        ) : (
          <>
            {/* **선택지가 둘 이상일 때만** 탭 줄이 뜻을 갖는다 — 하나뿐이면 고를 것이 없다. */}
            {groups.length > 1 && (
              <div role="tablist" className="flex items-center gap-4">
                {groups.map((group) => (
                  <button
                    key={group}
                    type="button"
                    role="tab"
                    data-testid="guide-group-tab"
                    aria-selected={group === active}
                    onClick={() => {
                      setSelected(group)
                    }}
                    className={group === active ? ACTIVE_TAB_CLASS : INACTIVE_TAB_CLASS}
                  >
                    {FEATURE_GUIDE_GROUP_LABELS[group]}
                  </button>
                ))}
              </div>
            )}

            <Card className="divide-y divide-border">
              {guides.map((guide) => (
                <button
                  key={guide.id}
                  type="button"
                  data-testid="guide-row"
                  onClick={() => {
                    navigate(buildGuidePath(SELF_PATH, guide.id))
                  }}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left"
                >
                  <span
                    data-testid="guide-row-title"
                    className="min-w-0 flex-1 text-sm font-medium text-text"
                  >
                    {guide.title}
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-text-muted"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </Card>
          </>
        )}
      </div>

      {/* 상세가 이 화면 **위로** 밀려 들어온다 — 자식 라우트라 부모가 언마운트되지 않아야
          전환 중 아래 화면이 보인다. */}
      <Outlet />
    </StackScreen>
  )
}
