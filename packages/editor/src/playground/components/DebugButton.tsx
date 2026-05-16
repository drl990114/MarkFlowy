import { FC } from "react";

export const DebugButton: FC<{ enableDevTools: boolean; toggleEnableDevTools: () => void }> = ({
  enableDevTools,
  toggleEnableDevTools,
}) => {
  return (
    <button
      className={
        enableDevTools ? 'playground-debug-button-enable' : 'playground-debug-button-disable'
      }
      onClick={() => toggleEnableDevTools()}
      data-testid='playground_debug_button'
    >
      Debug
    </button>
  )
}
