import { useEffect, useState } from 'react'
import packageJson from '../../../package.json'
import { useThemeStore } from '../../features/theme/store'
import { useLiveUpdateStore } from '../../features/live-update/store'
import { useTrackingModeStore } from '../../features/tracking-mode/store'
import { TRACKING_MODE_LABELS } from '../../features/tracking-mode/copy'
import type { CacheDataSizes } from '../../features/settings/cache-data'
import { loadCacheDataSizes } from '../../features/settings/cache-data'
import { formatBytes } from '@core/lib/format-bytes'
import { Outlet, useNavigate } from 'react-router-dom'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { SettingsRow } from './SettingsRow'
import { ThemeModal } from './ThemeModal'
import { TrackingModeModal } from './TrackingModeModal'
import { Card } from '../../components/atoms/Card/Card'

type OpenModal = 'theme' | 'trackingMode' | null

// 설정 본화면 — 카드 둘 · 5행(ADR-118 결정 1).
//
// **위 카드는 값을 고르는 행**(모달이 뜨고, 고르면 그 자리에서 끝난다), **아래 카드는 화면이
// 넘어가는 행**(하위 페이지로 이동한다). 두 무리를 가르는 것은 카드 경계뿐이고 섹션 제목은 달지
// 않는다 — 두 무리를 덮는 제목(「동작·표시」류)은 행 이름보다 덜 구체적이라 읽는 사람이 얻는
// 것이 없다.
//
// **이 화면에는 고정 헤더(`PageHeader`)를 두지 않는다**([[ADR-098]] 결정 3). 그 ADR 이 단 재판단
// 조건은 *"행이 늘어 세로가 길어지면"* 인데, 이 개편은 행을 4 → 5 로 하나 늘리면서 섹션 둘과
// footer 한 줄을 하위 페이지로 내려보내 **순감**이라 조건에 걸리지 않는다.
export function SettingsScreen(): React.JSX.Element {
  const { theme } = useThemeStore()
  const { mode: trackingMode } = useTrackingModeStore()
  const { currentVersion, loadCurrentVersion } = useLiveUpdateStore()
  // 하위 페이지로 **미는** 이동이라 스크롤을 리셋하지 않는다([[ADR-120]] 폐기). 이 화면은 마운트된
  // 채 아래에 남으므로, 리셋하면 뒤로 왔을 때 보던 자리를 잃는다.
  const navigate = useNavigate()

  const [openModal, setOpenModal] = useState<OpenModal>(null)
  const [sizes, setSizes] = useState<CacheDataSizes | null>(null)

  // 하단 "앱 버전"과 `앱 정보` 행 대표값은 빌드 시점에 고정된 package.json 값이 아니라 지금 실제로
  // 실행 중인 OTA 번들 버전을 보여줘야 한다 — 그래야 OTA로 업데이트했을 때 이 숫자도 실제로
  // 올라간다. 이 화면 스스로도 독립적으로 값을 채워야 다른 컴포넌트의 부수효과에 의존하지 않는다.
  useEffect(() => {
    void loadCurrentVersion()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ADR-118 결정 5: `계정 및 데이터` 행의 대표값. 캐시 행이 한 층 내려가면서 그 값은 한 층
  // 올라와, 들어가지 않고도 안을 짐작하게 한다. 실패는 자리표시(`- KB`)로 남긴다.
  useEffect(() => {
    loadCacheDataSizes()
      .then(setSizes)
      .catch(() => {})
  }, [])

  const displayedVersion = currentVersion ?? packageJson.version
  // 행에 쓰는 총합은 그룹별 용량의 합으로 파생한다(ADR-058 결정 8).
  const totalCacheBytes = sizes === null ? null : sizes.general + sizes.bossRecords

  return (
    // [[ADR-120]] 딸림 작업: 이 화면도 자기 스크롤을 소유한다([[ADR-099]]). 문서 스크롤에 얹혀 있던
    // 마지막 탭 화면이었는데, 스택의 **아래 화면**이 되려면 스크롤이 이 DOM 요소에 붙어 있어야
    // 한다 — 그래야 하위 페이지를 열었다 닫아도 보던 자리가 그대로다.
    <>
      <ScreenScroll>
        {/* **안전영역을 이 블록이 직접 갖는다.** 이 화면에는 고정 헤더가 없어([[ADR-098]] 결정 3)
            `--sa-top` 을 넣어 줄 `PageHeader` 가 없고, `ScreenScroll` 안쪽 래퍼의
            `-mt-[var(--sa-top)]` 이 콘텐츠를 화면 y=0 으로 끌어올리므로 그냥 두면 제목이 노치
            아래에 깔린다(실기기 보고 2026-08-09, 계측 재현: 제목 top 16px, 기대 63px). */}
        <div className="space-y-4 px-4 pb-4 pt-[calc(1rem+var(--sa-top))]">
          <h1 className="text-lg font-semibold text-text">설정</h1>

          {/* 값을 고르는 행 — 배지(현재값) + chevron 병기(ADR-118 결정 4). */}
          <Card className="px-6 divide-y divide-border" data-testid="settings-card">
            <SettingsRow
              label="스케줄 관리 방법"
              onClick={() => setOpenModal('trackingMode')}
              rightContent={<ValueBadge>{TRACKING_MODE_LABELS[trackingMode]}</ValueBadge>}
            />
            <SettingsRow
              label="테마"
              onClick={() => setOpenModal('theme')}
              rightContent={<ValueBadge>{theme}</ValueBadge>}
            />
          </Card>

          {/* 화면이 넘어가는 행 — 대표값(있으면) + chevron. */}
          <Card className="px-6 divide-y divide-border" data-testid="settings-card">
            {/* 「기능 설명」이 「개발 노트」 위다([[ADR-125]] 결정 1 정정) — *"이 앱을 어떻게 쓰나"*
                가 *"무엇이 바뀌었나"* 보다 자주 묻는 질문이고, 설명의 원천도 이쪽이다.
                대표값을 비우는 것은 개발 노트와 같은 이유다(결정 5). */}
            <SettingsRow label="기능 설명" onClick={() => navigate('/settings/guide')} />
            {/* 대표값을 비운다(결정 5) — "최신 버전"은 아래 `앱 정보` 행과 같은 값이라 중복이고,
                "n개"는 개수가 늘어난다고 뜻이 생기지 않는다. 없는 대표값을 지어내지 않는다. */}
            <SettingsRow label="개발 노트" onClick={() => navigate('/settings/release-notes')} />
            <SettingsRow
              label="계정 및 데이터"
              onClick={() => navigate('/settings/account-data')}
              rightContent={
                // ADR-061 결정 7: 조회 전에도 값과 같은 폭·타이포로 자리를 잡는다.
                <SummaryValue>
                  {totalCacheBytes !== null ? formatBytes(totalCacheBytes) : '- KB'}
                </SummaryValue>
              }
            />
            <SettingsRow
              label="앱 정보"
              onClick={() => navigate('/settings/about')}
              rightContent={<SummaryValue>{displayedVersion}</SummaryValue>}
            />
          </Card>

          {/* 이용약관 제6조④가 요구하는 출처 표기 — 문구를 의역하지 않고 원문 그대로 노출한다 */}
          <div className="space-y-1 pt-4 text-center" data-testid="settings-footer">
            {/*
              ADR-118 결정 8: 이 블록은 전부 읽고 끝나는 정적 문구라 톤(text-text-disabled)이 균일하다 —
              눌러야 하는 것 하나가 한 단계 밝은 색·밑줄로 섞여 있던 예외는 /settings/about 의 행으로
              내려가면서 사라졌다.
            */}
            <p className="text-xs text-text-disabled">v{displayedVersion}</p>
            <p className="text-xs text-text-disabled">© {new Date().getFullYear()} 메이플 루틴</p>
            <p className="text-xs text-text-disabled">Data based on NEXON Open API</p>
            {/*
              비제휴 고지는 약관이 요구하는 것이 아니라 동종 서비스(maple.gg·chuchu.gg·maplescouter)의
              공통 관행이다 — 출처 표기만 있으면 넥슨 공식 서비스로 오인될 여지가 남는다. 문구도 그 3사와
              같은 영문 형태로 맞춘다(maple.gg "Maple.GG is not associated with NEXON Korea").
            */}
            <p className="text-xs text-text-disabled">
              Maple Routine is not associated with NEXON Korea
            </p>
          </div>
        </div>
      </ScreenScroll>

      {/* 모달은 스크롤 셸 **바깥**이다 — 안에 두면 그 `fixed` 셸이 만든 스태킹 컨텍스트에 `z-50`
          이 갇혀 `z-30` 탭바 아래로 그려진다(`ScreenScroll` 주석). */}
      {openModal === 'trackingMode' && <TrackingModeModal onClose={() => setOpenModal(null)} />}
      {openModal === 'theme' && <ThemeModal onClose={() => setOpenModal(null)} />}

      {/* 하위 페이지 넷이 이 자리에서 열린다([[ADR-120]] 결정 1) — 실제 DOM 은 `StackScreen` 이
          포털로 탭 레이어 밖에 붙인다(결정 3). */}
      <Outlet />
    </>
  )
}

/** 설정 행의 현재값 배지 — 값을 고르는 두 행이 공유한다. */
function ValueBadge(props: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted">
      {props.children}
    </span>
  )
}

/** 이동 행의 대표값 — 배지가 아니라 평문이다(고를 수 있는 값이 아니라 안을 미리 보여주는 값). */
function SummaryValue(props: { children: React.ReactNode }): React.JSX.Element {
  return <span className="text-sm text-text-muted tabular-nums">{props.children}</span>
}
