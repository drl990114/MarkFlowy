import { useRef } from 'react';

import { Image } from 'zens';

const sources = Array.from({ length: 12 }).map((_, index) => {
  const width = 240;
  const height = 160;
  const seed = index + 10;
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
});

export default () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={containerRef}
      style={{
        height: 320,
        overflow: 'auto',
        border: '1px solid #eee',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {sources.map((src, index) => (
        <Image
          key={src}
          width={240}
          height={160}
          src={src}
          lazy
          lazyRoot={containerRef.current}
          lazyRootMargin="120px"
          lazyThreshold={0}
          lazyPlaceholder={
            <div
              style={{
                width: 240,
                height: 160,
                background: '#f5f5f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                fontSize: 12,
              }}
            >
              Loading {index + 1}
            </div>
          }
        />
      ))}
    </div>
  );
};
