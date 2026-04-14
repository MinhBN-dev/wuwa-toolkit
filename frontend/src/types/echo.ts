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
  echo_set: string | null
  echo_element: string | null
  echo_cost: number
  main_stat_type: string
  main_stat_value: number
  sub_stats: SubStat[]
  total_er: number | null
  score: number | null
  score_percent: number | null
  tier: string | null
  image_path: string | null
  notes: string | null
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
  echo_set?: string
  echo_element?: string
  echo_cost: number
  sub_stats: SubStat[]
  total_er?: number
  score?: number
  score_percent?: number
  tier?: string
  notes?: string
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

export interface CharacterEr {
  er_target: number
  er_imp: number
  er_imp_label: 'Min' | 'Norm' | 'Vital' | 'Max'
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
