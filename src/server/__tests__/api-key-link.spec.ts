// 서버가 받는 주소 · 헤더 · 본문과 어긋나면 잇기가 늘 거절되고, 앱은 그 키를 지우지 못한 채 남긴다.
import { linkApiKeyOnServer } from '../api-key-link'

const fetchMock = jest.fn()

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, status: 204 })
  global.fetch = fetchMock as unknown as typeof fetch
})

it('세션을 Bearer 로, 해시를 본문으로 /me/api-key-links 에 보낸다', async () => {
  await expect(linkApiKeyOnServer('세션', 'ab'.repeat(32))).resolves.toEqual({ outcome: 'sent' })

  expect(fetchMock).toHaveBeenCalledWith(
    'https://mapleroutine.store/v1/me/api-key-links',
    expect.objectContaining({
      method: 'POST',
      headers: { Authorization: 'Bearer 세션', 'content-type': 'application/json' },
      body: JSON.stringify({ apiKeyHash: 'ab'.repeat(32) }),
    }),
  )
})
