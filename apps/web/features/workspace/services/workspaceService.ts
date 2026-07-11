import { apiClient } from 'utils/apiClient'

export interface WorkspaceMetadata {
  id: string
  name: string
  type: string
  slug: string
  sourceUrl: string | null
}

export const workspaceService = {
  getMetadata(workspaceId: string) {
    return apiClient.get<WorkspaceMetadata>(`/workspaces/${encodeURIComponent(workspaceId)}`)
  },
}
