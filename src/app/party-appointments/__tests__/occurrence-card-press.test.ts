import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// 회차 카드는 today 위젯처럼 누르는 동안 흐려지지 않는다(사용자 지정). 카드 하나가 통째로 흐려지면 다른 카드와 따로 논다.
// NativeWind 가 렌더 뒤 `className` 을 지워 렌더 결과로는 물을 수 없어서 소스로 묻는다.
it('회차 카드 소스에 누름 흐려짐 클래스가 없다', () => {
  const source = readFileSync(join(__dirname, '..', 'OccurrenceCard.tsx'), 'utf8')

  expect(source).not.toContain('active:opacity')
})
