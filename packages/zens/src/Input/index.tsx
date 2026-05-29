import { KeyboardEventHandler } from 'react';
import styled from 'styled-components';

export type InputSize = 'small' | 'medium' | 'large';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  inputRef?: React.Ref<HTMLInputElement>;
  onPressEnter?: (e: KeyboardEvent) => void;
  /**
   * 输入框尺寸
   * @default 'medium'
   */
  size?: InputSize;
}

// 定义不同尺寸的样式映射
const sizeStylesMap: Record<
  InputSize,
  {
    height: string;
    paddingHorizontal: string;
    paddingVertical: string;
    fontSize: string;
    borderRadius: string;
  }
> = {
  small: {
    height: '28px',
    paddingHorizontal: '8px',
    paddingVertical: '4px',
    fontSize: '13px',
    borderRadius: '4px',
  },
  medium: {
    height: '32px',
    paddingHorizontal: '12px',
    paddingVertical: '6px',
    fontSize: '14px',
    borderRadius: '6px',
  },
  large: {
    height: '40px',
    paddingHorizontal: '16px',
    paddingVertical: '8px',
    fontSize: '16px',
    borderRadius: '8px',
  },
};

const InputComponent = styled.input<{ $size?: InputSize }>`
  width: 100%;
  box-sizing: border-box;
  border: 1px solid;
  outline: none;
  transition: all 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);

  /* 基础样式 */
  color: ${(props) => props.theme.primaryFontColor};
  border-color: ${(props) => props.theme.borderColor};
  background-color: ${(props) => props.theme.bgColor};

  /* 尺寸样式 */
  height: ${(props) => {
    const size = props.$size || 'medium';
    return sizeStylesMap[size].height;
  }};
  padding-left: ${(props) => {
    const size = props.$size || 'medium';
    return sizeStylesMap[size].paddingHorizontal;
  }};
  padding-right: ${(props) => {
    const size = props.$size || 'medium';
    return sizeStylesMap[size].paddingHorizontal;
  }};
  padding-top: ${(props) => {
    const size = props.$size || 'medium';
    return sizeStylesMap[size].paddingVertical;
  }};
  padding-bottom: ${(props) => {
    const size = props.$size || 'medium';
    return sizeStylesMap[size].paddingVertical;
  }};
  font-size: ${(props) => {
    const size = props.$size || 'medium';
    return sizeStylesMap[size].fontSize;
  }};
  border-radius: ${(props) => {
    const size = props.$size || 'medium';
    return sizeStylesMap[size].borderRadius;
  }};

  /* 占位符样式 */
  &::placeholder {
    color: ${(props) => props.theme.gray};
    opacity: 0.8;
  }

  /* 悬停状态 */
  &:hover:not(:disabled):not([data-disabled='true']) {
    border-color: ${(props) => props.theme.accentColor};
  }

  /* 聚焦状态 */
  &:focus {
    border-color: ${(props) => props.theme.accentColor};
    box-shadow: 0 0 0 2px ${(props) => `${props.theme.accentColor}20`};
  }

  /* 禁用状态 */
  &:disabled,
  &[data-disabled='true'] {
    background-color: ${(props) => props.theme.tipsBgColor};
    color: ${(props) => props.theme.gray};
    cursor: not-allowed;
    opacity: 0.6;
  }

  /* 错误状态 */
  &[data-error='true'] {
    border-color: ${(props) => props.theme.dangerColor};

    &:focus {
      box-shadow: 0 0 0 2px ${(props) => `${props.theme.dangerColor}20`};
    }
  }

  /* 只读状态 */
  &:read-only {
    background-color: ${(props) => props.theme.tipsBgColor};
    cursor: default;
  }
`;

const Input: React.FC<InputProps> = (props) => {
  const { inputRef, onPressEnter, size = 'medium', ...rest } = props;

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter') {
      onPressEnter?.(e.nativeEvent);
    }
    rest.onKeyDown?.(e);
  };

  return (
    <InputComponent
      $size={size}
      {...rest}
      ref={inputRef}
      onKeyDown={handleKeyDown}
    />
  );
};

export default Input;
