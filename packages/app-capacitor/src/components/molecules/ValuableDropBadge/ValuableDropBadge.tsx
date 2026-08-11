import { Sparkles } from 'lucide-react'
import { getItemIconUrl } from '@core/lib/item-icons'
import type { RecordedDrop } from '@core/types/drops'

// 실제 획득한 고가 아이템 아이콘(최대 3개 + 나머지 개수)을 골드 반짝임 칩으로 보여준다([[ADR-045]]).
// 배치·라벨은 호출부가 정한다([[ADR-046]]) — 캐릭터 카드는 우상단 절대배치(overflow-hidden에 잘리지
// 않도록 카드 바깥 relative 래퍼에 붙인다), 총 수익 헤드라인은 라벨행 우측 인라인, 드롭 히스토리는
// 미획득 기간 요약 줄 안([[ADR-071]] 결정 4). **외형·아이콘 스택 규칙은 이 단일 구현이 전부다** —
// 세 화면이 쓰므로 화면 파일이 아니라 여기 산다.
export function ValuableDropBadge(props: {
  drops: RecordedDrop[]
  label: string
  className?: string
}): React.JSX.Element {
  const shown = props.drops.slice(0, 3)
  const extra = props.drops.length - shown.length

  return (
    <span
      role="img"
      aria-label={props.label}
      title="고가 아이템 드롭"
      className={`valuable-drop-badge flex flex-none items-center gap-1 rounded-full py-0.5 pl-1.5 pr-2${
        props.className !== undefined ? ` ${props.className}` : ''
      }`}
    >
      <Sparkles className="h-3 w-3 flex-none" strokeWidth={2.5} aria-hidden="true" />
      <span className="flex items-center">
        {shown.map((drop, index) => {
          const url = getItemIconUrl(drop.itemName, drop.slot)
          const stackStyle = { marginLeft: index === 0 ? 0 : -6, zIndex: shown.length - index }
          return url !== null ? (
            <img
              key={`${drop.itemName}-${index}`}
              src={url}
              alt=""
              className="relative h-5 w-5 flex-none rounded-full bg-surface object-contain ring-[1.5px] ring-white/80"
              style={stackStyle}
            />
          ) : (
            <span
              key={`${drop.itemName}-${index}`}
              className="relative h-5 w-5 flex-none rounded-full bg-surface-2 ring-[1.5px] ring-white/80"
              style={stackStyle}
            />
          )
        })}
      </span>
      {extra > 0 && <span className="text-[10px] font-bold leading-none tabular-nums">+{extra}</span>}
    </span>
  )
}
