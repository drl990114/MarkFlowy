import Color from 'color'

const lighten = (color: string, amount: number): string => Color(color).lighten(amount).string()

const darken = (color: string, amount: number): string => Color(color).darken(amount).string()

export { darken, lighten }
