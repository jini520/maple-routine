/**
 * 인벤토리. 팔지 않고 가진 아이템(미입력 보스 드롭 · 솔 에르다 조각 · 다른 경로로 넣은 아이템)을 게임 인벤토리처럼 칸으로
 * 모은다. 칸을 누르면 그 칸을 가리키는 팝오버에 할 수 있는 일의 글자만 선다.
 */
import { useState } from 'react'
import { Image, Pressable, View } from 'react-native'

import { Text } from '../../components/atoms'
import { InventoryTabs } from '../../components/molecules/InventoryTabs/InventoryTabs'
import { AnchoredPopover } from '../../components/molecules/Popover/Popover'
import { FaqButton } from '../../components/organisms/FaqSheet/FaqButton'
import { NoticeModal } from '../../components/organisms/NoticeModal/NoticeModal'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { useFaqSheet } from '../../features/faq/use-faq-sheet'
import { closeInputCard, openInputCard } from '../../features/input-card/store'
import { loadDropForSale, removeInventoryRemaining, sellDrop, skipDrop } from '../../features/inventory/actions'
import { inventoryMenuOf, type InventoryCell } from '../../features/inventory/cells'
import { inventoryItemIconOf, inventoryItemNameOf } from '../../features/inventory/item-look'
import { useInventory } from '../../features/inventory/query'
import { useMvpGradeContext } from '../../features/mvp-grade/store'
import { useToastStore } from '../../features/toast/store'
import { mesoValueOf } from '../../components/organisms/MesoPad/meso-pad'
import { ITEM_KIND_KEYS, itemKindNameOf, type ItemKindKey } from '../../lib/cashbook/categories'
import { confirmLabels } from '../../lib/drop/price-card-labels'
import { dropPriceCardRequest } from '../boss-profit/drop-price-card'
import { HuntFragmentSaleSheet } from './HuntFragmentSaleSheet'
import { InventoryAddFab } from './InventoryAddFab'
import { InventoryAddSheet } from './InventoryAddSheet'
import { InventoryEditSheet } from './InventoryEditSheet'
import { InventoryGrid, type CellRect } from './InventoryGrid'
import { InventorySaleSheet } from './InventorySaleSheet'

type Tab = 'all' | ItemKindKey

const TABS: readonly Tab[] = ['all', ...ITEM_KIND_KEYS]

type ItemCell = Extract<InventoryCell, { kind: 'item' }>

type Sheet = { kind: 'huntSale' } | { kind: 'itemSale'; cell: ItemCell } | { kind: 'edit'; cell: ItemCell } | { kind: 'add' }

const SINGLE_CARD = confirmLabels({ 하나: true, 마지막: true, 자리: 0, 전체: 1, 매긴것: 0, 지금매김: false })

export function InventoryScreen(): React.JSX.Element {
  const faq = useFaqSheet('inventory')
  const [now] = useState(() => new Date())
  const { data } = useInventory(now)
  const gradeContext = useMvpGradeContext()
  const [tab, setTab] = useState<Tab>('all')
  const [menu, setMenu] = useState<{ cell: InventoryCell; rect: CellRect | null } | null>(null)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [deleting, setDeleting] = useState<ItemCell | null>(null)

  const cells = (data?.cells ?? []).filter((cell) => tab === 'all' || cell.itemKindKey === tab)

  function fail(message: string): void {
    useToastStore.getState().showError(message)
  }

  async function openDropPriceCard(cell: Extract<InventoryCell, { kind: 'drop' }>): Promise<void> {
    const target = await loadDropForSale(cell.drop).catch(() => null)
    if (target === null) {
      fail('드롭 기록을 불러오지 못했습니다')
      return
    }
    openInputCard(
      dropPriceCardRequest({
        target,
        characterName: data?.faces[cell.drop.ocid]?.name ?? '',
        edit: undefined,
        gradeContext,
        labels: SINGLE_CARD,
        onExclude: () => {
          closeInputCard()
          void skipDrop(cell.drop).catch(() => fail('가격을 저장하지 못했습니다'))
        },
        onConfirm: (next, share, fees) => {
          // 빈 칸이나 0 이면 쓰지 않는다. 0메소는 매긴 것이 아니다.
          if (next === '' || mesoValueOf(next) === 0) return
          void sellDrop(cell.drop, mesoValueOf(next), share ?? target.defaultShare, fees).catch(() =>
            fail('가격을 저장하지 못했습니다'),
          )
        },
      }),
    )
  }

  function choose(cell: InventoryCell, label: string): void {
    setMenu(null)
    if (cell.kind === 'drop') {
      if (label === '판매') void openDropPriceCard(cell)
      // 확인을 묻지 않는다. 드롭 기록 시트의 `가격 수정` 에서 되돌릴 수 있다.
      else void skipDrop(cell.drop).catch(() => fail('가격을 저장하지 못했습니다'))
      return
    }
    if (cell.kind === 'hunt') {
      setSheet({ kind: 'huntSale' })
      return
    }
    if (label === '판매') setSheet({ kind: 'itemSale', cell })
    else if (label === '수정') setSheet({ kind: 'edit', cell })
    else setDeleting(cell)
  }

  return (
    <View testID="screen-Inventory" className="flex-1">
      <ScreenScroll
        header={
          <PageHeader>
            <PageHeaderTitleRow>
              <Text className="text-lg font-bold text-text">인벤토리</Text>
              <FaqButton sheet={faq} />
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        <View className="px-4 pb-4">
          <InventoryTabs
            testID="inventory-tabs"
            options={TABS}
            selected={tab}
            onSelect={setTab}
            labelOf={(value) => (value === 'all' ? '전체' : itemKindNameOf(value))}
          />
          <InventoryGrid cells={cells} faces={data?.faces ?? {}} onPressCell={(cell, rect) => setMenu({ cell, rect })} />
        </View>
      </ScreenScroll>

      {menu !== null && (
        <AnchoredPopover
          testID="inventory-cell-menu"
          ariaLabel={`${inventoryItemNameOf(menu.cell.itemKey)} 메뉴`}
          closeLabel="메뉴 닫기"
          anchor={menu.rect}
          onClose={() => setMenu(null)}
          width={120}
          className="p-1.5"
        >
          {inventoryMenuOf(menu.cell).map((label) => (
            <Pressable
              key={label}
              role="menuitem"
              aria-label={label}
              onPress={() => choose(menu.cell, label)}
              className="h-10 justify-center rounded-[10px] px-3 active:bg-bg"
            >
              <Text className={`text-xs font-semibold ${label === '삭제' ? 'text-error-ink' : 'text-text'}`}>{label}</Text>
            </Pressable>
          ))}
        </AnchoredPopover>
      )}

      {deleting !== null && (
        <NoticeModal
          testId="inventory-delete"
          tone="error"
          title="아이템을 삭제할까요?"
          content={<DeletingItem cell={deleting} owner={data?.owners[deleting.item.id] ?? ''} />}
          action={{ label: '취소', onPress: () => setDeleting(null) }}
          secondaryAction={{
            label: '삭제',
            danger: true,
            onPress: () => {
              const id = deleting.item.id
              setDeleting(null)
              void removeInventoryRemaining(id).catch(() => fail('아이템을 삭제하지 못했습니다'))
            },
          }}
          onClose={() => setDeleting(null)}
        />
      )}

      {sheet?.kind === 'huntSale' && <HuntFragmentSaleSheet onClose={() => setSheet(null)} />}
      {sheet?.kind === 'itemSale' && (
        <InventorySaleSheet cell={sheet.cell} owner={data?.owners[sheet.cell.item.id] ?? ''} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'edit' && (
        <InventoryEditSheet cell={sheet.cell} owner={data?.owners[sheet.cell.item.id] ?? ''} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'add' && (
        // 보고 있던 탭의 종류로 연다. 넣은 뒤 그 탭에 바로 선다. 전체 탭이면 첫 종류(장비)다.
        <InventoryAddSheet initialKind={tab === 'all' ? 'equipment' : tab} onClose={() => setSheet(null)} />
      )}

      <InventoryAddFab onPress={() => setSheet({ kind: 'add' })} />
    </View>
  )
}

/** 삭제 확인의 아이템 블록. 지울 아이템 · 주인 · 남은 개수를 보여 다른 칸을 눌렀으면 지우기 전에 알 수 있다. */
function DeletingItem(props: { cell: ItemCell; owner: string }): React.JSX.Element {
  const icon = inventoryItemIconOf(props.cell.itemKey)
  return (
    <View className="flex-row items-center gap-2.5 rounded-[10px] bg-card-inset px-3 py-2.5">
      {icon === null ? (
        <View style={{ width: 28, height: 28 }} />
      ) : (
        <Image source={icon} style={{ width: 28, height: 28 }} resizeMode="contain" aria-hidden />
      )}
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold text-text">{inventoryItemNameOf(props.cell.itemKey)}</Text>
        <Text className="text-xs text-text-muted" numberOfLines={1}>
          {props.owner}
        </Text>
      </View>
      <Text className="shrink-0 text-sm font-semibold text-text" style={TABULAR_NUMS}>
        {`${props.cell.count.toLocaleString('ko-KR')}개`}
      </Text>
    </View>
  )
}
