export { apiClient } from './api-client'
export type { ApiResponse, RequestConfig } from '@markflowy/api-client'

export { authApi } from './auth-api'
export type {
  SendEmailCodeParams,
  VerifyEmailCodeParams,
} from './auth-api'
export type { AuthTokens, User } from '@markflowy/types'

export { workspacesApi, WorkspaceType, WorkspaceRole } from './workspaces-api'
export type {
  Workspace,
  WorkspaceMember,
  WorkspaceSettings,
  CreateWorkspaceParams,
  UpdateWorkspaceParams,
  UpsertWorkspaceMemberParams,
  GetContentsParams,
  GitHubTreeItem,
  GitHubFileContent,
  GitHubBranch,
} from './workspaces-api'

export { settingsApi } from './settings-api'
export type { Settings, UpdateSettingsParams } from './settings-api'

export { githubApi } from './github-api'
export type {
  GitHubConfig,
  SaveGithubConfigParams,
  ListReposParams,
  GitHubRepository,
  CreatePullRequestParams,
  GitHubPullRequest,
} from './github-api'
export type { CreateOrUpdateFileParams, DeleteFileParams } from '@markflowy/github-api'
