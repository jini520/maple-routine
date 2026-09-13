// `package.json` 의 버전은 OTA 매니페스트의 `appVersion` 이 되고, `app.json` 의 `expo.version` 은
// 스토어 바이너리의 버전이 된다. 1.0.8 스토어 릴리스가 `app.json` 만 올려 둘이 갈렸고, 그 뒤로
// OTA 발행 스크립트가 멈추기 전까지 아무도 몰랐다. 발행 스크립트를 안 지나는 스토어 릴리스에서도
// 잡히게 여기서 본다.
import appJson from '../../app.json'
import packageJson from '../../package.json'

it('package.json 과 app.json 의 버전이 같다', () => {
  expect(packageJson.version).toBe(appJson.expo.version)
})
