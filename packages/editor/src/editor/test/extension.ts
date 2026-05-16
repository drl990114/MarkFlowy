import {
  convertCommand,
  ExtensionTag,
  type InputRule,
  type KeyBindings,
  NodeExtension,
  type NodeExtensionSpec,
  type ProsemirrorPlugin,
} from '@rme-sdk/core'

import { createListPlugins, listKeymap } from '@rme-sdk/prosemirror-flat-list'
import {
  listInputRules,
} from "../extensions/List/input-rule"
import { createListSpec } from "../extensions/List/input-rule/schema/node-spec"

export class ListExtension extends NodeExtension {
  static disableExtraAttributes = true

  get name() {
    return 'list' as const
  }

  createTags() {
    return [ExtensionTag.Block]
  }

  createNodeSpec(): NodeExtensionSpec {
    return createListSpec()
  }

  createKeymap(): KeyBindings {
    const bindings: KeyBindings = {}
    for (const [key, command] of Object.entries(listKeymap)) {
      bindings[key] = convertCommand(command)
    }
    return bindings
  }

  createExternalPlugins(): ProsemirrorPlugin[] {
    return createListPlugins({ schema: this.store.schema })
  }

  createInputRules(): InputRule[] {
    return listInputRules
  }
}
