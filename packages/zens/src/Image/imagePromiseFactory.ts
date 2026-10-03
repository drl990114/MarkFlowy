export interface ImagePromiseOptions {
  decode?: boolean;
  crossOrigin?: string;
}

export type ImageLoader = (src: string) => Promise<void>;

// Six built-in loaders (decode on/off x the three CORS modes). Their identities
// must survive initial Suspense retries, which discard component useMemo state.
const loaders = new Map<string, ImageLoader>();

export default ({ decode = true, crossOrigin = '' }: ImagePromiseOptions): ImageLoader => {
  const cors = crossOrigin ? (crossOrigin === 'use-credentials' ? crossOrigin : 'anonymous') : '';
  const key = `${Boolean(decode)}:${cors}`;
  const cached = loaders.get(key);
  if (cached) return cached;

  const load: ImageLoader = (src) => {
    return new Promise((resolve, reject) => {
      const i = new Image();
      if (cors) i.crossOrigin = cors;
      i.onload = () => {
        if (decode && i.decode) i.decode().then(resolve).catch(reject);
        else resolve();
      };
      i.onerror = reject;
      i.src = src;
    });
  };

  loaders.set(key, load);
  return load;
};
