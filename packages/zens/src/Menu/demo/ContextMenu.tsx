import { useState } from 'react';
import styled from 'styled-components';
import { Menu, useMenuStore } from 'zens';

export default () => {
  const [anchorRect, setAnchorRect] = useState({ x: 0, y: 0 });
  const menu = useMenuStore();

  const menuData = [
    {
      label: 'menu1',
      value: 'menu1',
      checked: true,
      handler: () => {
        console.log('menu1');
      },
    },
    {
      label: 'menu2',
      value: 'menu2',
      children: [
        {
          label: 'menu2-1',
          value: 'menu2-1',
        },
        {
          label: 'menu2-2',
          value: 'menu2-2',
        },
      ],
    },
    {
      label: 'menu3',
      value: 'menu3',
    },
  ];

  return (
    <Container
      onContextMenu={(event) => {
        event.preventDefault();
        setAnchorRect({ x: event.clientX, y: event.clientY });
        menu.show();
      }}
    >
      Right click here
      <Menu items={menuData} store={menu} modal getAnchorRect={() => anchorRect}></Menu>
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  border-width: 2px;
  border-style: dashed;
  border-color: hsl(204 20% 88%);
  padding-top: 2.5rem;
  padding-bottom: 2.5rem;
  padding-left: 4rem;
  padding-right: 4rem;
`;
