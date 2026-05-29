// @ts-nocheck
export default ({ decode = true, crossOrigin = '' }) =>
  (src): Promise<void> => {
    return new Promise((resolve, reject) => {
      const i = new Image();
      if (crossOrigin) i.crossOrigin = crossOrigin;
      i.onload = () => {
        decode && i.decode ? i.decode().then(resolve).catch(reject) : resolve();
      };
      i.onerror = reject;
      i.src = src;
    });
  };
