/**
 * 붙일 게임 데이터 표가 없는 앱 그림(`appImages` 칸) 조회. 줄마다 앱 코드가 찾는 key 와 그림 id 를 든다.
 *
 * key 는 앱 코드가 정한다. 서버 표에 없는 key 는 그림 없이 선다.
 */
import type { AppImageRow, AppImagesTable } from '../../types/game-data'
import type { DownloadedImage } from '../../types/image-asset'
import { isNonEmptyString, isRow, rowsOf, uniqueBy, updatedAtOf, type Row } from '../game-data/contract'
import { derive, gameTable } from '../game-data/table'
import { assetImage } from './asset-files'

/** 앱 코드가 찾는 그림. 드롭 연출 프레임은 단계마다 번호가 붙어 `appImageFrames` 로 모은다. */
export const APP_IMAGE_KEYS = [
  'boss_crystal_weekly',
  'boss_crystal_monthly',
  'enhancement_cube_reset',
  'enhancement_starforce',
  'enhancement_potential',
  'enhancement_additional_potential',
  'enhancement_soul_potential',
  'meso_pouch',
  'union_wealth',
  'selazar_coin',
  'sol_erda_energy_1000',
  'sol_erda_energy_500',
  'sol_erda_energy_200',
  'sol_erda_energy_10',
  'arcane_force',
  'authentic_force',
  'unknown_character',
] as const
export type AppImageKey = (typeof APP_IMAGE_KEYS)[number]

/** 드롭 연출의 단계. 프레임 key 는 `drop_effect_<단계>_<번호>` 다. */
export const DROP_EFFECT_STAGES = ['screen', 'pre', 'loop', 'end'] as const
export type DropEffectStage = (typeof DROP_EFFECT_STAGES)[number]

function toImage(row: Row): AppImageRow | null {
  if (!isNonEmptyString(row.key) || !isNonEmptyString(row.assetId)) return null
  return { key: row.key, assetId: row.assetId }
}

/** 계약을 지킨 값만 통과시킨다. 어긴 값은 표 전체가 `null` 이다. */
export function parseAppImages(value: unknown): AppImagesTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const images = rowsOf(value.images, toImage)
  if (images === null || !uniqueBy(images, (image) => image.key)) return null
  return { updatedAt, images }
}

export const appImagesTable = gameTable<AppImagesTable>('appImages', { updatedAt: null, images: [] }, parseAppImages)

const byKey = derive(appImagesTable, (table) => new Map(table.images.map((image) => [image.key, image.assetId])))

/** key 의 그림. 표나 그림 목록에 없으면 `null` 이고 화면은 그림 없이 선다. */
export function appImage(key: AppImageKey): DownloadedImage | null {
  return assetImage(byKey().get(key))
}

/** 한 단계의 연출 프레임을 번호 차례로. 글자 차례면 `10` 이 `2` 앞에 서서 프레임이 뒤섞인다. */
export function appImageFrames(stage: DropEffectStage): DownloadedImage[] {
  const pattern = new RegExp(`^drop_effect_${stage}_(\\d+)$`)
  return appImagesTable
    .get()
    .images.flatMap((image) => {
      const index = pattern.exec(image.key)
      return index === null ? [] : [{ index: Number(index[1]), assetId: image.assetId }]
    })
    .sort((a, b) => a.index - b.index)
    .flatMap(({ assetId }) => assetImage(assetId) ?? [])
}
