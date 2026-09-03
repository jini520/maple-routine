/**
 * ⚠️ 이 파일은 생성물이다. **손으로 고치지 마라.** 고쳐도 다음 생성에서 사라진다.
 *
 * 만드는 법: `npm run assets:gen` (scripts/generate-asset-manifest.mjs)
 * 무엇: 아이템·반지 아이콘. `lib/item-icons.ts` 가 `iconFile`(확장자 포함)로 찾는다
 * 원본: src/assets/items/*.{png,webp} · src/assets/items/rings/*.{png,webp}
 *
 * 값의 타입은 번들러가 정한다. Metro 는 에셋 id(숫자)를 준다. 그것을
 * 한 줄로 적어 둔 것이 `ImageAssetRef` 다.
 */

import type { ImageAssetRef } from '../../types/image-asset'

import a0 from '../items/rings/Berserker_Ring.png'
import a1 from '../items/rings/Clean_Defense_Ring.png'
import a2 from '../items/rings/Clean_Stance_Ring.png'
import a3 from '../items/rings/Cleansing_Ring.png'
import a4 from '../items/rings/Continuous_Ring.webp'
import a5 from '../items/rings/Crisis_HM_Ring.webp'
import a6 from '../items/rings/Crisis_H_Ring.webp'
import a7 from '../items/rings/Crisis_M_Ring.png'
import a8 from '../items/rings/Critical_Damage_Ring.webp'
import a9 from '../items/rings/Critical_Defense_Ring.png'
import a10 from '../items/rings/Critical_Shift_Ring.png'
import a11 from '../items/rings/Durability_Ring.png'
import a12 from '../items/rings/Health_Cut_Ring.png'
import a13 from '../items/rings/Level_Jump_Ring.png'
import a14 from '../items/rings/Limit_Ring.webp'
import a15 from '../items/rings/Mana_Cut_Ring.png'
import a16 from '../items/rings/Overdrive_Ring.png'
import a17 from '../items/rings/Reflective_Ring.png'
import a18 from '../items/rings/Ring_of_Restraint.webp'
import a19 from '../items/rings/Risk_Taker_Ring.webp'
import a20 from '../items/rings/Stance_Shift_Ring.png'
import a21 from '../items/rings/Swift_Ring.png'
import a22 from '../items/rings/Totalling_Ring.webp'
import a23 from '../items/rings/Tower_Boost_Ring.png'
import a24 from '../items/rings/Ultimatum_Ring.webp'
import a25 from '../items/rings/Weapon_Jump_Ring.webp'
import a26 from '../items/adversary_resolve.webp'
import a27 from '../items/adversary_resolve_piece.webp'
import a28 from '../items/alleria_elixir.webp'
import a29 from '../items/arcane_river_spiegelmann.webp'
import a30 from '../items/black_circulator.webp'
import a31 from '../items/blueberry_farm_ticket.webp'
import a32 from '../items/boss_ring_box_black.png'
import a33 from '../items/boss_ring_box_green.png'
import a34 from '../items/boss_ring_box_life.png'
import a35 from '../items/boss_ring_box_red.png'
import a36 from '../items/boss_ring_box_white.png'
import a37 from '../items/box_eternel_adversary.png'
import a38 from '../items/box_eternel_bardrix.png'
import a39 from '../items/box_eternel_bellona.webp'
import a40 from '../items/box_eternel_destiny.webp'
import a41 from '../items/box_eternel_jupiter.png'
import a42 from '../items/box_eternel_kaling.png'
import a43 from '../items/box_eternel_kalos.png'
import a44 from '../items/box_eternel_limbo.png'
import a45 from '../items/box_eternel_maerin.webp'
import a46 from '../items/box_eternel_maleficStar.png'
import a47 from '../items/box_solerda_maerin_high.webp'
import a48 from '../items/bright_boss_eye_acc.webp'
import a49 from '../items/bright_boss_face_acc.png'
import a50 from '../items/bright_boss_merit.png'
import a51 from '../items/bright_boss_pendant.png'
import a52 from '../items/bright_boss_ring.png'
import a53 from '../items/bright_boss_ring2.png'
import a54 from '../items/cerzar.webp'
import a55 from '../items/collector_elixir.webp'
import a56 from '../items/core_gemstone_mirror.png'
import a57 from '../items/core_gemstone_mitra.png'
import a58 from '../items/cube_bronze_additional.png'
import a59 from '../items/cube_gold.png'
import a60 from '../items/cube_silver.png'
import a61 from '../items/dark_boss_badge.png'
import a62 from '../items/dark_boss_belt.png'
import a63 from '../items/dark_boss_box.png'
import a64 from '../items/dark_boss_box_maerin.webp'
import a65 from '../items/dark_boss_complete_heart.png'
import a66 from '../items/dark_boss_earring.png'
import a67 from '../items/dark_boss_emblem.png'
import a68 from '../items/dark_boss_eye_acc.png'
import a69 from '../items/dark_boss_face_acc.png'
import a70 from '../items/dark_boss_pendant.png'
import a71 from '../items/dark_boss_pocket.png'
import a72 from '../items/dark_boss_ring.png'
import a73 from '../items/dawn_boss_earring.png'
import a74 from '../items/dawn_boss_face_acc.png'
import a75 from '../items/dawn_boss_pendant.png'
import a76 from '../items/dawn_boss_ring.png'
import a77 from '../items/erion_piece.png'
import a78 from '../items/except_belt.png'
import a79 from '../items/except_earring.png'
import a80 from '../items/except_eye_acc.png'
import a81 from '../items/except_face_acc.png'
import a82 from '../items/except_merit.png'
import a83 from '../items/frag_destiny.webp'
import a84 from '../items/frag_eternel_bardrix.png'
import a85 from '../items/frag_eternel_bellona.webp'
import a86 from '../items/frag_eternel_jupiter.png'
import a87 from '../items/frag_eternel_limbo.png'
import a88 from '../items/grandis_spiegelmann.webp'
import a89 from '../items/honor_elixir.webp'
import a90 from '../items/intense_power_crystal_monthly.webp'
import a91 from '../items/intense_power_crystal_weekly.webp'
import a92 from '../items/kaling_link.webp'
import a93 from '../items/kaling_link_piece.webp'
import a94 from '../items/kalos_will.webp'
import a95 from '../items/kalos_will_piece.webp'
import a96 from '../items/luminous_moonshine_potion.png'
import a97 from '../items/magical_weapon_scroll_coupon.png'
import a98 from '../items/maleficstar_shard.webp'
import a99 from '../items/maleficstar_shard_piece.webp'
import a100 from '../items/mechaberry_farm_ticket.webp'
import a101 from '../items/meso_pouch.webp'
import a102 from '../items/mihoroid.webp'
import a103 from '../items/monster_park_ticket.webp'
import a104 from '../items/npc_mr_newname.webp'
import a105 from '../items/papulatus_mark.png'
import a106 from '../items/premium_accessory_scroll_coupon.png'
import a107 from '../items/premium_petequip_scroll_coupon.png'
import a108 from '../items/seiram_elixir.webp'
import a109 from '../items/sol_erda_fragment.webp'
import a110 from '../items/sole_10.png'
import a111 from '../items/sole_1000.webp'
import a112 from '../items/sole_200.png'
import a113 from '../items/sole_500.webp'
import a114 from '../items/spell_trace.webp'
import a115 from '../items/union_wealth.webp'
import a116 from '../items/vip_sauna_ticket.webp'
import a117 from '../items/wealth_acquisition_potion.webp'
import a118 from '../items/wealth_acquisition_potion_small.webp'
import a119 from '../items/whetstone_faith.png'
import a120 from '../items/whetstone_life.png'

export const ITEM_ASSETS: Record<string, ImageAssetRef> = {
  "Berserker_Ring.png": a0,
  "Clean_Defense_Ring.png": a1,
  "Clean_Stance_Ring.png": a2,
  "Cleansing_Ring.png": a3,
  "Continuous_Ring.webp": a4,
  "Crisis_HM_Ring.webp": a5,
  "Crisis_H_Ring.webp": a6,
  "Crisis_M_Ring.png": a7,
  "Critical_Damage_Ring.webp": a8,
  "Critical_Defense_Ring.png": a9,
  "Critical_Shift_Ring.png": a10,
  "Durability_Ring.png": a11,
  "Health_Cut_Ring.png": a12,
  "Level_Jump_Ring.png": a13,
  "Limit_Ring.webp": a14,
  "Mana_Cut_Ring.png": a15,
  "Overdrive_Ring.png": a16,
  "Reflective_Ring.png": a17,
  "Ring_of_Restraint.webp": a18,
  "Risk_Taker_Ring.webp": a19,
  "Stance_Shift_Ring.png": a20,
  "Swift_Ring.png": a21,
  "Totalling_Ring.webp": a22,
  "Tower_Boost_Ring.png": a23,
  "Ultimatum_Ring.webp": a24,
  "Weapon_Jump_Ring.webp": a25,
  "adversary_resolve.webp": a26,
  "adversary_resolve_piece.webp": a27,
  "alleria_elixir.webp": a28,
  "arcane_river_spiegelmann.webp": a29,
  "black_circulator.webp": a30,
  "blueberry_farm_ticket.webp": a31,
  "boss_ring_box_black.png": a32,
  "boss_ring_box_green.png": a33,
  "boss_ring_box_life.png": a34,
  "boss_ring_box_red.png": a35,
  "boss_ring_box_white.png": a36,
  "box_eternel_adversary.png": a37,
  "box_eternel_bardrix.png": a38,
  "box_eternel_bellona.webp": a39,
  "box_eternel_destiny.webp": a40,
  "box_eternel_jupiter.png": a41,
  "box_eternel_kaling.png": a42,
  "box_eternel_kalos.png": a43,
  "box_eternel_limbo.png": a44,
  "box_eternel_maerin.webp": a45,
  "box_eternel_maleficStar.png": a46,
  "box_solerda_maerin_high.webp": a47,
  "bright_boss_eye_acc.webp": a48,
  "bright_boss_face_acc.png": a49,
  "bright_boss_merit.png": a50,
  "bright_boss_pendant.png": a51,
  "bright_boss_ring.png": a52,
  "bright_boss_ring2.png": a53,
  "cerzar.webp": a54,
  "collector_elixir.webp": a55,
  "core_gemstone_mirror.png": a56,
  "core_gemstone_mitra.png": a57,
  "cube_bronze_additional.png": a58,
  "cube_gold.png": a59,
  "cube_silver.png": a60,
  "dark_boss_badge.png": a61,
  "dark_boss_belt.png": a62,
  "dark_boss_box.png": a63,
  "dark_boss_box_maerin.webp": a64,
  "dark_boss_complete_heart.png": a65,
  "dark_boss_earring.png": a66,
  "dark_boss_emblem.png": a67,
  "dark_boss_eye_acc.png": a68,
  "dark_boss_face_acc.png": a69,
  "dark_boss_pendant.png": a70,
  "dark_boss_pocket.png": a71,
  "dark_boss_ring.png": a72,
  "dawn_boss_earring.png": a73,
  "dawn_boss_face_acc.png": a74,
  "dawn_boss_pendant.png": a75,
  "dawn_boss_ring.png": a76,
  "erion_piece.png": a77,
  "except_belt.png": a78,
  "except_earring.png": a79,
  "except_eye_acc.png": a80,
  "except_face_acc.png": a81,
  "except_merit.png": a82,
  "frag_destiny.webp": a83,
  "frag_eternel_bardrix.png": a84,
  "frag_eternel_bellona.webp": a85,
  "frag_eternel_jupiter.png": a86,
  "frag_eternel_limbo.png": a87,
  "grandis_spiegelmann.webp": a88,
  "honor_elixir.webp": a89,
  "intense_power_crystal_monthly.webp": a90,
  "intense_power_crystal_weekly.webp": a91,
  "kaling_link.webp": a92,
  "kaling_link_piece.webp": a93,
  "kalos_will.webp": a94,
  "kalos_will_piece.webp": a95,
  "luminous_moonshine_potion.png": a96,
  "magical_weapon_scroll_coupon.png": a97,
  "maleficstar_shard.webp": a98,
  "maleficstar_shard_piece.webp": a99,
  "mechaberry_farm_ticket.webp": a100,
  "meso_pouch.webp": a101,
  "mihoroid.webp": a102,
  "monster_park_ticket.webp": a103,
  "npc_mr_newname.webp": a104,
  "papulatus_mark.png": a105,
  "premium_accessory_scroll_coupon.png": a106,
  "premium_petequip_scroll_coupon.png": a107,
  "seiram_elixir.webp": a108,
  "sol_erda_fragment.webp": a109,
  "sole_10.png": a110,
  "sole_1000.webp": a111,
  "sole_200.png": a112,
  "sole_500.webp": a113,
  "spell_trace.webp": a114,
  "union_wealth.webp": a115,
  "vip_sauna_ticket.webp": a116,
  "wealth_acquisition_potion.webp": a117,
  "wealth_acquisition_potion_small.webp": a118,
  "whetstone_faith.png": a119,
  "whetstone_life.png": a120,
}
