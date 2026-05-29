import { useEffect, useRef, useState } from 'react';

import { Toc, TocRef } from 'zens';

import { IHeadingData } from '../HeadingTree';

export default () => {
  const tocRef = useRef<TocRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      tocRef.current?.refresh({
        newContainer: containerRef.current,
        newScroll: containerRef.current,
      });
    }
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <div ref={containerRef} style={{ height: '200px', width: '200px', overflow: 'scroll' }}>
        <h1 id="heading-1">Heading</h1>
        <div style={{ height: '50px' }}></div>
        <h2 id="heading-2">Heading 1</h2>
        <div style={{ height: '50px' }}></div>

        <h2 id="heading-3">Heading 2</h2>
        <div style={{ height: '50px' }}></div>

        <h2 id="heading-4">Heading 3</h2>
        <div style={{ height: '50px' }}></div>

        <h3 id="heading-5">Heading 4</h3>
        <div style={{ height: '50px' }}></div>
        <div style={{ height: '50px' }}></div>
        <h2 id="heading-6">Heading 5</h2>
        <div style={{ height: '50px' }}></div>
      </div>
      <Toc ref={tocRef} />
    </div>
  );
};
