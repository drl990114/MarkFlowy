interface HSLType {
  h: number
  s: number
  l: number
}

interface RGBType {
  r: number
  g: number
  b: number
}

interface ColorValueType {
  type: '%' | 'i' | 'f'
  val: number
}

/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param h The hue
 * @param s The saturation
 * @param l The lightness
 * @returns The RGB representation
 */
const HSL2RGB = (h: number, s: number, l: number): RGBType => {
  let r: number
  let g: number
  let b: number

  if (h < 0) h = 0
  if (h > 1) h = 1

  if (s < 0) s = 0
  if (s > 1) s = 1

  if (l < 0) l = 0
  if (l > 1) l = 1

  if (s == 0) {
    r = g = b = l // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q

    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return {
    r: r * 255,
    g: g * 255,
    b: b * 255,
  }
}

/**
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 *
 * @param r The red color value
 * @param g The green color value
 * @param b The blue color value
 * @returns The HSL representation
 */
const RGB2HSL = (r: number, g: number, b: number): HSLType => {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)

  let h = (max + min) / 2
  let s = (max + min) / 2
  const l = (max + min) / 2

  if (max == min) {
    h = s = 0 // achromatic
  } else {
    const d = max - min

    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }

    h /= 6
  }

  return { h, s, l }
}

/**
 * Converts a HEX color value to RGB by extracting R, G and B values from string using regex.
 * Returns r, g, and b values in range [0, 255]. Does not support RGBA colors just yet.
 *
 * @param hex The color value
 * @returns The RGB representation or {@code null} if the string value is invalid
 */
const HEX2RGB = (hex: string): RGBType | null => {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i

  hex = hex.replace(shorthandRegex, (_match, r, g, b) => {
    return r + r + g + g + b + b
  })

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)

  if (!result) {
    return null
  }

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}

/**
 * Converts RGB values into HEX color string. Assumes all values are in range [0, 255].
 *
 * @param r Red color value
 * @param g Green color value
 * @param b Blue color value
 * @returns HEX color string
 */
const RGB2HEX = (r: number, g: number, b: number): string =>
  '#' +
  Math.floor((1 << 24) + (r << 16) + (g << 8) + b)
    .toString(16)
    .slice(1)

/**
 * Tries to match color' symbolic name into a triple of RGB color components.
 *
 * @param name Color name
 * @returns Color in RGB format or black color (default value)
 */
const NAME2RGB = (name: string): RGBType => {
  const COLORS = new Map([
    ['aliceblue', [240, 248, 255]],
    ['antiquewhite', [250, 235, 215]],
    ['aqua', [0, 255, 255]],
    ['aquamarine', [127, 255, 212]],
    ['azure', [240, 255, 255]],
    ['beige', [245, 245, 220]],
    ['bisque', [255, 228, 196]],
    ['black', [0, 0, 0]],
    ['blanchedalmond', [255, 235, 205]],
    ['blue', [0, 0, 255]],
    ['blueviolet', [138, 43, 226]],
    ['brown', [165, 42, 42]],
    ['burlywood', [222, 184, 135]],
    ['cadetblue', [95, 158, 160]],
    ['chartreuse', [127, 255, 0]],
    ['chocolate', [210, 105, 30]],
    ['coral', [255, 127, 80]],
    ['cornflowerblue', [100, 149, 237]],
    ['cornsilk', [255, 248, 220]],
    ['crimson', [220, 20, 60]],
    ['cyan', [0, 255, 255]],
    ['darkblue', [0, 0, 139]],
    ['darkcyan', [0, 139, 139]],
    ['darkgoldenrod', [184, 132, 11]],
    ['darkgray', [169, 169, 169]],
    ['darkgreen', [0, 100, 0]],
    ['darkgrey', [169, 169, 169]],
    ['darkkhaki', [189, 183, 107]],
    ['darkmagenta', [139, 0, 139]],
    ['darkolivegreen', [85, 107, 47]],
    ['darkorange', [255, 140, 0]],
    ['darkorchid', [153, 50, 204]],
    ['darkred', [139, 0, 0]],
    ['darksalmon', [233, 150, 122]],
    ['darkseagreen', [143, 188, 143]],
    ['darkslateblue', [72, 61, 139]],
    ['darkslategray', [47, 79, 79]],
    ['darkslategrey', [47, 79, 79]],
    ['darkturquoise', [0, 206, 209]],
    ['darkviolet', [148, 0, 211]],
    ['deeppink', [255, 20, 147]],
    ['deepskyblue', [0, 191, 255]],
    ['dimgray', [105, 105, 105]],
    ['dimgrey', [105, 105, 105]],
    ['dodgerblue', [30, 144, 255]],
    ['firebrick', [178, 34, 34]],
    ['floralwhite', [255, 255, 240]],
    ['forestgreen', [34, 139, 34]],
    ['fuchsia', [255, 0, 255]],
    ['gainsboro', [220, 220, 220]],
    ['ghostwhite', [248, 248, 255]],
    ['gold', [255, 215, 0]],
    ['goldenrod', [218, 165, 32]],
    ['gray', [128, 128, 128]],
    ['green', [0, 128, 0]],
    ['greenyellow', [173, 255, 47]],
    ['grey', [128, 128, 128]],
    ['honeydew', [240, 255, 240]],
    ['hotpink', [255, 105, 180]],
    ['indianred', [205, 92, 92]],
    ['indigo', [75, 0, 130]],
    ['ivory', [255, 255, 240]],
    ['khaki', [240, 230, 140]],
    ['lavender', [230, 230, 250]],
    ['lavenderblush', [255, 240, 245]],
    ['lawngreen', [124, 252, 0]],
    ['lemonchiffon', [255, 250, 205]],
    ['lightblue', [173, 216, 230]],
    ['lightcoral', [240, 128, 128]],
    ['lightcyan', [224, 255, 255]],
    ['lightgoldenrodyellow', [250, 250, 210]],
    ['lightgray', [211, 211, 211]],
    ['lightgreen', [144, 238, 144]],
    ['lightgrey', [211, 211, 211]],
    ['lightpink', [255, 182, 193]],
    ['lightsalmon', [255, 160, 122]],
    ['lightseagreen', [32, 178, 170]],
    ['lightskyblue', [135, 206, 250]],
    ['lightslategray', [119, 136, 153]],
    ['lightslategrey', [119, 136, 153]],
    ['lightsteelblue', [176, 196, 222]],
    ['lightyellow', [255, 255, 224]],
    ['lime', [0, 255, 0]],
    ['limegreen', [50, 205, 50]],
    ['linen', [250, 240, 230]],
    ['magenta', [255, 0, 255]],
    ['maroon', [128, 0, 0]],
    ['mediumaquamarine', [102, 205, 170]],
    ['mediumblue', [0, 0, 205]],
    ['mediumorchid', [186, 85, 211]],
    ['mediumpurple', [147, 112, 219]],
    ['mediumseagreen', [60, 179, 113]],
    ['mediumslateblue', [123, 104, 238]],
    ['mediumspringgreen', [0, 250, 154]],
    ['mediumturquoise', [72, 209, 204]],
    ['mediumvioletred', [199, 21, 133]],
    ['midnightblue', [25, 25, 112]],
    ['mintcream', [245, 255, 250]],
    ['mistyrose', [255, 228, 225]],
    ['moccasin', [255, 228, 181]],
    ['navajowhite', [255, 222, 173]],
    ['navy', [0, 0, 128]],
    ['oldlace', [253, 245, 230]],
    ['olive', [128, 128, 0]],
    ['olivedrab', [107, 142, 35]],
    ['orange', [255, 165, 0]],
    ['orangered', [255, 69, 0]],
    ['orchid', [218, 112, 214]],
    ['palegoldenrod', [238, 232, 170]],
    ['palegreen', [152, 251, 152]],
    ['paleturquoise', [175, 238, 238]],
    ['palevioletred', [219, 112, 147]],
    ['papayawhip', [255, 239, 213]],
    ['peachpuff', [255, 218, 185]],
    ['peru', [205, 133, 63]],
    ['pink', [255, 192, 203]],
    ['plum', [221, 160, 203]],
    ['powderblue', [176, 224, 230]],
    ['purple', [128, 0, 128]],
    ['red', [255, 0, 0]],
    ['rosybrown', [188, 143, 143]],
    ['royalblue', [65, 105, 225]],
    ['saddlebrown', [139, 69, 19]],
    ['salmon', [250, 128, 114]],
    ['sandybrown', [244, 164, 96]],
    ['seagreen', [46, 139, 87]],
    ['seashell', [255, 245, 238]],
    ['sienna', [160, 82, 45]],
    ['silver', [192, 192, 192]],
    ['skyblue', [135, 206, 235]],
    ['slateblue', [106, 90, 205]],
    ['slategray', [119, 128, 144]],
    ['slategrey', [119, 128, 144]],
    ['snow', [255, 255, 250]],
    ['springgreen', [0, 255, 127]],
    ['steelblue', [70, 130, 180]],
    ['tan', [210, 180, 140]],
    ['teal', [0, 128, 128]],
    ['thistle', [216, 191, 216]],
    ['tomato', [255, 99, 71]],
    ['turquoise', [64, 224, 208]],
    ['violet', [238, 130, 238]],
    ['wheat', [245, 222, 179]],
    ['white', [255, 255, 255]],
    ['whitesmoke', [245, 245, 245]],
    ['yellow', [255, 255, 0]],
    ['yellowgreen', [154, 205, 5]],
  ])

  const color: number[] = COLORS.get(name) || [0, 0, 0]

  return {
    r: color[0],
    g: color[1],
    b: color[2],
  }
}

const parseColorRGB = (color: string): RGBType | null => {
  const HEX_NUMBER_REGEX = /^#/

  if (HEX_NUMBER_REGEX.test(color)) {
    return HEX2RGB(color)
  } else {
    return NAME2RGB(color)
  }
}

const parseAmount = (amount: string): ColorValueType | null => {
  const FLOAT_REGEX = /^-?\d+\.\d+$/
  const INT_REGEX = /^-?\d+$/
  const INT_PERCENT_REGEX = /^-?\d+%$/

  if (INT_PERCENT_REGEX.test(amount)) {
    return {
      type: '%',
      val: parseFloat(amount.replace(/(%)$/, '')),
    }
  } else if (FLOAT_REGEX.test(amount)) {
    return {
      type: 'f',
      val: parseFloat(amount) * 100.0,
    }
  } else if (INT_REGEX.test(amount)) {
    return {
      type: 'i',
      val: parseInt(amount),
    }
  } else {
    return null
  }
}

/**
 * Darkens the color by a given percentage amount.
 * The amount could be represented as a fraction of one (a number in range [0, 1]) or
 * an integer percent number (in range [0, 100]).
 *
 * It should be a string, either a float number or an integer number or an integer number and a percent sign.
 *
 * If the amount is negative - the function will lighten the color.
 *
 * @param color Color to darken, color name or color in HEX value
 * @param amount Darkening percentage. A string with either a float number, integer number or integer number and a percent sign ('%')
 * @returns Color in HEX value
 */
const darken = (color: string, amount: string): string => {
  let r_g_b = parseColorRGB(color)

  if (r_g_b === null) return color

  const h_s_l = RGB2HSL(r_g_b.r, r_g_b.g, r_g_b.b)

  const pa = parseAmount(amount)
  if (pa === null) return color
  let { val } = pa
  const type = pa.type

  val = val / -100

  if ('%' === type) {
    if (val > 0) {
      val = ((100 - h_s_l.l) * val) / 100
    } else {
      val = h_s_l.l * (val / 100)
    }
  }

  h_s_l.l += val

  r_g_b = HSL2RGB(h_s_l.h, h_s_l.s, h_s_l.l)

  return RGB2HEX(r_g_b.r, r_g_b.g, r_g_b.b)
}

/**
 * Lightens the given color by a given percentage amount. Alias for {@code darken(color, '-' + amount)}.
 *
 * @param color  Color to lighten, color name or color value in HEX format
 * @param amount The lightening percentage. A string with either a float number, integer number or integer number and a percent sign ('%')
 * @returns Lightened color in HEX format
 */
const lighten = (color: string, amount: string): string => darken(color, '-' + amount)

export { darken, lighten }
