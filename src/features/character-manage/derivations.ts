/**
 * 캐릭터 관리 화면이 **직접 계산하면 안 되는 파생값** 셋.
 *
 * 화면은 그리기만 하고 값 규칙은 여기가 갖는다. 그래야 월드는 둘까지 나 모르면 비운다 같은
 * 규칙을 테스트가 직접 물 수 있다.
 *
 * **순수 함수만 산다.** 저장소·네트워크를 부르지 않고 입력을 전부 인자로 받는다(캐시 조회·로스터
 * 조회는 호출부의 일이다). 여기서 조회를 하면 값 규칙을 검사하려고 포트를 목으로 세워야 한다.
 */

import type { MapleAccount, MapleCharacter } from '../../types'
import { compareByName, pickRepresentativeCharacter } from '../onboarding/representative-character'

/** 월드는 **많은 순으로 둘까지**만 적는다. 셋째부터는 적지 않는다. */
const MAX_LISTED_WORLDS = 2

/** 메이플 ID 드롭다운 한 행이 쓰는 값. */
export interface AccountSummaryView {
  accountId: string
  /** 1줄에 서는 캐릭터. `character/list` 기준이라 조회 0회다. */
  representative: MapleCharacter
  /** 2줄의 스카니아 19개, 엘리시움 7개. 많은 순, **최대 둘**. */
  worldCounts: Array<{ world: string; count: number }>
  characterCount: number
}

/**
 * 계정 하나를 드롭다운 행이 쓰는 값으로 접는다.
 *
 * **캐릭터가 0명이면 `null`**. 그 계정은 애초에 오지 않지만(이
 * `normalizeCharacterList` 에서 거른다) 여기서 던지면 화면이 렌더 중에 죽는다. 그게 정확히
 *  이 고친 사고라, 호출부가 걸러낼 수 있는 값을 돌려준다. 대표 캐릭터가 없는
 * `AccountSummaryView` 는 만들지 않는다. 그 행은 세울 수 없는 행이다.
 */
export function summarizeAccount(account: MapleAccount): AccountSummaryView | null {
  if (account.characters.length === 0) {
    return null
  }

  const countByWorld = new Map<string, number>()
  for (const character of account.characters) {
    countByWorld.set(character.world, (countByWorld.get(character.world) ?? 0) + 1)
  }

  // 동수일 때 입력 순서를 따르면 같은 계정이 열 때마다 다르게 보인다. 이름순으로 못박는다.
  const worldCounts = Array.from(countByWorld, ([world, count]) => ({ world, count }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : compareByName(a.world, b.world)))
    .slice(0, MAX_LISTED_WORLDS)

  return {
    accountId: account.accountId,
    representative: pickRepresentativeCharacter(account.characters),
    worldCounts,
    characterCount: account.characters.length,
  }
}

/**
 * 드롭다운 목록의 차례 — **대표 캐릭터의 레벨이 높은 계정이 먼저**다(사용자 지정 2026-08-17).
 *
 * 계정 자체에는 어느 것이 주력인가 를 말하는 값이 없다(`accountId` 는 불투명 문자열이고 응답 순서는
 * 넥슨이 정한다). 그 자리에서 사람이 실제로 쓰는 기준이 **가장 높은 캐릭터**라, 그것으로 세운다 —
 * 대표는 이미 각 계정의 최고 레벨이므로(`summarizeAccount`) 새로 셀 것도 없다.
 *
 * 동레벨이면 대표 **이름순**이다. 응답 순서를 따르면 같은 키로 열 때마다 차례가 달라 보인다.
 * 이 순서는 **첫 계정 선택에도 그대로 걸린다**. 화면이 목록의 첫 항목을 연다.
 */
export function sortAccountSummaries(summaries: AccountSummaryView[]): AccountSummaryView[] {
  return [...summaries].sort((a, b) =>
    b.representative.level !== a.representative.level
      ? b.representative.level - a.representative.level
      : compareByName(a.representative.name, b.representative.name),
  )
}

/** 선택됨 층의 행 하나 — 네트워크 없이 로컬 캐시로만 그린다. */
export interface SelectedCharacterView {
  ocid: string
  /** 캐시가 없으면 빈 문자열이다. 자리표시자 문구를 지어내지 않는다. */
  name: string
  level: number | null
  jobClass?: string
  world?: string
  imageUrl: string | null
  /** 조회 불가. 그래도 **목록에 남는다**. 해제할 자리가 여기뿐이다. */
  unavailable: boolean
}

/**
 * 선택됨 층이 **실제로 읽는 필드만**.
 *
 * `CharacterBasicProfile` 을 그대로 요구하지 않는 이유는 출처가 둘이 됐기 때문이다. 로컬 캐시와
 * **지금 열린 계정의 로스터**. 로스터 항목은 얼굴을 아직 모를 수 있어(`imageUrl: null`) 그 타입에
 * 안 맞고, `accessFlag` 처럼 이 함수가 한 번도 안 읽는 필드를 억지로 지어내게 만든다.
 */
export interface KnownCharacterProfile {
  name: string
  level: number
  imageUrl: string | null
  world?: string
  jobClass?: string
}

/**
 * 추적 목록을 선택됨 층의 행들로 편다.
 *
 * - **순서는 `orderedOcids` 그대로**다(저장 순서가 곧 표시 순서다).
 *   레벨로 다시 정렬하지 않는다.
 * - **모르면 모르는 채로 둔다**. 레벨 `null`, 직업·월드 없음, 얼굴 `null`. 화면이 그 자리를
 *  비운다(: 모르는 사실을 그리는 프레임을 만들지 않는다).
 * - **조회 불가 캐릭터도 빠지지 않는다**. 빼면 그 ocid 를 해제할 방법이
 *   없다. 값이 남아 있으면 그대로 쓰고, 플래그만 얹는다.
 *
 * **프로필을 받지 **캐시 엔트리** 를 받지 않는다**. 이 함수는 `cachedAt` 을 한
 * 번도 읽지 않았고, 엔트리를 요구하면 캐시 말고 다른 출처 를 넘기려는 호출부가 **언제 캐싱됐는지를
 * 지어내야** 한다. 그 정정이 로스터 응답을 이 자리로 흘리면서 실제로 그 요구가 생겼다.
 */
export function buildSelectedCharacterViews(
  orderedOcids: string[],
  profiles: Map<string, KnownCharacterProfile | null>,
  unavailableOcids: ReadonlySet<string>,
): SelectedCharacterView[] {
  return orderedOcids.map((ocid) => {
    const profile = profiles.get(ocid) ?? null

    return {
      ocid,
      name: profile?.name ?? '',
      level: profile?.level ?? null,
      jobClass: profile?.jobClass,
      world: profile?.world,
      imageUrl: profile?.imageUrl ?? null,
      unavailable: unavailableOcids.has(ocid),
    }
  })
}

/**
 * 저장된 대표가 **지금 목록에서도 유효한가**만 답한다.
 *
 * 미지정이면 첫 번째 를 여기서 만들지 않는다. 캐릭터 관리 화면은 대표가 없을 때 **아무 표시도
 * 하지 않기로** 했고(채워진 별이 하나도 없는 화면), 여기를 폴백시키면 사용자가 고른 적 없는
 * 캐릭터의 별이 채워져 있는 상태가 만들어진다. 목록에서 빠진 대표를 지우는 일은 저장 헬퍼
 * (`setCharacterSelection`)가 이미 한다.
 *
 * **`resolveDisplayRepresentative` 와 합치지 마라.** 이름은 비슷하지만 묻는 것이 다르다 —
 * 이쪽은 사용자가 대표라고 **말했는가**, 저쪽은 지금 대표 **자리에 설** 캐릭터는 누구인가.
 */
export function resolveRepresentative(orderedOcids: string[], stored: string | null): string | null {
  if (stored === null || !orderedOcids.includes(stored)) {
    return null
  }
  return stored
}

/**
 * 지금 대표 자리 에 설 캐릭터. 미지정이면 목록의 첫 번째(의 임시 대표).
 * **저장하지 않는 파생값**이다. 저장하면 순서가 바뀔 때마다 사용자가 고른 대표 와 앱이 적어 둔
 * 대표 두 진실이 갈린다.
 *
 * `today` 의 대표 캐릭터 위젯이 이 값의 첫 독자다. 그 화면은 대표 없음
 * 상태를 갖지 않으므로 자리에 설 캐릭터가 늘 하나 있어야 한다.
 *
 * **`resolveRepresentative` 와 합치지 마라**. 위 함수 주석의 이유. 저장된 대표가 목록에 없으면
 * 여기서도 첫 번째로 떨어진다(참조 무결성은 쓰는 쪽이 지키지만, 읽는 쪽도 안전해야 한다).
 */
export function resolveDisplayRepresentative(
  orderedOcids: string[],
  stored: string | null,
): string | null {
  return resolveRepresentative(orderedOcids, stored) ?? orderedOcids[0] ?? null
}
