import { invertedEffects } from '@codemirror/commands'
import { MapMode, StateEffect, StateField, type ChangeSet, type Extension } from '@codemirror/state'

type Ending = { pos: number; raw: number; text: string }
type RestoredEnding = Pick<Ending, 'pos' | 'text'>
const normalize = (text: string) => text.replace(/\r\n?/g, '\n')
const lowerBound = (items: readonly number[], position: number) => {
  let low = 0
  let high = items.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (items[middle] < position) low = middle + 1
    else high = middle
  }
  return low
}

/** CodeMirror positions count each line break once; the PM document retains the raw source. */
export class RawTextProjection {
  readonly normalized: string
  readonly endings: Ending[] = []
  private readonly crlfRaw: number[] = []
  private readonly crlfNormalized: number[] = []
  private readonly endingPositions: number[] = []
  private readonly hasCr: boolean

  constructor(readonly raw: string) {
    this.hasCr = raw.includes('\r')
    this.normalized = this.hasCr ? normalize(raw) : raw
    if (!this.hasCr) return
    const pattern = /\r\n|\r|\n/g
    for (const match of raw.matchAll(pattern)) {
      const position = match.index - this.crlfRaw.length
      this.endings.push({ pos: position, raw: match.index, text: match[0] })
      this.endingPositions.push(position)
      if (match[0] === '\r\n') {
        this.crlfRaw.push(match.index)
        this.crlfNormalized.push(position)
      }
    }
  }

  toRaw(position: number): number {
    return position + lowerBound(this.crlfNormalized, position)
  }

  toNormalized(position: number): number {
    return position - lowerBound(this.crlfRaw, position)
  }

  apply(changes: ChangeSet): RawTextProjection {
    const pieces: string[] = []
    let cursor = 0
    changes.iterChanges((from, to, _fromB, _toB, inserted) => {
      const start = this.toRaw(from)
      const end = this.toRaw(to)
      const index = Math.max(0, lowerBound(this.endingPositions, from) - 1)
      const nearest = this.endings[index]?.text ?? '\n'
      pieces.push(this.raw.slice(cursor, start), inserted.toString().replace(/\n/g, nearest))
      cursor = end
    })
    pieces.push(this.raw.slice(cursor))
    return new RawTextProjection(pieces.join(''))
  }

  endingsWithin(from: number, to: number): RestoredEnding[] {
    const result: RestoredEnding[] = []
    if (!this.hasCr) {
      for (
        let pos = this.raw.indexOf('\n', from);
        pos !== -1 && pos < to;
        pos = this.raw.indexOf('\n', pos + 1)
      )
        result.push({ pos, text: '\n' })
      return result
    }
    for (
      let i = lowerBound(this.endingPositions, from);
      i < this.endings.length && this.endings[i].pos < to;
      i++
    ) {
      const { pos, text } = this.endings[i]
      result.push({ pos, text })
    }
    return result
  }

  restore(endings: readonly RestoredEnding[]): RawTextProjection {
    if (!endings.length) return this
    const replacements = new Map(endings.map((ending) => [ending.pos, ending.text]))
    const pieces: string[] = []
    let cursor = 0
    for (const [position, text] of [...replacements].sort(([a], [b]) => a - b)) {
      if (this.normalized[position] !== '\n') continue
      const start = this.toRaw(position)
      const end = this.toRaw(position + 1)
      if (this.raw.slice(start, end) === text) continue
      pieces.push(this.raw.slice(cursor, start), text)
      cursor = end
    }
    if (!pieces.length) return this
    pieces.push(this.raw.slice(cursor))
    return new RawTextProjection(pieces.join(''))
  }
}

export const resetRawText = StateEffect.define<string>()
const restoreEndings = StateEffect.define<readonly RestoredEnding[]>({
  map: (endings, changes) =>
    endings.flatMap(({ pos, text }) => {
      const mapped = changes.mapPos(pos, 1, MapMode.TrackDel)
      return mapped === null ? [] : [{ pos: mapped, text }]
    }),
})

/** Extend the existing CM history with tiny newline effects, without a second undo stack. */
export function rawTextExtension(initial: string): {
  field: StateField<RawTextProjection>
  extension: Extension
} {
  const field = StateField.define<RawTextProjection>({
    create: () => new RawTextProjection(initial),
    update: (previous, transaction) => {
      const reset = transaction.effects.find((effect) => effect.is(resetRawText))
      if (reset) {
        const source = new RawTextProjection(reset.value)
        if (source.normalized !== transaction.newDoc.toString())
          throw new Error('Raw source does not match CodeMirror text')
        return source
      }
      const next = transaction.docChanged ? previous.apply(transaction.changes) : previous
      return next.restore(
        transaction.effects.flatMap((effect) => (effect.is(restoreEndings) ? effect.value : [])),
      )
    },
  })
  const inverse = invertedEffects.of((transaction) => {
    if (!transaction.docChanged) return []
    const previous = transaction.startState.field(field)
    const endings: RestoredEnding[] = []
    transaction.changes.iterChangedRanges((from, to) => {
      endings.push(...previous.endingsWithin(from, to))
    })
    return endings.length ? [restoreEndings.of(endings)] : []
  })
  // Native typing/paste (including multiple selections) follows the surrounding newline style.
  // Complete source replacement supplies resetRawText to retain its explicit line endings.
  return { field, extension: [field, inverse] }
}
