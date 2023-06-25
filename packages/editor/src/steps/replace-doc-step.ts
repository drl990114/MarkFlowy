import type { Node, Schema } from '@remirror/pm/model'
import { Step, StepMap, StepResult } from '@remirror/pm/transform'

// Replace the document with a new document.
export class ReplaceDocStep extends Step {
  constructor(readonly doc: Node) {
    super()
  }

  apply(doc: Node) {
    return StepResult.ok(doc)
  }

  getMap() {
    return StepMap.empty
  }

  invert(doc: Node) {
    return new ReplaceDocStep(doc)
  }

  map() {
    return null
  }

  merge(other: Step) {
    return null
  }

  toJSON(): any {
    return { stepType: 'replaceDoc', doc: this.doc.toJSON() }
  }

  /// @internal
  static fromJSON(schema: Schema, json: any) {
    const doc = schema.nodeFromJSON(json.doc)
    return new ReplaceDocStep(doc)
  }
}

try {
  Step.jsonID('replaceDoc', ReplaceDocStep)
} catch (error) {
  
}
