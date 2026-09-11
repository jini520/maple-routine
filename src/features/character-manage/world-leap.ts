/**
 * 조회할 수 없게 된 추적 캐릭터가 **월드 리프를 한 것인가**. 순수 함수 하나가 그 판정을 갖는다.
 *
 * 월드 이전은 ocid 를 새로 만든다. 옛 ocid 는 `character/list` 에서 빠지고 `character/basic` 은
 * 200 에 전 필드 `null` 을 준다. 두 ocid 를 잇는 단서는 **캐릭터 이름·직업·레벨** 셋뿐이고 셋 다
 * 넥슨이 보증해 주는 것이 아니라, 앱은 짚기만 하고 **바꾸는 것은 사용자가 확인할 때만** 한다.
 *
 * 저장소·네트워크를 안 부른다. 판정 재료를 전부 인자로 받아야 규칙을 테스트가 직접 물 수 있다.
 */

import type { MapleCharacter } from '../../types'

/**
 * 이전이 일어나기 전 그 캐릭터에 대해 **마지막으로 아는 것**.
 *
 * 출처는 `character_profiles`(지워지지 않는 스냅샷)다. 5분 TTL 캐시에서 읽으면 캐시 비우기 한
 * 번에 판정 재료가 사라진다.
 *
 * `level`·`jobClass` 가 `null` 일 수 있는 것은 스냅샷이 그것을 모를 수 있어서다. 둘의 처지는
 * 다르다(아래 `detectWorldLeap`).
 */
export interface StrandedCharacter {
  ocid: string
  name: string
  world: string | null
  jobClass: string | null
  level: number | null
}

export interface WorldLeapCandidate {
  from: StrandedCharacter
  to: MapleCharacter
}

/**
 * 챌린저스 계열 월드인가. 지금까지 본 이름은 `챌린저스`·`챌린저스2` 다.
 *
 * 접두사로 보는 것은 넥슨이 뒤에 숫자를 붙여 월드를 늘리기 때문이다. `챌린저스3` 이 생겨도
 * 이 판정이 따라간다.
 */
export function isChallengersWorld(world: string): boolean {
  return world.startsWith('챌린저스')
}

/**
 * 이 캐릭터가 월드 리프를 했다고 **물어도 되는가**. 아니면 `null`.
 *
 * 다섯 조건을 전부 만족해야 한다. 하나라도 어긋나면 안 묻는다 - 틀리게 물으면 사용자가 남의
 * 캐릭터를 자기 관리 목록에 넣는다.
 *
 * | 조건 | 왜 |
 * |---|---|
 * | 옛 월드가 챌린저스 계열 | 일반 월드에서 캐릭터가 사라지는 것은 **삭제**일 수 있다 |
 * | 이름·직업이 같은 후보가 정확히 하나 | 이름만으로는 유일하지 않다. 둘 이상이면 고를 근거가 없다 |
 * | 후보 레벨 ≥ 옛 레벨 | 리프는 레벨을 유지하고 그 뒤로 오를 수만 있다 |
 * | 후보가 추적 중이 아님 | 이미 추적 중이면 사용자가 손을 댄 것이고, 그때 할 일은 옛 것 해제다 |
 *
 * **모르는 값의 처지가 둘로 갈린다.** 옛 레벨을 모르면 그 조건만 건너뛴다(모름을 못 넘긴다로
 * 읽으면 캐시가 레벨을 잃은 사용자에게 영영 안 묻는다). 옛 직업을 모르면 **안 묻는다** - 직업은
 * 후보의 유일성을 세우는 조건이라, 빠지면 이름 하나로 짚는 것이 된다.
 *
 * 후보의 월드가 챌린저스 계열인지는 안 본다. 여기까지 온 캐릭터가 또 다른 챌린저스 월드에
 * 있다면 그것도 이전이라 물을 이유가 같다.
 *
 * @param stranded 조회할 수 없게 된 추적 캐릭터
 * @param roster `character/list` 가 준 **전 계정** 캐릭터. 한 계정만 넘기면 계정을 넘은 리프를 놓친다
 * @param trackedOcids 지금 추적 중인 ocid
 */
export function detectWorldLeap(
  stranded: StrandedCharacter,
  roster: readonly MapleCharacter[],
  trackedOcids: ReadonlySet<string>,
): WorldLeapCandidate | null {
  if (stranded.world === null || !isChallengersWorld(stranded.world)) {
    return null
  }
  if (stranded.jobClass === null) {
    return null
  }

  const matches = roster.filter(
    (character) =>
      character.name === stranded.name &&
      character.jobClass === stranded.jobClass &&
      character.ocid !== stranded.ocid &&
      !trackedOcids.has(character.ocid) &&
      (stranded.level === null || character.level >= stranded.level),
  )

  return matches.length === 1 ? { from: stranded, to: matches[0]! } : null
}
