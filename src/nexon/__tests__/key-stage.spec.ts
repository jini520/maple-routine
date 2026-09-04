// 프로브가 재는 것은 **이 키가 초당 5건을 넘길 수 있는가** 하나다.
//
// 판정이 서는 조건이 **동시에 나간다**는 것뿐이라, 이 파일의 절반은 그 한 가지를 지킨다. 순차로
// 바뀌면 호출 수도 반환값도 그대로인 채 판정만 조용히 죽는다.
import { NexonAuthError, NexonNetworkError, NexonRateLimitError } from '../errors'
import { PROBE_CALL_COUNT, probeApiKeyStage } from '../key-stage'

jest.mock('../http', () => ({ requestJson: jest.fn() }))
const { requestJson: requestJsonMock } = jest.requireMock('../http') as Record<string, jest.Mock>

beforeEach(() => {
  requestJsonMock.mockReset()
})

/** 성공 n건 뒤에 주어진 실패들을 잇는 응답 순서. 프로브는 본문을 안 보므로 값은 아무거나 좋다. */
function respond(...failures: unknown[]): void {
  requestJsonMock.mockImplementation(async () => {
    const next = failures.shift()
    if (next !== undefined) throw next
    return {}
  })
}

describe('probeApiKeyStage', () => {
  it(`ocid 없이 부를 수 있는 유일한 엔드포인트를 ${PROBE_CALL_COUNT}건 부른다`, async () => {
    respond()

    await probeApiKeyStage('key-1')

    expect(requestJsonMock).toHaveBeenCalledTimes(PROBE_CALL_COUNT)
    for (const [path, apiKey] of requestJsonMock.mock.calls) {
      expect(path).toBe('/maplestory/v1/character/list')
      expect(apiKey).toBe('key-1')
    }
  })

  // 이 테스트가 이 파일의 요점이다. 초당 5건 한도를 넘기려면 하나도 안 끝난 상태에서 열 건이
  // 나가 있어야 한다. 순차 루프면 앞이 끝나야 다음이 나가 한도에 절대 안 닿는다.
  it('앞선 호출이 하나도 끝나기 전에 전부 나간다', async () => {
    const release: Array<() => void> = []
    requestJsonMock.mockImplementation(
      async () => await new Promise((resolve) => release.push(() => resolve({}))),
    )

    const verdict = probeApiKeyStage('key-1')
    await Promise.resolve()

    expect(requestJsonMock).toHaveBeenCalledTimes(PROBE_CALL_COUNT)

    for (const settle of release) settle()
    await verdict
  })

  it('429 를 하나라도 보면 개발 단계다', async () => {
    respond(new NexonRateLimitError('429'))

    await expect(probeApiKeyStage('key-1')).resolves.toBe('developmentStage')
  })

  // 429 는 마지막에 와도 같다. 하나라도 봤는가이지 몇 번째인가가 아니다.
  it('성공에 섞여 온 429 도 개발 단계다', async () => {
    const failures = Array.from({ length: PROBE_CALL_COUNT }, (_unused, index) =>
      index === PROBE_CALL_COUNT - 1 ? new NexonRateLimitError('429') : undefined,
    )
    requestJsonMock.mockImplementation(async () => {
      const next = failures.shift()
      if (next !== undefined) throw next
      return {}
    })

    await expect(probeApiKeyStage('key-1')).resolves.toBe('developmentStage')
  })

  // 429 를 못 봤다는 것은 **못 봤다는 뜻뿐**이다. 서비스 단계라는 뜻이 아니라서 반환값에
  // `service` 가 없다. 안드로이드의 동시 5건 천장·느린 망·리미터의 버스트 허용이 전부 여기로 온다.
  it('전부 성공하면 판정을 안 세운다', async () => {
    respond()

    await expect(probeApiKeyStage('key-1')).resolves.toBe('undetermined')
  })

  // 차단은 **양성 증거**를 요구한다. 네트워크가 끊겨 열 건이 다 죽은 것을 개발 단계로 읽으면
  // 비행기 안에서 키를 넣은 사람이 서비스 단계 키를 거부당한다.
  it('네트워크 오류만 있으면 판정을 안 세운다', async () => {
    respond(...Array.from({ length: PROBE_CALL_COUNT }, () => new NexonNetworkError('down')))

    await expect(probeApiKeyStage('key-1')).resolves.toBe('undetermined')
  })

  it('401 만 있으면 판정을 안 세운다', async () => {
    respond(...Array.from({ length: PROBE_CALL_COUNT }, () => new NexonAuthError('nope')))

    await expect(probeApiKeyStage('key-1')).resolves.toBe('undetermined')
  })

  // 프로브는 판정만 내고 던지지 않는다. 던지면 호출부가 검증 실패와 단계 판정 실패를
  // 구분하려고 같은 분기를 두 벌 갖게 된다.
  it('열 건이 다 실패해도 던지지 않는다', async () => {
    respond(...Array.from({ length: PROBE_CALL_COUNT }, () => new NexonNetworkError('down')))

    await expect(probeApiKeyStage('key-1')).resolves.toBeDefined()
  })
})
