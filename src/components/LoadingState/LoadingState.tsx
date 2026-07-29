import { MapleSweepSpinner } from '../MapleSweepSpinner/MapleSweepSpinner'

// 셸 승계 카드([[ADR-061]] 결정 2) — 로딩이 끝나면 그 자리를 채울 카드와 같은 껍데기를 미리 그린다.
// 결과가 들어와도 배경이 바뀌지 않으므로, 스켈레톤을 도입하지 않고도 "자리를 미리 잡는" 효용을 얻는다.
//   page   — 스케줄러 3화면 콜드 스타트, 컨텐츠·보스 관리 화면 최초 진입(목록 자리 전체)
//   inline — 보스 수익 과거 기간 백필(카드 한 장 자리)
//
// 목록·카드가 들어올 자리에만 쓴다. 모달 안(캐릭터 관리 피커)이나 화면 전체 대기(온보딩 시드·예열)는
// 이미 자기 껍데기가 있거나 뒤에 카드가 오지 않으므로 카드 없이 스피너 + 문구만 둔다.
// 캐시가 남아 있는 재검증(SWR) 중에도 쓰지 않는다 — 기존 내용을 가리지 않는다([[ADR-016]]).

export interface LoadingStateProps {
  message: string
  size?: 'page' | 'inline'
}

export function LoadingState(props: LoadingStateProps): React.JSX.Element {
  const isPage = (props.size ?? 'inline') === 'page'

  return (
    <div
      data-testid="loading-state"
      role="status"
      aria-busy="true"
      className={`flex flex-col items-center justify-center gap-3 rounded-[14px] border border-border bg-surface p-6 text-center${
        isPage ? ' min-h-[132px]' : ''
      }`}
    >
      <MapleSweepSpinner size={isPage ? 32 : 24} className="text-primary" />
      <p className={isPage ? 'text-sm text-text-muted' : 'text-xs text-text-muted'}>{props.message}</p>
    </div>
  )
}
