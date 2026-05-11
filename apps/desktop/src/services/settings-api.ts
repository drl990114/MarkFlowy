import { apiClient } from './api-client'

export interface Settings {
  version: number
  settings: Record<string, any>
}

export interface UpdateSettingsParams {
  version: number
  settings: Record<string, any>
}

export const settingsApi = {
  getUserSettings: async () => {
    return apiClient.get<Settings>('/me/settings')
  },

  updateUserSettings: async (params: UpdateSettingsParams) => {
    return apiClient.put<Settings>('/me/settings', params)
  },

  getWorkspaceSettings: async (workspaceId: string) => {
    return apiClient.get<Settings>(`/workspaces/${workspaceId}/settings`)
  },

  updateWorkspaceSettings: async (workspaceId: string, params: UpdateSettingsParams) => {
    return apiClient.put<Settings>(`/workspaces/${workspaceId}/settings`, params)
  },
}
