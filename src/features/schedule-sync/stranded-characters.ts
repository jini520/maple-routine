/**
 * 동기화가 **한 번도 답하지 않은** 추적 캐릭터를 화면이 세울 수 있는 만큼으로 만든다.
 *
 * 월드 이전으로 `character/list` 에서 빠진 ocid 는 `resolveTrackedCharacterContext` 가 버려
 * `syncSchedules` 의 결과에 아예 안 온다. 화면이 결과만 보고 목록을 만들면 그 캐릭터가 **첫
 * 페인트에 캐시로 보였다가 동기화가 끝나는 순간 사라진다**.
 *
 * 빠진 것과 없는 것은 다른 사실이다. 자리를 남기고 조회 불가라고 말한다.
 *
 * 401·429 는 여기 안 걸린다. 그 실패에는 `syncSchedules` 가 **전 캐릭터에 폴백 결과**를 만들어
 * 주므로 답하지 않은 ocid 가 0개다. 그 구분이 없으면 키를 잘못 넣은 사용자에게 전원이 조회
 * 불가로 보인다.
 */

import {
  getScheduleProbeLedger,
  markScheduleProbeUnavailable,
} from '../../storage/schedule-probe-ledger'
import { resolveDisplayProfiles } from '../character-profile/resolve'
import type { ScheduleSyncError } from './errors'

/**
 * 동기화 결과에서 이 파일이 읽는 것. 두 스토어의 결과 타입이 서로 달라 필요한 칸만 적는다.
 *
 * `error` 는 `persistUnavailable` 만 본다. **답했다고 조회된 것이 아니다** - 목록에는 있는데
 * 400 `OPENAPI00003` 을 주는 캐릭터가 실측으로 있고(계정 단위로 13/13), 그 결과는 `results` 에
 * 들어온다.
 */
interface SyncedOcid {
  ocid: string
  error?: { kind: string } | null
}

/** 화면이 빈 자리를 세우는 데 필요한 최소한. */
export interface StrandedCharacter {
  ocid: string
  characterName: string
  /** 모르면 `undefined`. 두 스토어의 뷰가 그 부재를 옵셔널로 표현한다. */
  world: string | undefined
  level: number | null
  imageUrl: string | null
}

/** 순서는 추적 목록 그대로다. 화면의 차례를 여기서 바꾸지 않는다. */
export function findStrandedOcids(
  trackedOcids: readonly string[],
  results: readonly SyncedOcid[],
): string[] {
  const responded = new Set(results.map((result) => result.ocid))
  return trackedOcids.filter((ocid) => !responded.has(ocid))
}

/**
 * 이름은 **지워지지 않는 스냅샷**에서 읽는다. 이 캐릭터는 API 로 다시 물을 길이 없어 그 표가
 * 유일한 출처다.
 *
 * 이름을 모르면 세우지 않는다. `ocid` 는 사용자에게 아무 뜻도 없는 문자열이라 이름 대신 적을 수
 * 없고, 이름 없는 칸은 아무것도 말하지 않는다.
 */
export async function resolveStrandedCharacters(
  trackedOcids: readonly string[],
  results: readonly SyncedOcid[],
): Promise<StrandedCharacter[]> {
  const stranded = findStrandedOcids(trackedOcids, results)
  if (stranded.length === 0) {
    return []
  }

  const profiles = await resolveDisplayProfiles(stranded).catch(() => new Map())
  return stranded.flatMap((ocid) => {
    const profile = profiles.get(ocid)
    if (profile === undefined || profile.name === '') {
      return []
    }
    return [
      {
        ocid,
        characterName: profile.name,
        world: profile.world ?? undefined,
        level: profile.level,
        imageUrl: profile.imageUrl,
      },
    ]
  })
}

/** 표식을 얹는 데 필요한 최소한. 두 스케줄러 뷰가 이 세 칸을 공통으로 갖는다. */
interface MarkableView {
  ocid: string
  isStale: boolean
  error: ScheduleSyncError | null
}

/**
 * **표가 이미 아는 조회 불가**를 캐시 우선 표시 단계에 얹는다.
 *
 * 없으면 스케줄러가 동기화를 기다리는 동안 낡은 캐시로 **컨텐츠 목록을 그대로 그린다**. 그
 * 목록은 지금 할 일처럼 읽히는데 실제로는 조회조차 안 되는 캐릭터의 옛 상태다.
 *
 * 출처는 **조회 원장**(`scheduleProbe:<ocid>.unavailable`)이라 로컬 조회이고 네트워크가 없다.
 * 캐릭터 관리 화면의 배지도 같은 값을 읽으므로 조회 불가의 출처가 앱 전체에서 하나다.
 *
 * 원장이 Preferences 에 사는 것이 이 값에 맞다. 캐시 비우기 `일반` 그룹은 `KEEP_KEYS` 다섯
 * 묶음 빼고 Preferences 를 통째로 지우는데, 그때 **추적 목록도 함께 날아가** 세울 캐릭터 자체가
 * 없어진다. 표식만 남기고 목록이 사라지는 상태가 존재하지 않는다.
 *
 * **내용도 함께 비운다**(`toUnknown`). 표식만 찍고 캐시가 준 목록을 그대로 두면 진행 링이 옛
 * 진행률을 그렸다가, 동기화가 끝나 빈 뷰로 갈리는 순간 빈 링으로 바뀐다(관측된 증상). 첫
 * 페인트와 동기화 후가 같은 것을 그려야 하고, 그 같은 것 은 **모른다** 다.
 *
 * 비우는 모양을 호출부가 주는 것은 스토어마다 칸이 다르기 때문이다(컨텐츠는 일간·주간, 보스는
 * 보스 목록과 처치 수). 동기화 뒤의 빈 뷰를 만드는 것과 **같은 함수**여야 두 시점이 안 갈린다.
 *
 * 못 읽으면 그대로 돌려준다. 이 표식은 화면을 **더 정확하게** 만드는 것이지 세우는 조건이
 * 아니라, 못 읽었다고 목록을 못 그리면 안 된다.
 */
export async function applyKnownUnavailable<T extends MarkableView>(
  views: T[],
  toUnknown: (view: T) => T,
): Promise<T[]> {
  if (views.length === 0) {
    return views
  }

  const now = new Date()
  const flags = await Promise.all(
    views.map((view) =>
      getScheduleProbeLedger(view.ocid, now)
        .then((ledger) => ledger.unavailable)
        .catch(() => false),
    ),
  )
  return views.map((view, index) =>
    flags[index] === true
      ? { ...toUnknown(view), isStale: true, error: { kind: 'characterUnavailable' as const } }
      : view,
  )
}

/**
 * **조회 불가를 표에 남긴다.** 이 사실을 배우는 자리가 동기화라 쓰는 자리도 여기다.
 *
 * 전에는 보스 수익 스토어가 이 일을 했다. 그 배지가 거기서 처음 필요했기 때문인데, 조회 불가는
 * 보스 수익의 사실이 아니라 **캐릭터의 사실**이다. 그 자리에 두면 사용자가 보스 수익 화면을 한
 * 번도 안 열면 표가 영영 안 차고, 스케줄러만 쓰는 사람에게는 첫 페인트가 계속 틀린다.
 *
 * 남기는 곳은 **조회 원장**이다. 400 `OPENAPI00003` 이 이미 그 칸에 쓰고 캐릭터 관리 배지가 그
 * 값을 읽으므로, 여기를 따로 두면 같은 사실의 출처가 둘이 된다.
 *
 * 답한 캐릭터는 함께 **내린다**. 조회가 다시 되는데 표식이 남으면 화면이 영영 조회 불가라고
 * 말한다.
 *
 * 실패는 삼킨다. 화면이 기다리는 값이 아니라 다음 진입을 위한 뒷정리라, 못 썼다고 이번 동기화가
 * 실패하면 안 된다.
 */
export async function persistUnavailable(
  trackedOcids: readonly string[],
  results: readonly SyncedOcid[],
): Promise<void> {
  // 답하지 않았거나, 답이 **조회 불가**인 캐릭터. 둘째를 빼면 400 `OPENAPI00003` 로 답한
  // 캐릭터의 표식을 이 함수가 곧바로 내려 버린다(그 코드가 방금 올린 것을).
  const stranded = new Set(findStrandedOcids(trackedOcids, results))
  for (const result of results) {
    if (result.error?.kind === 'characterUnavailable') {
      stranded.add(result.ocid)
    }
  }

  await Promise.all(
    trackedOcids.map((ocid) =>
      markScheduleProbeUnavailable(ocid, stranded.has(ocid)).catch(() => undefined),
    ),
  )
}
