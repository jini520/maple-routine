// 파티 스케줄의 타일 · 줄 바탕은 흰 카드색(`surface`)이다. 보스 수익의 파스텔 본문색(`card-body`)을 쓰지 않는다.
import { flattenStyle, renderOverlay, 기본테마 } from '../../../components/__tests__/render-atom'
import { resolveCardBody } from '../../../theme/theme-vars'
import { AppointmentBossList } from '../AppointmentBossList'
import { AppointmentSummaryTiles } from '../AppointmentSummaryTiles'
import { AppointmentWeekdayTile } from '../AppointmentWeekdayTile'

const SURFACE = 기본테마.surface.toLowerCase()
const CARD_BODY = resolveCardBody(기본테마).toLowerCase()

/** 트리에서 배경색을 전부 모은다 */
function backgrounds(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(backgrounds)
  if (node === null || typeof node !== 'object') return []
  const current = node as { props: { style?: unknown }; children: unknown }
  const color = flattenStyle(current.props.style).backgroundColor
  return [...(typeof color === 'string' ? [color.toLowerCase()] : []), ...backgrounds(current.children)]
}

describe('파티 스케줄 타일 바탕', () => {
  it('알림 · 반복 타일은 흰 카드색이다', async () => {
    const view = await renderOverlay(<AppointmentSummaryTiles leadMinutes={10} repeats weekday="목" />)

    expect(backgrounds(view.toJSON())).toContain(SURFACE)
    expect(backgrounds(view.toJSON())).not.toContain(CARD_BODY)
  })

  it('보스 줄은 흰 카드색이다', async () => {
    const view = await renderOverlay(
      <AppointmentBossList
        bosses={[{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }]}
        names={new Map([['ocid-1', '낟낟']])}
        faces={new Map()}
        onChange={jest.fn()}
        onAdd={jest.fn()}
        readOnly
      />,
    )

    expect(backgrounds(view.toJSON())).toContain(SURFACE)
    expect(backgrounds(view.toJSON())).not.toContain(CARD_BODY)
  })

  it('요일 타일은 흰 카드색이다', async () => {
    const view = await renderOverlay(<AppointmentWeekdayTile weekday={4} endsNextDay={false} onChange={jest.fn()} />)

    expect(backgrounds(view.toJSON())).toContain(SURFACE)
    expect(backgrounds(view.toJSON())).not.toContain(CARD_BODY)
  })
})
