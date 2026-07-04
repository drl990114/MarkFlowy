import type { CommandFunction } from '@rme-sdk/core'
import { extension, PlainExtension } from '@rme-sdk/core'
import { CurrentDateFormatOption, formatCurrentDate } from '../../utils/date'

type DateExtensionOptions = {
  currentDateFormat?: CurrentDateFormatOption
}

@extension<DateExtensionOptions>({
  defaultOptions: {},
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: [],
})
export class DateExtension extends PlainExtension<DateExtensionOptions> {
  get name() {
    return 'date' as const
  }

  insertCurrentDate = (): CommandFunction => {
    return ({ tr, dispatch }) => {
      if (!dispatch) {
        return true
      }

      dispatch(tr.insertText(formatCurrentDate(this.options.currentDateFormat)).scrollIntoView())
      return true
    }
  }

  createCommands() {
    return {
      insertCurrentDate: this.insertCurrentDate,
    }
  }
}
