/**
 * 우리 서버의 게임 데이터 표 조회. `settlement.ts` 와 같은 자리, 같은 규칙이다.
 *
 * **못 받았으면 표를 바꾸지 않는다.** 응답 전체가 아니라 칸마다 본다. 칸 하나가 계약을 어기거나
 * 서버가 아직 안 넣은 표(`updatedAt: null`)면 그 칸만 `null` 이고 나머지 칸은 쓴다. 응답 자체를 못
 * 받았으면 `null` 하나만 나간다.
 *
 * 계약은 서버 저장소와 나눠 갖는다. 칸마다의 검사는 그 조회 모듈의 `parse` 다(`lib/game-data/sections`).
 */
import { SECTIONS } from '../lib/game-data/sections'
import { GAME_DATA_SECTIONS, type GameData, type GameDataResponse, type GameDataSection } from '../types/game-data'

const BASE_URL = 'https://mapleroutine.store/v1'

/**
 * 얼마나 기다리나. 처음 켤 때는 이 응답을 받아야 잠금 화면이 풀리므로, 느린 망에서 수백 KB 를 받을 시간을 준다.
 */
const TIMEOUT_MS = 15_000

/** 칸 하나. 계약을 어겼거나 서버가 아직 비었으면 `null`. */
function section<K extends GameDataSection>(key: K, value: unknown): GameData[K] | null {
  const parsed = SECTIONS[key].parse(value)
  return parsed === null || parsed.updatedAt === null ? null : parsed
}

/** 응답 본문을 칸마다 검사한다. 객체가 아니면 `null` 하나다. */
export function parseGameDataResponse(body: unknown): GameDataResponse | null {
  if (typeof body !== 'object' || body === null) return null
  const sections = body as Record<string, unknown>
  const response: Partial<Record<GameDataSection, unknown>> = {}
  for (const key of GAME_DATA_SECTIONS) response[key] = section(key, sections[key])
  return response as GameDataResponse
}

export type GameDataFetch =
  | { kind: 'not-modified' }
  | {
      kind: 'ok'
      /** 다음 요청이 `If-None-Match` 로 보낼 값. 서버가 안 주면 `null` */
      etag: string | null
      /** 응답 본문의 글자 수. 잠금 화면이 받은 양으로 보인다 */
      bytes: number
      /** 칸마다 계약 검사를 거친 값 */
      sections: GameDataResponse
      /** 응답 원문의 칸. 기기 사본은 이것을 그대로 저장하고 켤 때 다시 검사한다 */
      raw: Record<string, unknown>
    }

/**
 * 못 받았거나 응답이 객체가 아니면 `null`. 칸마다의 실패는 그 칸의 `null` 이다.
 *
 * @param etag 가진 사본의 ETag. 주면 바뀐 것이 없을 때 서버가 304 로 몸 없이 답한다
 */
export async function fetchGameData(etag: string | null): Promise<GameDataFetch | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${BASE_URL}/game-data`, {
      signal: controller.signal,
      ...(etag === null ? {} : { headers: { 'If-None-Match': etag } }),
    })
    if (response.status === 304) return { kind: 'not-modified' }
    if (response.status !== 200) return null
    const text = await response.text()
    const body = JSON.parse(text) as unknown
    const sections = parseGameDataResponse(body)
    if (sections === null) return null
    return {
      kind: 'ok',
      etag: response.headers.get('etag'),
      bytes: text.length,
      sections,
      raw: body as Record<string, unknown>,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** 그림 파일의 주소. 파일 이름은 그림 목록의 `file` 이다. */
export function assetFileUrl(file: string): string {
  return `https://mapleroutine.store/assets/${file}`
}
