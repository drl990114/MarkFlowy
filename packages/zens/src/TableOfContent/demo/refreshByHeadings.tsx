import { useEffect, useRef, useState } from 'react';
import { Toc, TocRef } from 'zens';
import { IHeadingData } from '../HeadingTree';

export default () => {
  const tocRef = useRef<TocRef>(null);
  const [headingData, setHeadingsData] = useState<IHeadingData[]>([]);

  useEffect(() => {
    tocRef.current?.refreshByHeadings({
      newHeadings: [
        {
          depth: 1,
          value: 'Heading',
          id: 'heading-1',
          htmlNode: null,
          onClick: (h: IHeadingData) => {
            console.log('hh', h);
          },
        },
        {
          depth: 1,
          value: 'Heading 1',
          id: 'heading-2',
          htmlNode: null,
          onClick: (h: IHeadingData) => {
            console.log('hh', h);
          },
        },
        {
          depth: 1,
          value: 'Heading 2',
          id: 'heading-3',
          htmlNode: null,
          onClick: (h: IHeadingData) => {
            console.log('hh', h);
          },
        },
        {
          depth: 1,
          value: 'Heading 3',
          id: 'heading-4',
          htmlNode: null,
          onClick: (h: IHeadingData) => {
            console.log('hh', h);
          },
        },
        {
          depth: 2,
          value: 'Heading 4',
          id: 'heading-5',
          htmlNode: null,
          onClick: (h: IHeadingData) => {
            console.log('hh', h);
          },
        },
        {
          depth: 1,
          value: 'Heading 5',
          id: 'heading-6',
          htmlNode: null,
          onClick: (h: IHeadingData) => {
            console.log('hh', h);
          },
        },
      ],
    });
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <Toc ref={tocRef} headingsData={headingData} />
    </div>
  );
};
