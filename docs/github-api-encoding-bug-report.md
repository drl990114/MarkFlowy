# GitHub API 路径双重编码问题分析报告

## 问题描述

在 GitHub 类型的工作区中打开文件时，接口返回数组而不是单个文件对象，导致前端报错：`"Path" is a directory, not a file. Please select a file to open.`

## 问题定位

### 1. 问题 URL

```
http://localhost:3200/github/repos/drl990114/notes-md/contents/html/async%E5%92%8Cdefer%E5%B1%9E%E6%80%A7%E5%AF%B9%E6%A0%87%E7%AD%BE%E7%9A%84%E5%BD%B1%E5%93%8D.md?ref=main
```

### 2. 根本原因

**双重编码问题**：服务端对已经 URL 编码的路径进行了二次编码。

#### 问题流程

1. **前端发送请求**（已编码）：
   ```
   GET /github/repos/drl990114/notes-md/contents/html/async%E5%92%8Cdefer%E5%B1%9E%E6%80%A7%E5%AF%B9%E6%A0%87%E7%AD%BE%E7%9A%84%E5%BD%B1%E5%93%8D.md?ref=main
   ```

2. **服务端接收参数**（NestJS 自动解码）：
   ```typescript
   path = "html/async%E5%92%8Cdefer%E5%B1%9E%E6%80%A7%E5%AF%B9%E6%A0%87%E7%AD%BE%E7%9A%84%E5%BD%B1%E5%93%8D.md"
   ```
   注意：这里的 `%E5%92%8C` 等编码字符已经被 NestJS 框架自动解码了一次，但实际上可能没有完全解码。

3. **服务端二次编码**（问题所在）：
   ```typescript
   // github.service.ts:99
   const encodedPath = path ? `/${encodeURIComponent(path).replace(/%2F/g, '/')}` : ''
   ```
   
   这导致：
   - 原始路径：`html/async和defer属性对标签的影响.md`
   - 第一次编码（前端）：`html/async%E5%92%8Cdefer%E5%B1%9E%E6%80%A7%E5%AF%B9%E6%A0%87%E7%AD%BE%E7%9A%84%E5%BD%B1%E5%93%8D.md`
   - 第二次编码（服务端）：`html%2Fasync%25E5%2592%258Cdefer%25E5%25B1%259E%25E6%2580%25A7%25E5%25AF%25B9%25E6%25A0%2587%25E7%25AD%25BE%25E7%259A%2584%25E5%25BD%25B1%25E5%2593%258D.md`

4. **GitHub API 收到错误路径**：
   ```
   GET https://api.github.com/repos/drl990114/notes-md/contents/html%2Fasync%25E5%2592%258Cdefer%25E5%25B1%259E%25E6%2580%25A7%25E5%25AF%25B9%25E6%25A0%2587%25E7%25AD%25BE%25E7%259A%2584%25E5%25BD%25B1%25E5%2593%258D.md
   ```

5. **GitHub API 返回错误结果**：
   由于路径编码错误，GitHub API 无法找到正确的文件，可能返回目录内容或错误信息。

### 3. 问题代码位置

**服务端代码**：`/Users/dongruilin/Desktop/repo/me/MarkFlowy-Cloud/src/modules/github/github.service.ts`

```typescript
// 第 99-105 行
async getContents(user: CurrentUserPayload, owner: string, repo: string, path: string, ref?: string) {
  const token = await this.getAccessToken(user.sub)
  const encodedPath = path ? `/${encodeURIComponent(path).replace(/%2F/g, '/')}` : ''  // ❌ 问题在这里
  const qs = new URLSearchParams()
  if (ref) qs.set('ref', ref)
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return this.githubFetch(token, `/repos/${owner}/${repo}/contents${encodedPath}${query}`, { method: 'GET' })
}
```

**前端代码**：`/Users/dongruilin/Desktop/repo/me/markflowy/apps/web/features/githubWorkspace/services/githubService.ts`

```typescript
// 第 68-75 行
getContents(owner: string, repo: string, path: string, ref?: string) {
  const qs = ref ? `?ref=${encodeURIComponent(ref)}` : ''
  const encodedPath = path ? `/${path.split('/').map(encodeURIComponent).join('/')}` : ''  // ✅ 前端编码正确
  return apiClient.get<GitHubContent | GitHubContent[]>(
    `/github/repos/${owner}/${repo}/contents${encodedPath}${qs}`,
  )
}
```

## 解决方案

### 方案一：服务端修复（推荐）

在服务端，应该先解码路径，然后再重新编码，确保编码正确：

```typescript
async getContents(user: CurrentUserPayload, owner: string, repo: string, path: string, ref?: string) {
  const token = await this.getAccessToken(user.sub)
  
  // 先解码，再编码，确保编码正确
  const decodedPath = decodeURIComponent(path)
  const encodedPath = decodedPath ? `/${decodedPath.split('/').map(encodeURIComponent).join('/')}` : ''
  
  const qs = new URLSearchParams()
  if (ref) qs.set('ref', ref)
  const query = qs.toString() ? `?${qs.toString()}` : ''
  
  return this.githubFetch(token, `/repos/${owner}/${repo}/contents${encodedPath}${query}`, { method: 'GET' })
}
```

### 方案二：前端不编码，服务端编码

前端发送未编码的路径，服务端负责编码：

**前端修改**：
```typescript
getContents(owner: string, repo: string, path: string, ref?: string) {
  const qs = ref ? `?ref=${encodeURIComponent(ref)}` : ''
  const pathPart = path ? `/${path}` : ''  // 不编码
  return apiClient.get<GitHubContent | GitHubContent[]>(
    `/github/repos/${owner}/${repo}/contents${pathPart}${qs}`,
  )
}
```

**服务端修改**：
```typescript
async getContents(user: CurrentUserPayload, owner: string, repo: string, path: string, ref?: string) {
  const token = await this.getAccessToken(user.sub)
  const encodedPath = path ? `/${path.split('/').map(encodeURIComponent).join('/')}` : ''
  const qs = new URLSearchParams()
  if (ref) qs.set('ref', ref)
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return this.githubFetch(token, `/repos/${owner}/${repo}/contents${encodedPath}${query}`, { method: 'GET' })
}
```

### 方案三：统一编码规范

制定统一的编码规范：

1. **前端负责编码**：前端在发送请求前对路径进行编码
2. **服务端不编码**：服务端接收到的路径已经是编码好的，直接使用
3. **NestJS 路由参数**：NestJS 的通配符路由参数 `*` 会自动解码一次，需要注意

**推荐使用方案一**，因为它最安全，可以处理各种边界情况。

## 其他需要修复的地方

同样的编码问题也存在于其他方法：

### 1. `createOrUpdateFile` 方法

```typescript
// 第 127-142 行
async createOrUpdateFile(
  user: CurrentUserPayload,
  owner: string,
  repo: string,
  path: string,
  dto: { message: string; content: string; sha?: string; branch?: string },
) {
  const token = await this.getAccessToken(user.sub)
  const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/')  // ❌ 同样的问题
  // ...
}
```

**修复**：
```typescript
const decodedPath = decodeURIComponent(path)
const encodedPath = decodedPath.split('/').map(encodeURIComponent).join('/')
```

### 2. `deleteFile` 方法

```typescript
// 第 144-161 行
async deleteFile(
  user: CurrentUserPayload,
  owner: string,
  repo: string,
  path: string,
  dto: { message: string; sha: string; branch?: string },
) {
  const token = await this.getAccessToken(user.sub)
  const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/')  // ❌ 同样的问题
  // ...
}
```

**修复**：
```typescript
const decodedPath = decodeURIComponent(path)
const encodedPath = decodedPath.split('/').map(encodeURIComponent).join('/')
```

## 测试建议

修复后，需要测试以下场景：

1. **包含中文字符的文件名**：`html/async和defer属性对标签的影响.md`
2. **包含空格的文件名**：`docs/file name with spaces.md`
3. **包含特殊字符的文件名**：`docs/file@name#special.md`
4. **深层嵌套路径**：`a/b/c/d/e/file.md`
5. **根目录文件**：`README.md`

## 相关文件

- **服务端**：
  - `/Users/dongruilin/Desktop/repo/me/MarkFlowy-Cloud/src/modules/github/github.service.ts` - GitHub 服务实现
  - `/Users/dongruilin/Desktop/repo/me/MarkFlowy-Cloud/src/modules/github/github.controller.ts` - GitHub 控制器

- **前端**：
  - `/Users/dongruilin/Desktop/repo/me/markflowy/apps/web/features/githubWorkspace/services/githubService.ts` - GitHub 服务实现

## 参考资料

- [GitHub REST API - Contents](https://docs.github.com/en/rest/repos/contents)
- [URL Encoding - MDN](https://developer.mozilla.org/en-US/docs/Glossary/percent-encoding)
- [NestJS Route Parameters](https://docs.nestjs.com/controllers#route-parameters)
