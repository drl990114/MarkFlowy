import type { CommandFunction, KeyBindings } from '@rme-sdk/core'
import { extension, PlainExtension } from '@rme-sdk/core'
import { NodeSelection } from '@rme-sdk/pm/state'
import {
  editLivePreviewSourceAt,
  updateLivePreviewBlockBehavior,
} from './live-preview-registry'
import type { LivePreviewBlockBehavior } from './live-preview-types'

export interface LivePreviewBlockExtensionOptions {
  behavior?: LivePreviewBlockBehavior
}

@extension<LivePreviewBlockExtensionOptions>({
  defaultOptions: {
    behavior: 'auto',
  },
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: [],
})
export class LivePreviewBlockExtension extends PlainExtension<LivePreviewBlockExtensionOptions> {
  get name() {
    return 'livePreviewBlock' as const
  }

  setLivePreviewBlockBehavior =
    (behavior: LivePreviewBlockBehavior): CommandFunction =>
      ({ dispatch }) => {
        if (!dispatch) {
          return true
        }

        this.setOptions({ behavior })
        updateLivePreviewBlockBehavior(this.store.view, behavior)
        return true
      }

  createCommands() {
    return {
      setLivePreviewBlockBehavior: this.setLivePreviewBlockBehavior,
    }
  }

  createKeymap(): KeyBindings {
    return {
      Enter: ({ state, view }) => {
        if (!(state.selection instanceof NodeSelection)) {
          return false
        }

        return editLivePreviewSourceAt(view ?? this.store.view, state.selection.from)
      },
    }
  }
}

declare global {
  // Remirror discovers extension commands through this namespace augmentation.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Remirror {
    interface AllExtensions {
      livePreviewBlock: LivePreviewBlockExtension
    }
  }
}
