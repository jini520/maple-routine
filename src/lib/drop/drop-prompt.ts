/**
 * 드롭 기록 시트 바닥의 확인 줄 문구.
 *
 * 고른 것이 몇이고 그중 몇을 정했나로 다섯 갈래다. 시트 안에 인라인으로 적으면 어느 갈래가
 * 무엇을 말하는지가 JSX 사이에 흩어진다.
 *
 * 제목은 **무슨 일이 일어났나**를 말하고 딸린 줄은 **남은 일**을 말한다.
 */
import { dropItemNameOf } from './drop-items'
import { subjectParticle } from './drop-history'
import type { RecordedDrop } from '../../types/drops'

export interface DropPrompt {
  /** 굵은 첫 줄. */
  title: string
  /** 그 아래 흐린 줄. 할 일이 없으면 셈만 적는다. */
  detail: string
}

/** 이름은 그 갈래에서 **가장 먼저 고른 것**이다. 이어 찍어도 안 갈아탄다. */
function nameOf(drop: RecordedDrop): string {
  return dropItemNameOf(drop.itemKey, drop.itemName)
}

export function dropPromptOf(selected: readonly RecordedDrop[]): DropPrompt | null {
  if (selected.length === 0) return null

  const unpriced = selected.filter((drop) => drop.priceState === undefined)
  const entered = selected.filter((drop) => drop.priceState === 'entered')
  const excluded = selected.filter((drop) => drop.priceState === 'excluded')

  // 다 정했다. 남은 일이 없으므로 딸린 줄은 셈이다.
  if (unpriced.length === 0) {
    const counts = [
      entered.length > 0 ? `가격 입력 ${entered.length}건` : null,
      excluded.length > 0 ? `기록 안함 ${excluded.length}건` : null,
    ].filter((part) => part !== null)
    return { title: '모든 아이템의 가격을 입력했습니다', detail: counts.join(' · ') }
  }

  // 아직 하나도 안 매겼다. 고른 것을 세어 부른다.
  if (entered.length === 0) {
    const 이름 = nameOf(unpriced[0])
    return {
      title:
        unpriced.length === 1
          ? `${이름}${subjectParticle(이름)} 선택되었습니다`
          : `${이름} 외 ${unpriced.length - 1}건이 선택되었습니다`,
      detail: '판매 가격을 입력할까요?',
    }
  }

  // 일부만 매겼다. 제목은 **매긴 것**을 세고 딸린 줄이 남은 것을 센다.
  const 이름 = nameOf(entered[0])
  return {
    title:
      entered.length === 1
        ? `${이름}의 가격을 입력했습니다`
        : `${이름} 외 ${entered.length - 1}건의 가격을 입력했습니다`,
    detail: `미입력 ${unpriced.length}건 · 판매 가격을 입력할까요?`,
  }
}
