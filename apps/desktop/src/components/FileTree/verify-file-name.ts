export const unVerifiedFileNameChars = ['\\', '\/', ':', '|', '?', '"']

export function verifyFileName(fileName: string): boolean {
  return !unVerifiedFileNameChars.some((char) => fileName.includes(char))
}
