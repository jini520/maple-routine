// 기간 이동 줄은 다섯 화면이 공용 부품 `PeriodStepper` 하나를 쓴다.
//
// 화면마다 줄을 베껴 적으면 한 곳만 바뀌어도 같은 줄이 화면마다 다르게 보이고, 그 어긋남은 화면을 오갈 때만 보여
// 리뷰에서 안 잡힌다. 그래서 손으로 그린 줄이 돌아오지 않는지 소스로 본다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const APP = join(__dirname, '..', 'app')

const SCREENS = [
  join(APP, 'boss-profit', 'BossProfitScreen.tsx'),
  join(APP, 'boss-profit', 'DropPriceScreen.tsx'),
  join(APP, 'cashbook', 'CashbookScreen.tsx'),
  join(APP, 'party-appointments', 'AppointmentsScreen.tsx'),
  join(APP, 'stats', 'StatsScreen.tsx'),
]

/** 옛 줄의 화살표. 28px 테두리 원을 화면이 직접 그리던 흔적이다. */
const HAND_DRAWN_ARROW = /h-7 w-7 items-center justify-center rounded-full border border-border/

describe('기간 이동 줄', () => {
  it.each(SCREENS.map((path) => ({ name: path.slice(APP.length + 1), source: readFileSync(path, 'utf8') })))(
    '$name 은 공용 부품을 쓰고 화살표를 직접 그리지 않는다',
    ({ source }) => {
      expect(source).toContain('<PeriodStepper')
      expect(source).not.toMatch(HAND_DRAWN_ARROW)
    },
  )
})
