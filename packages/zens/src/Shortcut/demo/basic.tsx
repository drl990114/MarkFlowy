import { MacCommandFilled } from '@ant-design/icons';
import { Shortcut } from 'zens';

export default () => {
  const basicShortcuts = [
    { keybindings: [{ key: 'Ctrl' }], desc: 'Control' },
    { keybindings: [{ key: 'K' }], desc: '打开命令面板' },
  ];

  const multipleShortcuts = [
    { keybindings: [{ key: 'Cmd' }, { key: 'K' }], desc: 'Command' },
    { keybindings: [{ key: 'Shift' }], desc: 'Shift' },
    { keybindings: [{ key: 'P' }], desc: '打开命令面板' },
  ];

  const withIcons = [
    { keybindings: [{ key: 'Cmd' }], icon: <MacCommandFilled />, desc: 'Command' },
    { keybindings: [{ key: 'Space' }], desc: '空格' },
  ];

  const complexCombinations = [
    { keybindings: [{ key: '⌘' }, { key: 'Shift' }, { key: 'P' }], desc: '显示所有命令' },
    { keybindings: [{ key: 'Ctrl' }, { key: 'Alt' }, { key: 'Del' }], desc: '任务管理器' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
      <div>
        <h3>基本快捷键</h3>
        <Shortcut dataSource={basicShortcuts} />
      </div>

      <div>
        <h3>组合键</h3>
        <Shortcut dataSource={multipleShortcuts} />
      </div>

      <div>
        <h3>带图标快捷键</h3>
        <Shortcut dataSource={withIcons} />
      </div>

      <div>
        <h3>复杂组合键</h3>
        <Shortcut dataSource={complexCombinations} />
      </div>
    </div>
  );
}
