// 누를 수 있는 카드는 누르는 동안 흐려지지 않는다(사용자 지정). 카드 하나가 통째로 흐려지면 그 카드만 다른 카드와 따로 논다.
// NativeWind 가 렌더 뒤 `className` 을 지워 렌더 결과로는 물을 수 없어서 소스로 묻는다. 작은 버튼은 카드가 아니라 묻지 않는다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const APP = join(__dirname, '..', 'app')

/** 누를 수 있는 카드가 든 파일. 이 파일들에는 카드 말고 누름 흐려짐을 쓰는 것이 없다. */
const CARD_FILES = [
  join(APP, 'cashbook', 'CashbookScreen.tsx'),
  join(APP, 'cashbook', 'CategoryPicker.tsx'),
  join(APP, 'party-appointments', 'AppointmentTimeBand.tsx'),
  join(APP, 'boss-profit', 'ManualCompletionButton.tsx'),
]

describe('카드 누름 표시', () => {
  it.each(CARD_FILES.map((path) => ({ name: path.slice(APP.length + 1), source: readFileSync(path, 'utf8') })))(
    '$name 의 카드는 누르는 동안 흐려지지 않는다',
    ({ source }) => {
      expect(source).not.toContain('active:opacity')
    },
  )

  // 같은 파일에 동그란 아이콘 버튼이 있어 파일 전체로는 못 묻는다. 기록 카드의 누름 칸만 본다.
  it('계산기 기록 카드는 누르는 동안 흐려지지 않는다', () => {
    const source = readFileSync(join(APP, 'utility', 'BossProfitCalculatorRecordsScreen.tsx'), 'utf8')

    expect(source).not.toMatch(/gap-2 py-2\.5 pl-\[18px\] pr-2 active:opacity/)
  })
})
