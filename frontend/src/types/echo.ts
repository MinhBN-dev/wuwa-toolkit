export interface SubStat {
  type: string
  value: number
}

export interface Character {
  id: string
  name: string
  element: string
  weapon_type: string
  role: string
}

export interface Echo {
  id: string
  character_id: string | null
  character: Character | null
  echo_name: string
  echo_element: string | null
  echo_cost: number
  main_stat_type: string | null
  main_stat_value: number | null
  sub_stats: SubStat[]
  total_er: number | null
  score: number | null
  score_percent: number | null
  tier: string | null
  created_at: string
}

export interface EchoListResponse {
  echoes: Echo[]
  total: number
}

export interface OcrResult {
  echo_name: string
  echo_set: string | null
  echo_element: string | null
  echo_cost: number | null
  main_stat_type: string | null
  main_stat_value: number | null
  sub_stats: SubStat[]
  confidence: number
  raw_text: string | null
  provider?: string | null
}

export interface ScoreRequest {
  character_id?: string
  character_name?: string
  echo_cost: number
  sub_stats: SubStat[]
  total_er?: number
}

export interface ScoreResponse {
  score: number
  score_percent: number
  tier: string
  tier_label?: string | null
  breakdown: Record<string, number>
  max_possible: number
  character_name: string | null
}

export interface EchoCreate {
  character_id?: string
  echo_name: string
  echo_element?: string
  echo_cost: number
  main_stat_type?: string | null
  main_stat_value?: number | null
  sub_stats: SubStat[]
  total_er?: number
  score?: number
  score_percent?: number
  tier?: string
}

export interface EchoSetItem {
  echo_name: string
  sub_stats: SubStat[]
}

export interface SetScoreRequest {
  character_name?: string
  character_id?: string
  echoes: EchoSetItem[]
  total_er?: number
}

export interface EchoSetResult {
  echo_name: string
  score: number
  score_percent: number
  tier: string
  tier_label?: string | null
  breakdown: Record<string, number>
  max_possible: number
}

export interface SetScoreResponse {
  echoes: EchoSetResult[]
  set_score: number
  set_score_raw: number
  set_ep: number
  set_tier: string
  set_tier_label?: string | null
  character_name: string | null
}

export interface EchoSetSlot {
  echo_id: string | null
  echo_name: string
  echo_cost: number
  sub_stats: SubStat[]
  score: number | null
  score_percent: number | null
  tier: string | null
  tier_label: string | null
}

export interface EchoSetSaveRequest {
  name: string
  character_id?: string
  character_name?: string
  total_er?: number
  slots: EchoSetSlot[]
  set_score?: number
  set_tier?: string
}

export interface SavedEchoSet {
  id: string
  name: string
  character_name: string | null
  total_er: number | null
  slots: EchoSetSlot[]
  set_score: number | null
  set_tier: string | null
  created_at: string
}

export interface CharacterProfile {
  character_name: string
  build_status: string    // 'not_built' | 'building' | 'built'
  notes: string | null
}

export interface CharacterProfileUpsert {
  build_status: string
  notes?: string | null
}

// ── Convene tracker ───────────────────────────────────────────────────────────

export interface ConvenePoolImport {
  pool_type: number
  pool_label: string
  fetched: number
  added: number
}

export interface ConveneImportResponse {
  player_id: string
  svr_id: string
  pools: ConvenePoolImport[]
  total_added: number
  total_fetched: number
}

export interface ConvenePullResponse {
  pull_id: string
  name: string
  item_type: string
  quality_level: number
  resource_id: number | null
  time: string
  pity?: number | null
  card_pool_type?: number | null
  pull_no?: number | null
}

export interface ConveneHistoryResponse {
  items: ConvenePullResponse[]
  total: number
  skip: number
  limit: number
}

export interface ConvenePoolStats {
  pool_type: number
  pool_label: string
  total: number
  total_astrites: number
  five_star_count: number
  four_star_count: number
  pity_5: number
  pity_4: number
  avg_pity_5: number | null
  pull_ratio: number | null
  wins_50_50: number | null
  losses_50_50: number | null
  win_rate_50_50: number | null
  five_stars: ConvenePullResponse[]
}

export interface ConveneStatsResponse {
  player_id: string
  last_synced_at: string | null
  pools: ConvenePoolStats[]
}

export interface ConvenePlayerSummary {
  player_id: string
  total_pulls: number
  last_pull_time: string | null
}

export interface CharacterEr {
  er_target: number
  er_imp: number
  er_imp_label: 'Min' | 'Norm' | 'Vital' | 'Max'
}

// ── Team buffs (static lookup table, GET /buffs) ─────────────────────────────

export type BuffTarget = 'team' | 'next' | 'enemy' | 'self'
export type BuffConfidence = 'high' | 'medium' | 'low'

export interface BuffCategory {
  key: string
  label: string
  group: string
  unit: string
}

export interface BuffEntry {
  cat: string
  value: number | null
  text: string | null
  applies_to: string
  target: BuffTarget
  /** 0 = base kit, 1-6 = granted by that Resonance Chain node */
  seq: number
  /** true = supersedes the same-cat base entry instead of stacking on it */
  replaces: boolean
  source: string
  duration: number | null
  condition: string
  confidence: BuffConfidence
}

export interface BuffWeapon {
  name: string
  rarity: number
  type: string
  /** Stat nền của vũ khí — chỉ hiển thị tham khảo, KHÔNG cộng vào bảng */
  base_atk: number | null
  main_stat: { stat: string; value: number } | null
  sources: string[]
  /** Chỉ phần cộng thêm mô tả trong weapon skill */
  buffs: BuffEntry[]
}

export interface BuffCharacter {
  name: string
  element: string | null
  role: string | null
  patch_verified: string
  sources: string[]
  notes: string
  buffs: BuffEntry[]
  /** Vũ khí trấn ở R1; null = nhân vật không có vũ khí trấn */
  weapon: BuffWeapon | null
}

export interface BuffDataResponse {
  categories: BuffCategory[]
  group_order: string[]
  characters: BuffCharacter[]
}

export interface GameData {
  echo_sets: string[]
  echo_elements: string[]
  main_stat_options: Record<string, string[]>
  sub_stat_types: string[]
  sub_stat_max: Record<string, number>
  /** stat display name → list of valid roll values */
  sub_stat_rolls: Record<string, number[]>
  characters: string[]
  /** char_name → { stat_display: weight } for stats with weight > 0 */
  character_weights: Record<string, Record<string, number>>
  /** char_name → { er_target, er_imp, er_imp_label } */
  character_er: Record<string, CharacterEr>
}
