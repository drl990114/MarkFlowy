export const IMAGE_REFERRER_POLICY = 'no-referrer' as const

export function applyImageRequestPolicy(image: HTMLImageElement): void {
  image.referrerPolicy = IMAGE_REFERRER_POLICY
  image.setAttribute('referrerpolicy', IMAGE_REFERRER_POLICY)
}
