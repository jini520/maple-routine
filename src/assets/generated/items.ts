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
import a26 from '../items/additional_cube.webp'
import a27 from '../items/additional_potential_reset.png'
import a28 from '../items/advanced_boss_rush_boost_potion.webp'
import a29 from '../items/advanced_strength_potion_x.webp'
import a30 from '../items/adversary_resolve.webp'
import a31 from '../items/adversary_resolve_piece.webp'
import a32 from '../items/alleria_elixir.webp'
import a33 from '../items/amazing_positive_chaos_scroll.webp'
import a34 from '../items/arcane_river_spiegelmann.webp'
import a35 from '../items/arcane_symbol_arcana.webp'
import a36 from '../items/arcane_symbol_chew_chew.webp'
import a37 from '../items/arcane_symbol_esfera.webp'
import a38 from '../items/arcane_symbol_lacheln.webp'
import a39 from '../items/arcane_symbol_morass.webp'
import a40 from '../items/arcane_symbol_road_of_vanishing.webp'
import a41 from '../items/arcane_symbol_selection_coupon.webp'
import a42 from '../items/authentic_symbol_arcs.webp'
import a43 from '../items/authentic_symbol_arteria.webp'
import a44 from '../items/authentic_symbol_carcion.webp'
import a45 from '../items/authentic_symbol_cernium.webp'
import a46 from '../items/authentic_symbol_dowonkyung.webp'
import a47 from '../items/authentic_symbol_odium.webp'
import a48 from '../items/authentic_symbol_selection_coupon.webp'
import a49 from '../items/black_circulator.webp'
import a50 from '../items/black_cube.webp'
import a51 from '../items/blueberry_farm_ticket.webp'
import a52 from '../items/boss_ring_box_black.png'
import a53 from '../items/boss_ring_box_green.png'
import a54 from '../items/boss_ring_box_life.png'
import a55 from '../items/boss_ring_box_red.png'
import a56 from '../items/boss_ring_box_white.png'
import a57 from '../items/boss_rush_boost_potion.webp'
import a58 from '../items/box_eternel_adversary.png'
import a59 from '../items/box_eternel_bardrix.png'
import a60 from '../items/box_eternel_bellona.webp'
import a61 from '../items/box_eternel_destiny.webp'
import a62 from '../items/box_eternel_jupiter.png'
import a63 from '../items/box_eternel_kaling.png'
import a64 from '../items/box_eternel_kalos.png'
import a65 from '../items/box_eternel_limbo.png'
import a66 from '../items/box_eternel_maerin.webp'
import a67 from '../items/box_eternel_maleficStar.png'
import a68 from '../items/box_solerda_maerin_high.webp'
import a69 from '../items/bright_boss_eye_acc.webp'
import a70 from '../items/bright_boss_face_acc.png'
import a71 from '../items/bright_boss_merit.png'
import a72 from '../items/bright_boss_pendant.png'
import a73 from '../items/bright_boss_ring.png'
import a74 from '../items/bright_boss_ring2.png'
import a75 from '../items/cerzar.webp'
import a76 from '../items/collector_elixir.webp'
import a77 from '../items/core_gemstone_mirror.png'
import a78 from '../items/core_gemstone_mitra.png'
import a79 from '../items/cube_bronze_additional.png'
import a80 from '../items/cube_gold.png'
import a81 from '../items/cube_silver.png'
import a82 from '../items/dark_boss_badge.png'
import a83 from '../items/dark_boss_belt.png'
import a84 from '../items/dark_boss_box.png'
import a85 from '../items/dark_boss_box_maerin.webp'
import a86 from '../items/dark_boss_complete_heart.png'
import a87 from '../items/dark_boss_earring.png'
import a88 from '../items/dark_boss_emblem.png'
import a89 from '../items/dark_boss_eye_acc.png'
import a90 from '../items/dark_boss_face_acc.png'
import a91 from '../items/dark_boss_pendant.png'
import a92 from '../items/dark_boss_pocket.png'
import a93 from '../items/dark_boss_ring.png'
import a94 from '../items/dawn_boss_earring.png'
import a95 from '../items/dawn_boss_face_acc.png'
import a96 from '../items/dawn_boss_pendant.png'
import a97 from '../items/dawn_boss_ring.png'
import a98 from '../items/equipment_enhancement_scroll.png'
import a99 from '../items/erion_piece.png'
import a100 from '../items/except_belt.png'
import a101 from '../items/except_earring.png'
import a102 from '../items/except_eye_acc.png'
import a103 from '../items/except_face_acc.png'
import a104 from '../items/except_merit.png'
import a105 from '../items/exp_3x_coupon.webp'
import a106 from '../items/exp_4x_coupon.webp'
import a107 from '../items/exp_accumulation_potion.webp'
import a108 from '../items/extra_exp_50_coupon.webp'
import a109 from '../items/frag_destiny.webp'
import a110 from '../items/frag_eternel_bardrix.png'
import a111 from '../items/frag_eternel_bellona.webp'
import a112 from '../items/frag_eternel_jupiter.png'
import a113 from '../items/frag_eternel_limbo.png'
import a114 from '../items/grand_authentic_symbol_geardrak.webp'
import a115 from '../items/grand_authentic_symbol_tallahart.webp'
import a116 from '../items/grandis_spiegelmann.webp'
import a117 from '../items/honor_elixir.webp'
import a118 from '../items/intense_power_crystal_monthly.webp'
import a119 from '../items/intense_power_crystal_weekly.webp'
import a120 from '../items/kaling_link.webp'
import a121 from '../items/kaling_link_piece.webp'
import a122 from '../items/kalos_will.webp'
import a123 from '../items/kalos_will_piece.webp'
import a124 from '../items/karma_amazing_positive_chaos_scroll.webp'
import a125 from '../items/karma_premium_accessory_attack_scroll.webp'
import a126 from '../items/karma_premium_accessory_magic_scroll.webp'
import a127 from '../items/karma_premium_pet_equip_attack_scroll.webp'
import a128 from '../items/karma_premium_pet_equip_magic_scroll.webp'
import a129 from '../items/legendary_blessing_potion.webp'
import a130 from '../items/luminous_moonshine_potion.png'
import a131 from '../items/magic_whetstone.webp'
import a132 from '../items/magical_onehand_attack_scroll.webp'
import a133 from '../items/magical_onehand_magic_scroll.webp'
import a134 from '../items/magical_twohand_attack_scroll.webp'
import a135 from '../items/magical_weapon_scroll_coupon.png'
import a136 from '../items/maleficstar_shard.webp'
import a137 from '../items/maleficstar_shard_piece.webp'
import a138 from '../items/mechaberry_farm_ticket.webp'
import a139 from '../items/meso.webp'
import a140 from '../items/meso_pouch.webp'
import a141 from '../items/mihoroid.webp'
import a142 from '../items/monster_park_ticket.webp'
import a143 from '../items/mvp_extra_exp_70_coupon.webp'
import a144 from '../items/npc_mr_newname.webp'
import a145 from '../items/papulatus_mark.png'
import a146 from '../items/pet_equip_attack_scroll.webp'
import a147 from '../items/pet_equip_innocent_scroll.webp'
import a148 from '../items/pet_equip_magic_scroll.webp'
import a149 from '../items/pet_equip_pure_white_scroll.webp'
import a150 from '../items/pet_equip_return_scroll.webp'
import a151 from '../items/potential_reset.png'
import a152 from '../items/premium_accessory_attack_scroll.webp'
import a153 from '../items/premium_accessory_magic_scroll.webp'
import a154 from '../items/premium_accessory_scroll_coupon.png'
import a155 from '../items/premium_pet_equip_attack_scroll.webp'
import a156 from '../items/premium_pet_equip_magic_scroll.webp'
import a157 from '../items/premium_petequip_scroll_coupon.png'
import a158 from '../items/red_star_potion.webp'
import a159 from '../items/return_scroll.webp'
import a160 from '../items/scroll_10_percent.webp'
import a161 from '../items/seiram_elixir.webp'
import a162 from '../items/selazar_coin.webp'
import a163 from '../items/small_concentrated_exp_accumulation_potion.webp'
import a164 from '../items/small_exp_accumulation_potion.webp'
import a165 from '../items/sol_erda_fragment.webp'
import a166 from '../items/sole_10.png'
import a167 from '../items/sole_1000.webp'
import a168 from '../items/sole_200.png'
import a169 from '../items/sole_500.webp'
import a170 from '../items/soul_ether_1.webp'
import a171 from '../items/soul_ether_2.webp'
import a172 from '../items/soul_ether_3.webp'
import a173 from '../items/soul_ether_4.webp'
import a174 from '../items/soul_weapon_potential.webp'
import a175 from '../items/spell_trace.webp'
import a176 from '../items/union_wealth.webp'
import a177 from '../items/vip_buff_exp.webp'
import a178 from '../items/vip_buff_stats.webp'
import a179 from '../items/vip_sauna_ticket.webp'
import a180 from '../items/wealth_acquisition_potion.webp'
import a181 from '../items/wealth_acquisition_potion_small.webp'
import a182 from '../items/whetstone_faith.png'
import a183 from '../items/whetstone_life.png'

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
  "additional_cube.webp": a26,
  "additional_potential_reset.png": a27,
  "advanced_boss_rush_boost_potion.webp": a28,
  "advanced_strength_potion_x.webp": a29,
  "adversary_resolve.webp": a30,
  "adversary_resolve_piece.webp": a31,
  "alleria_elixir.webp": a32,
  "amazing_positive_chaos_scroll.webp": a33,
  "arcane_river_spiegelmann.webp": a34,
  "arcane_symbol_arcana.webp": a35,
  "arcane_symbol_chew_chew.webp": a36,
  "arcane_symbol_esfera.webp": a37,
  "arcane_symbol_lacheln.webp": a38,
  "arcane_symbol_morass.webp": a39,
  "arcane_symbol_road_of_vanishing.webp": a40,
  "arcane_symbol_selection_coupon.webp": a41,
  "authentic_symbol_arcs.webp": a42,
  "authentic_symbol_arteria.webp": a43,
  "authentic_symbol_carcion.webp": a44,
  "authentic_symbol_cernium.webp": a45,
  "authentic_symbol_dowonkyung.webp": a46,
  "authentic_symbol_odium.webp": a47,
  "authentic_symbol_selection_coupon.webp": a48,
  "black_circulator.webp": a49,
  "black_cube.webp": a50,
  "blueberry_farm_ticket.webp": a51,
  "boss_ring_box_black.png": a52,
  "boss_ring_box_green.png": a53,
  "boss_ring_box_life.png": a54,
  "boss_ring_box_red.png": a55,
  "boss_ring_box_white.png": a56,
  "boss_rush_boost_potion.webp": a57,
  "box_eternel_adversary.png": a58,
  "box_eternel_bardrix.png": a59,
  "box_eternel_bellona.webp": a60,
  "box_eternel_destiny.webp": a61,
  "box_eternel_jupiter.png": a62,
  "box_eternel_kaling.png": a63,
  "box_eternel_kalos.png": a64,
  "box_eternel_limbo.png": a65,
  "box_eternel_maerin.webp": a66,
  "box_eternel_maleficStar.png": a67,
  "box_solerda_maerin_high.webp": a68,
  "bright_boss_eye_acc.webp": a69,
  "bright_boss_face_acc.png": a70,
  "bright_boss_merit.png": a71,
  "bright_boss_pendant.png": a72,
  "bright_boss_ring.png": a73,
  "bright_boss_ring2.png": a74,
  "cerzar.webp": a75,
  "collector_elixir.webp": a76,
  "core_gemstone_mirror.png": a77,
  "core_gemstone_mitra.png": a78,
  "cube_bronze_additional.png": a79,
  "cube_gold.png": a80,
  "cube_silver.png": a81,
  "dark_boss_badge.png": a82,
  "dark_boss_belt.png": a83,
  "dark_boss_box.png": a84,
  "dark_boss_box_maerin.webp": a85,
  "dark_boss_complete_heart.png": a86,
  "dark_boss_earring.png": a87,
  "dark_boss_emblem.png": a88,
  "dark_boss_eye_acc.png": a89,
  "dark_boss_face_acc.png": a90,
  "dark_boss_pendant.png": a91,
  "dark_boss_pocket.png": a92,
  "dark_boss_ring.png": a93,
  "dawn_boss_earring.png": a94,
  "dawn_boss_face_acc.png": a95,
  "dawn_boss_pendant.png": a96,
  "dawn_boss_ring.png": a97,
  "equipment_enhancement_scroll.png": a98,
  "erion_piece.png": a99,
  "except_belt.png": a100,
  "except_earring.png": a101,
  "except_eye_acc.png": a102,
  "except_face_acc.png": a103,
  "except_merit.png": a104,
  "exp_3x_coupon.webp": a105,
  "exp_4x_coupon.webp": a106,
  "exp_accumulation_potion.webp": a107,
  "extra_exp_50_coupon.webp": a108,
  "frag_destiny.webp": a109,
  "frag_eternel_bardrix.png": a110,
  "frag_eternel_bellona.webp": a111,
  "frag_eternel_jupiter.png": a112,
  "frag_eternel_limbo.png": a113,
  "grand_authentic_symbol_geardrak.webp": a114,
  "grand_authentic_symbol_tallahart.webp": a115,
  "grandis_spiegelmann.webp": a116,
  "honor_elixir.webp": a117,
  "intense_power_crystal_monthly.webp": a118,
  "intense_power_crystal_weekly.webp": a119,
  "kaling_link.webp": a120,
  "kaling_link_piece.webp": a121,
  "kalos_will.webp": a122,
  "kalos_will_piece.webp": a123,
  "karma_amazing_positive_chaos_scroll.webp": a124,
  "karma_premium_accessory_attack_scroll.webp": a125,
  "karma_premium_accessory_magic_scroll.webp": a126,
  "karma_premium_pet_equip_attack_scroll.webp": a127,
  "karma_premium_pet_equip_magic_scroll.webp": a128,
  "legendary_blessing_potion.webp": a129,
  "luminous_moonshine_potion.png": a130,
  "magic_whetstone.webp": a131,
  "magical_onehand_attack_scroll.webp": a132,
  "magical_onehand_magic_scroll.webp": a133,
  "magical_twohand_attack_scroll.webp": a134,
  "magical_weapon_scroll_coupon.png": a135,
  "maleficstar_shard.webp": a136,
  "maleficstar_shard_piece.webp": a137,
  "mechaberry_farm_ticket.webp": a138,
  "meso.webp": a139,
  "meso_pouch.webp": a140,
  "mihoroid.webp": a141,
  "monster_park_ticket.webp": a142,
  "mvp_extra_exp_70_coupon.webp": a143,
  "npc_mr_newname.webp": a144,
  "papulatus_mark.png": a145,
  "pet_equip_attack_scroll.webp": a146,
  "pet_equip_innocent_scroll.webp": a147,
  "pet_equip_magic_scroll.webp": a148,
  "pet_equip_pure_white_scroll.webp": a149,
  "pet_equip_return_scroll.webp": a150,
  "potential_reset.png": a151,
  "premium_accessory_attack_scroll.webp": a152,
  "premium_accessory_magic_scroll.webp": a153,
  "premium_accessory_scroll_coupon.png": a154,
  "premium_pet_equip_attack_scroll.webp": a155,
  "premium_pet_equip_magic_scroll.webp": a156,
  "premium_petequip_scroll_coupon.png": a157,
  "red_star_potion.webp": a158,
  "return_scroll.webp": a159,
  "scroll_10_percent.webp": a160,
  "seiram_elixir.webp": a161,
  "selazar_coin.webp": a162,
  "small_concentrated_exp_accumulation_potion.webp": a163,
  "small_exp_accumulation_potion.webp": a164,
  "sol_erda_fragment.webp": a165,
  "sole_10.png": a166,
  "sole_1000.webp": a167,
  "sole_200.png": a168,
  "sole_500.webp": a169,
  "soul_ether_1.webp": a170,
  "soul_ether_2.webp": a171,
  "soul_ether_3.webp": a172,
  "soul_ether_4.webp": a173,
  "soul_weapon_potential.webp": a174,
  "spell_trace.webp": a175,
  "union_wealth.webp": a176,
  "vip_buff_exp.webp": a177,
  "vip_buff_stats.webp": a178,
  "vip_sauna_ticket.webp": a179,
  "wealth_acquisition_potion.webp": a180,
  "wealth_acquisition_potion_small.webp": a181,
  "whetstone_faith.png": a182,
  "whetstone_life.png": a183,
}
