import { installFakePreferences } from './fake-preferences'
import { getLastRunBundleVersion } from '../last-run-bundle-version'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('lastRunBundleVersion')
})

describe('last-run-bundle-version 저장', () => {
  // 저장값이 없다는 것은 "모른다"이지 "업데이트했다"가 아니다. 이 null 이
  // 곧 완료 안내를 띄우지 않는 근거다.
  it('저장된 적이 없으면 null', async () => {
    await expect(getLastRunBundleVersion()).resolves.toBeNull()
  })
})
