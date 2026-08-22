import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const mergeTailwindClasses = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        'text-ui-caption',
        'text-ui-control',
        'text-ui-body',
        'text-ui-title',
        'text-ui-heading',
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return mergeTailwindClasses(clsx(inputs))
}
