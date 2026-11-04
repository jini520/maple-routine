// 백그라운드 태스크는 OS 가 꺼진 앱을 깨울 때 찾는 등록이라 자리가 요건이다. OTA 로는 못 더한다.
//
// jest 가 OS 스케줄러를 못 돌리므로 진입점과 네이티브 설정 파일이 그 모양을 들고 있는지를 본다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '../..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('백그라운드 태스크', () => {
  // 모듈 최상위가 아니면 OS 가 깨울 때 핸들러가 없다. 함수 안에 넣으면 그 함수가 불릴 때까지 OS 는 이 태스크를 모른다.
  it('index.ts 가 모듈 최상위에서 태스크를 정의한다', () => {
    expect(read('index.ts')).toMatch(/^defineBackgroundRefreshTask\(runBackgroundRefresh\)$/m)
  })

  // 모드나 식별자가 빠지면 iOS 가 등록을 거부하고, 앱은 아무 표시 없이 재확인을 못 한다.
  it('Info.plist 에 processing 모드와 expo-background-task 의 허용 식별자가 있다', () => {
    const plist = read('ios/app/Info.plist')
    const modes = /<key>UIBackgroundModes<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(plist)?.[1] ?? ''

    expect(modes).toContain('<string>processing</string>')
    expect(modes).toContain('<string>remote-notification</string>')
    expect(plist).toMatch(
      /<key>BGTaskSchedulerPermittedIdentifiers<\/key>\s*<array>\s*<string>com\.expo\.modules\.backgroundtask\.processing<\/string>\s*<\/array>/,
    )
  })
})
