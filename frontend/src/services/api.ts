import axios from 'axios'
import type {
  Character, Echo, EchoCreate, EchoListResponse,
  OcrResult, ScoreRequest, ScoreResponse, GameData,
  SetScoreRequest, SetScoreResponse,
  EchoSetSaveRequest, SavedEchoSet,
} from '../types/echo'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 60000,
})

// Characters
export const getCharacters = () =>
  api.get<Character[]>('/characters').then(r => r.data)

export const getGameData = () =>
  api.get<GameData>('/characters/game-data').then(r => r.data)

// Echoes
export const getEchoes = (params?: { character_id?: string; skip?: number; limit?: number }) =>
  api.get<EchoListResponse>('/echoes', { params }).then(r => r.data)

export const findOrCreateEcho = (data: EchoCreate) =>
  api.post<Echo>('/echoes/find-or-create', data).then(r => r.data)

export const deleteEcho = (id: string) =>
  api.delete(`/echoes/${id}`)

// OCR
export const extractEchoStats = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post<OcrResult>('/ocr/extract', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 90000,
  }).then(r => r.data)
}

// Scoring
export const calculateScore = (data: ScoreRequest) =>
  api.post<ScoreResponse>('/score/calculate', data).then(r => r.data)

export const calculateSetScore = (data: SetScoreRequest) =>
  api.post<SetScoreResponse>('/score/calculate-set', data).then(r => r.data)

// EVC Status
export const getEvcStatus = () =>
  api.get<{
    has_update: boolean
    latest_date: string | null
    latest_date_display: string | null
    latest_entries: string[]
    acknowledged_date: string | null
    checked_at: string
    error?: string
  }>('/evc-status').then(r => r.data)

export const acknowledgeEvcUpdate = (date: string) =>
  api.post('/evc-status/acknowledge', { date }).then(r => r.data)

// Echo Sets
export const saveEchoSet = (data: EchoSetSaveRequest) =>
  api.post<SavedEchoSet>('/sets', data).then(r => r.data)

export const getEchoSets = () =>
  api.get<SavedEchoSet[]>('/sets').then(r => r.data)

export const deleteEchoSet = (id: string) =>
  api.delete(`/sets/${id}`)
