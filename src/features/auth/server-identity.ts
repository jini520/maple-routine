/**
 * **우리 서버**에 자기를 밝히는 헤더. 넥슨을 부르는 자격(`current-credential.ts`)과 다른 축이다.
 *
 * | 헤더 | 값 |
 * |---|---|
 * | `Authorization: Bearer <세션>` | 서버가 발급한 세션. 로그인한 사용자 |
 * | `x-maple-id-hash` | 메인 키의 넥슨 계정에서 본 메이플 ID 가운데 정렬해 맨 앞의 것의 SHA-256. 로그인 없이 키만 쓰는 사용자 |
 *
 * **세션이 있으면 메이플 ID 해시를 안 싣는다.** 세션이 죽었을 때 서버가 다른 헤더로 넘어가지 않고 재로그인을 요구한다. 넘어가면
 * 같은 사람의 기록이 두 열쇠로 갈라진다. 세션은 그 로그인에 등록한 부계정의 메이플 ID 까지 쓸 수 있어 부계정 키로는 밝히지 않는다.
 *
 * **키 해시는 싣지 않는다.** 1.0.15 서버는 받지 않는다. 키는 다시 받으면 바뀌지만 메이플 ID 는 안 바뀐다.
 */
import { nexonIdHashHex } from '../../lib/crypto/nexon-id-hash'
import { mainApiKeyOf } from '../../lib/nexon-credential'
import { getAuthConfig } from '../../storage/api-key'
import { getMapleIdsOfNexonAccountUngated } from '../../storage/character-accounts'
import type { NexonAuthConfig } from '../../types/auth'

export type ServerIdentity = Record<string, string>

/**
 * 메인 계정의 신원. 밝힐 수단이 없으면 `null` 이고, 그때는 서버에 아무것도 안 보낸다.
 *
 * 메이플 ID 는 정렬해 맨 앞의 것을 쓴다. 같은 키로 늘 같은 값을 보내야 서버가 넥슨 계정 줄을 새로 만들었다가 합치지 않는다.
 *
 * @param mapleIdsOf 넥슨 계정 id 로 그 계정에서 본 메이플 ID 원문을 읽는 함수. 세션이 있으면 부르지 않는다
 */
export async function mainServerIdentityOf(
  config: NexonAuthConfig | null,
  mapleIdsOf: (nexonAccountId: string) => Promise<readonly string[]>,
): Promise<ServerIdentity | null> {
  const login = config?.login
  if (login != null && login.session !== '') return { Authorization: `Bearer ${login.session}` }

  const key = mainApiKeyOf(config)
  if (key === null) return null
  const [first] = [...(await mapleIdsOf(key.id))].sort()
  return first === undefined ? null : { 'x-maple-id-hash': nexonIdHashHex(first) }
}

/**
 * 저장된 설정으로 지은 메인 계정의 신원. 저장소를 못 읽으면 `null` 이다.
 *
 * 메이플 ID 는 기기 변환을 기다리지 않고 읽는다. 변환이 실패한 실행에서도 사용 로그를 보내는 데 쓰여, 기다리면 그 전송과
 * `다시 시도` 가 함께 멈춘다.
 */
export async function serverIdentityHeaders(): Promise<ServerIdentity | null> {
  try {
    return await mainServerIdentityOf(await getAuthConfig(), getMapleIdsOfNexonAccountUngated)
  } catch {
    return null
  }
}
