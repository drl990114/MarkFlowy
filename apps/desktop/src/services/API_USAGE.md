# API 服务使用指南

本文档介绍如何使用客户端 API 服务对接服务端接口。

## 配置

在项目根目录创建 `.env` 文件，配置服务端地址：

```env
VITE_API_BASE_URL=http://localhost:3200
```

## 认证

### 1. 初始化认证

在应用启动时初始化认证状态：

```typescript
import { initAuth } from '@/services/auth-store'

// 在应用启动时调用
await initAuth()
```

### 2. 邮箱验证码登录

```typescript
import { authApi, useAuthStore } from '@/services/api'

// 发送验证码
const sendCodeResult = await authApi.sendEmailCode({
  email: 'user@example.com',
  purpose: 'login',
})

if (sendCodeResult.error) {
  console.error('发送验证码失败:', sendCodeResult.error.message)
  return
}

// 验证验证码并登录
const verifyResult = await authApi.verifyEmailCode({
  email: 'user@example.com',
  code: '123456',
  purpose: 'login',
})

if (verifyResult.data) {
  useAuthStore.getState().login(verifyResult.data, verifyResult.data.user)
  console.log('登录成功')
}
```

### 3. GitHub OAuth 登录

```typescript
import { authApi, useAuthStore } from '@/services/api'

// 获取 GitHub OAuth URL
const githubAuthUrl = authApi.getGithubAuthUrl()

// 在浏览器中打开该 URL 进行授权
// 授权后会重定向到前端，并携带 access_token 和 refresh_token
// 在回调页面处理：
const urlParams = new URLSearchParams(window.location.search)
const accessToken = urlParams.get('access_token')
const refreshToken = urlParams.get('refresh_token')

if (accessToken && refreshToken) {
  useAuthStore.getState().setTokens({
    accessToken,
    refreshToken,
  })
}
```

### 4. 登出

```typescript
import { useAuthStore } from '@/services/api'

useAuthStore.getState().logout()
```

## 工作区管理

### 1. 创建工作区

```typescript
import { workspacesApi, WorkspaceType } from '@/services/api'

const result = await workspacesApi.create({
  name: 'My Workspace',
  type: WorkspaceType.LOCAL,
})

if (result.data) {
  console.log('工作区创建成功:', result.data)
}
```

### 2. 创建 GitHub 工作区

```typescript
import { workspacesApi, WorkspaceType } from '@/services/api'

const result = await workspacesApi.create({
  name: 'My GitHub Repo',
  type: WorkspaceType.GITHUB,
  sourceUrl: 'https://github.com/owner/repo',
})

if (result.data) {
  console.log('GitHub 工作区创建成功:', result.data)
}
```

### 3. 获取工作区列表

```typescript
import { workspacesApi } from '@/services/api'

const result = await workspacesApi.list()

if (result.data) {
  console.log('工作区列表:', result.data)
}
```

### 4. 获取工作区详情

```typescript
import { workspacesApi } from '@/services/api'

const result = await workspacesApi.get('workspace-id')

if (result.data) {
  console.log('工作区详情:', result.data)
}
```

### 5. 更新工作区

```typescript
import { workspacesApi } from '@/services/api'

const result = await workspacesApi.update('workspace-id', {
  name: 'New Workspace Name',
})

if (result.data) {
  console.log('工作区更新成功:', result.data)
}
```

### 6. 删除工作区

```typescript
import { workspacesApi } from '@/services/api'

const result = await workspacesApi.remove('workspace-id')

if (result.data) {
  console.log('工作区删除成功')
}
```

### 7. GitHub 工作区文件操作

```typescript
import { workspacesApi } from '@/services/api'

// 获取文件树
const treeResult = await workspacesApi.getTree('workspace-id')
if (treeResult.data) {
  console.log('文件树:', treeResult.data.tree)
}

// 获取文件内容
const contentResult = await workspacesApi.getContents('workspace-id', 'path/to/file.md')
if (contentResult.data) {
  console.log('文件内容:', contentResult.data)
}

// 创建或更新文件
const fileResult = await workspacesApi.createOrUpdateFile(
  'workspace-id',
  'path/to/file.md',
  {
    message: 'Update file',
    content: btoa('File content'), // Base64 编码
  }
)

// 删除文件
const deleteResult = await workspacesApi.deleteFile(
  'workspace-id',
  'path/to/file.md',
  {
    message: 'Delete file',
    sha: 'file-sha',
  }
)
```

## 设置管理

### 1. 获取用户设置

```typescript
import { settingsApi } from '@/services/api'

const result = await settingsApi.getUserSettings()

if (result.data) {
  console.log('用户设置:', result.data)
}
```

### 2. 更新用户设置

```typescript
import { settingsApi } from '@/services/api'

const result = await settingsApi.updateUserSettings({
  version: 1,
  settings: {
    theme: 'dark',
    language: 'zh-CN',
  },
})

if (result.data) {
  console.log('设置更新成功:', result.data)
}
```

### 3. 获取工作区设置

```typescript
import { settingsApi } from '@/services/api'

const result = await settingsApi.getWorkspaceSettings('workspace-id')

if (result.data) {
  console.log('工作区设置:', result.data)
}
```

### 4. 更新工作区设置

```typescript
import { settingsApi } from '@/services/api'

const result = await settingsApi.updateWorkspaceSettings('workspace-id', {
  version: 1,
  settings: {
    autoSave: true,
    fontSize: 14,
  },
})

if (result.data) {
  console.log('工作区设置更新成功:', result.data)
}
```

## GitHub Adapter

### 1. 配置 GitHub Token

```typescript
import { githubApi } from '@/services/api'

// 保存 GitHub Token
const saveResult = await githubApi.saveGithubConfig({
  token: 'your-github-personal-access-token',
})

if (saveResult.data) {
  console.log('GitHub Token 保存成功')
}

// 获取 GitHub 配置
const configResult = await githubApi.getGithubConfig()
if (configResult.data) {
  console.log('GitHub 配置:', configResult.data)
}

// 删除 GitHub Token
const deleteResult = await githubApi.deleteGithubConfig()
if (deleteResult.data) {
  console.log('GitHub Token 删除成功')
}
```

### 2. 获取仓库列表

```typescript
import { githubApi } from '@/services/api'

const result = await githubApi.listRepos({
  sort: 'updated',
  direction: 'desc',
  per_page: '30',
})

if (result.data) {
  console.log('仓库列表:', result.data)
}
```

### 3. 直接操作 GitHub 仓库

```typescript
import { githubApi } from '@/services/api'

// 获取分支列表
const branchesResult = await githubApi.listBranches('owner', 'repo')
if (branchesResult.data) {
  console.log('分支列表:', branchesResult.data)
}

// 获取文件内容
const contentResult = await githubApi.getContents('owner', 'repo', 'path/to/file.md')
if (contentResult.data) {
  console.log('文件内容:', contentResult.data)
}

// 创建或更新文件
const fileResult = await githubApi.createOrUpdateFile(
  'owner',
  'repo',
  'path/to/file.md',
  {
    message: 'Update file',
    content: btoa('File content'),
  }
)

// 创建 Pull Request
const prResult = await githubApi.createPullRequest(
  'owner',
  'repo',
  {
    title: 'New Feature',
    head: 'feature-branch',
    base: 'main',
    body: 'Description of the feature',
  }
)
```

## 错误处理

所有 API 调用都返回统一的响应格式：

```typescript
interface ApiResponse<T> {
  data?: T
  error?: {
    message: string
    statusCode: number
  }
}
```

建议使用以下方式处理错误：

```typescript
const result = await workspacesApi.list()

if (result.error) {
  console.error('请求失败:', result.error.message)
  // 处理错误
  if (result.error.statusCode === 401) {
    // 未授权，跳转到登录页面
  }
  return
}

// 处理成功响应
console.log('数据:', result.data)
```

## 在 React 组件中使用

### 使用 Zustand Store

```typescript
import { useAuthStore } from '@/services/api'

function MyComponent() {
  const { user, isAuthenticated, logout } = useAuthStore()

  if (!isAuthenticated) {
    return <div>请先登录</div>
  }

  return (
    <div>
      <p>欢迎, {user?.displayName || user?.email}</p>
      <button onClick={logout}>登出</button>
    </div>
  )
}
```

### 使用 React Query

```typescript
import { useQuery, useMutation } from '@tanstack/react-query'
import { workspacesApi } from '@/services/api'

function WorkspacesList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const result = await workspacesApi.list()
      if (result.error) {
        throw new Error(result.error.message)
      }
      return result.data
    },
  })

  if (isLoading) return <div>加载中...</div>
  if (error) return <div>错误: {error.message}</div>

  return (
    <ul>
      {data?.map((workspace) => (
        <li key={workspace.id}>{workspace.name}</li>
      ))}
    </ul>
  )
}

function CreateWorkspace() {
  const mutation = useMutation({
    mutationFn: async (name: string) => {
      const result = await workspacesApi.create({ name })
      if (result.error) {
        throw new Error(result.error.message)
      }
      return result.data
    },
    onSuccess: (data) => {
      console.log('创建成功:', data)
    },
  })

  return (
    <button onClick={() => mutation.mutate('New Workspace')}>
      创建工作区
    </button>
  )
}
```

## 注意事项

1. **认证状态管理**：使用 `useAuthStore` 管理认证状态，它会自动处理 token 的存储和刷新。

2. **Token 自动刷新**：当 accessToken 过期时，系统会自动使用 refreshToken 刷新。

3. **错误处理**：所有 API 调用都应该检查 `error` 字段，而不是依赖异常。

4. **类型安全**：所有 API 都有完整的 TypeScript 类型定义，建议使用类型检查。

5. **环境变量**：确保在生产环境中正确配置 `VITE_API_BASE_URL`。
