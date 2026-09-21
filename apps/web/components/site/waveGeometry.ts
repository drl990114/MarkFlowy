/** Fold a sheet back around its rounded spine before the shader twists it. */
export function createWaveGeometry(columns = 128, rows = 192) {
  if (
    !Number.isInteger(columns) ||
    !Number.isInteger(rows) ||
    columns < 2 ||
    rows < 2 ||
    (columns + 1) * (rows + 1) > 65535
  )
    throw new RangeError('Wave subdivisions must fit a 16-bit indexed mesh')
  const vertices = new Float32Array((columns + 1) * (rows + 1) * 5)
  const indices = new Uint16Array(columns * rows * 6)
  let vertex = 0
  let index = 0
  for (let row = 0; row <= rows; row++) {
    const v = 1 - row / rows
    const radius = 4 - 2 * (4 * v * (1 - v)) ** 9.5
    for (let column = 0; column <= columns; column++) {
      const u = column / columns
      let across = (u - 0.5) * 400
      let depth = radius
      if (across >= -16 && across < 16) {
        const angle = ((across + 16) / 32) * Math.PI
        depth = Math.cos(angle) * radius
        across = Math.sin(angle) * radius - 16
      } else if (across >= 16) {
        across = -across
        depth = -radius
      }
      vertices.set([(v - 0.5) * 400, depth, across + 100, u, v], vertex)
      vertex += 5
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column
        const b = a + columns + 1
        indices.set([a, b, a + 1, b, b + 1, a + 1], index)
        index += 6
      }
    }
  }
  return { vertices, indices }
}
