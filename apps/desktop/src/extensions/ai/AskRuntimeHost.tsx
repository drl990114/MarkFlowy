import useEditorStore from '@/stores/useEditorStore'
import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AskRuntimeSession } from './AskWorkspaceRuntime'
import { getAskWorkspaceKey } from './askWorkspaceKey'

const WorkspaceRuntime = lazy(() => import('./AskWorkspaceRuntime'))

interface AskRuntimeHostValue {
  activate: () => void
  session?: AskRuntimeSession
}

const AskRuntimeHostContext = createContext<AskRuntimeHostValue | undefined>(undefined)

/** Owns an Ask session independently of the dock's replaceable panel view. */
export function AskRuntimeHost({ children }: { children: ReactNode }) {
  const rootPath = useEditorStore((state) => state.folderData?.[0]?.path)
  const workspaceKey = getAskWorkspaceKey(rootPath)
  const [activated, setActivated] = useState(false)
  const [snapshot, setSnapshot] = useState<{
    workspaceKey: string
    session: AskRuntimeSession
  }>()
  const activate = useCallback(() => setActivated(true), [])
  const publishSession = useCallback(
    (session: AskRuntimeSession) => setSnapshot({ workspaceKey, session }),
    [workspaceKey],
  )
  const session = snapshot?.workspaceKey === workspaceKey ? snapshot.session : undefined
  const value = useMemo(() => ({ activate, session }), [activate, session])

  return (
    <AskRuntimeHostContext value={value}>
      {children}
      {activated ? (
        <Suspense fallback={null}>
          <WorkspaceRuntime
            key={workspaceKey}
            onSessionChange={publishSession}
            workspaceKey={workspaceKey}
          />
        </Suspense>
      ) : null}
    </AskRuntimeHostContext>
  )
}

export function useAskRuntimeSession() {
  const host = useContext(AskRuntimeHostContext)
  if (!host) throw new Error('AskPanel must be rendered inside AskRuntimeHost')
  const { activate, session } = host
  useEffect(activate, [activate])
  return session
}
