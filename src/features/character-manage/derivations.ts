/**
 * 캐릭터 관리 화면이 **직접 계산하면 안 되는 파생값**.
 *
 * 화면은 그리기만 하고 값 규칙은 여기가 갖는다. 그래야 대표 캐릭터나 넥슨 계정 묶음 같은
 * 규칙을 테스트가 직접 물 수 있다.
 *
 * **순수 함수만 산다.** 저장소·네트워크를 부르지 않고 입력을 전부 인자로 받는다(캐시 조회·로스터
 * 조회는 호출부의 일이다). 여기서 조회를 하면 값 규칙을 검사하려고 포트를 목으로 세워야 한다.
 */

import type { MapleAccount, MapleCharacter } from '../../types'
import type { NexonCredential } from '../../types/auth'
import { compareByName, pickRepresentativeCharacter } from '../../lib/character-order'

/** 메이플 ID 드롭다운 한 행이 쓰는 값. */
export interface AccountSummaryView {
  accountId: string
  /** 이름 아래 줄에 서는 캐릭터. `character/list` 기준이라 조회 0회다. */
  representative: MapleCharacter
  characterCount: number
}

/**
 * 계정 하나를 드롭다운 행이 쓰는 값으로 접은 것.
 *
 * 캐릭터가 0명이면 `null` 이다. 그 계정은 애초에 오지 않지만 여기서 던지면 화면이 렌더 중에
 * 죽는다. 대표 캐릭터가 없는 `AccountSummaryView` 는 만들지 않는다. 세울 수 없는 행이다.
 */
export function summarizeAccount(account: MapleAccount): AccountSummaryView | null {
  if (account.characters.length === 0) {
    return null
  }

  return {
    accountId: account.accountId,
    representative: pickRepresentativeCharacter(account.characters),
    characterCount: account.characters.length,
  }
}

/**
 * 드롭다운 목록의 차례. 대표 캐릭터의 레벨이 높은 계정이 먼저다.
 *
 * 계정 자체에는 어느 것이 주력인가 를 말하는 값이 없다. `accountId` 는 불투명 문자열이고 응답
 * 순서는 넥슨이 정한다. 사람이 실제로 쓰는 기준이 가장 높은 캐릭터라 그것으로 세운다. 대표는
 * 이미 각 계정의 최고 레벨이므로 새로 셀 것도 없다.
 *
 * 동레벨이면 대표 이름순이다. 이 순서는 첫 계정 선택에도 그대로 걸린다. 화면이 목록의 첫
 * 항목을 연다.
 */
export function sortAccountSummaries(summaries: AccountSummaryView[]): AccountSummaryView[] {
  return [...summaries].sort((a, b) =>
    b.representative.level !== a.representative.level
      ? b.representative.level - a.representative.level
      : compareByName(a.representative.name, b.representative.name),
  )
}

/** 넥슨 계정 하나의 `character/list`. 못 받았으면 `accounts` 가 `null` 이다. */
export interface NexonAccountList {
  credential: NexonCredential
  accounts: readonly MapleAccount[] | null
}

/** 드롭다운의 행과, 넥슨 계정이 둘 이상 보일 때 메이플 ID 마다 붙는 묶음 라벨. */
export interface GroupedAccountSummaries {
  accounts: AccountSummaryView[]
  /** 메이플 ID → `넥슨 ID 계정` · `API 키 N 계정`. 보이는 넥슨 계정이 하나면 비어 있다 */
  groupOf: Record<string, string>
}

/**
 * 메이플 ID 를 넥슨 계정마다 묶는다. 묶음은 자격의 차례(넥슨 ID 계정, 그다음 API 키를 등록한 차례)이고 묶음 안은 대표 레벨 차례다.
 *
 * API 키의 번호는 목록을 못 받은 키도 세어 매긴다. 계정 관리 목록의 `API 키 N 계정` 과 번호가 같아야 한다.
 */
export function groupAccountSummaries(lists: readonly NexonAccountList[]): GroupedAccountSummaries {
  let keyNumber = 0
  const groups = lists.map((list) => {
    const label = list.credential.type === 'login' ? '넥슨 ID 계정' : `API 키 ${++keyNumber} 계정`
    const summaries = sortAccountSummaries(
      (list.accounts ?? []).map(summarizeAccount).filter((one): one is AccountSummaryView => one !== null),
    )
    return { label, summaries }
  }).filter((group) => group.summaries.length > 0)

  const accounts = groups.flatMap((group) => group.summaries)
  if (groups.length < 2) return { accounts, groupOf: {} }
  return {
    accounts,
    groupOf: Object.fromEntries(groups.flatMap((group) => group.summaries.map((one) => [one.accountId, group.label]))),
  }
}

/** 선택됨 층의 행 하나. 네트워크 없이 로컬 캐시로만 그린다. */
export interface SelectedCharacterView {
  ocid: string
  /** 캐시가 없으면 빈 문자열이다. 자리표시자 문구를 지어내지 않는다. */
  name: string
  level: number | null
  jobClass?: string
  /** 엠블럼을 찾는 월드 key */
  worldKey?: string | null
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
  worldKey?: string | null
  jobClass?: string
}

/**
 * 추적 목록을 선택됨 층의 행들로 편다.
 *
 * - 순서는 `orderedOcids` 그대로다. 저장 순서가 곧 표시 순서이고 레벨로 다시 정렬하지 않는다.
 * - 모르면 모르는 채로 둔다. 레벨 `null`, 직업·월드 없음, 얼굴 `null`. 화면이 그 자리를 비운다.
 * - 조회 불가 캐릭터도 빠지지 않는다. 빼면 그 ocid 를 해제할 방법이 없다. 값이 남아 있으면
 *   그대로 쓰고 플래그만 얹는다.
 *
 * 캐시 엔트리가 아니라 프로필을 받는다. 이 함수는 `cachedAt` 을 한 번도 읽지 않고, 엔트리를
 * 요구하면 캐시 말고 다른 출처를 넘기려는 호출부가 언제 캐싱됐는지를 지어내야 한다.
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
      worldKey: profile?.worldKey,
      imageUrl: profile?.imageUrl ?? null,
      unavailable: unavailableOcids.has(ocid),
    }
  })
}

/**
 * 저장된 대표가 지금 목록에서도 유효한가.
 *
 * 미지정이면 첫 번째 를 여기서 만들지 않는다. 캐릭터 관리 화면은 대표가 없을 때 아무 표시도
 * 하지 않으므로, 여기를 폴백시키면 사용자가 고른 적 없는 캐릭터의 별이 채워진다. 목록에서 빠진
 * 대표를 지우는 일은 `setCharacterSelection` 이 이미 한다.
 *
 * `resolveDisplayRepresentative` 와 합치지 말 것. 이쪽은 사용자가 대표라고 말했는가, 저쪽은
 * 지금 대표 자리에 설 캐릭터는 누구인가 를 묻는다.
 */
export function resolveRepresentative(orderedOcids: string[], stored: string | null): string | null {
  if (stored === null || !orderedOcids.includes(stored)) {
    return null
  }
  return stored
}

/**
 * 지금 대표 자리에 설 캐릭터. 미지정이면 목록의 첫 번째.
 *
 * 저장하지 않는 파생값이다. 저장하면 순서가 바뀔 때마다 사용자가 고른 대표 와 앱이 적어 둔
 * 대표 두 진실이 갈린다.
 *
 * `today` 의 대표 캐릭터 위젯이 이 값의 첫 독자다. 그 화면은 대표 없음 상태를 갖지 않는다.
 *
 * `resolveRepresentative` 와 합치지 말 것. 저장된 대표가 목록에 없으면 여기서도 첫 번째로
 * 떨어진다.
 */
export function resolveDisplayRepresentative(
  orderedOcids: string[],
  stored: string | null,
): string | null {
  return resolveRepresentative(orderedOcids, stored) ?? orderedOcids[0] ?? null
}
