import styled from 'styled-components';

const ErrorTipContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: ${props => props.theme.errorTipColor};
  overflow: hidden;
  max-width: 100%;

  .zens-error-icon-box {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }

  .zens-error-icon {
    width: 100%;
    height: 100%;
  }

  .zens-error-text {
    font-size: 12px;
    line-height: 1.6667;
    text-align: center;
    padding: 8px 16px;
    max-width: 100%;
    box-sizing: border-box;
  }

  .zens-error-url {
    max-width: 100%;
    font-size: 11px;
    line-height: 1.5;
    color: ${props => props.theme.secondaryFontColor};
    padding: 0 12px;
    word-break: break-all;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    box-sizing: border-box;
  }
`;

export interface ErrorTipProps {
  errortip: string;
  height?: number;
  width?: number;
  errorUrl?: string;
}
export const ErrorTip = (props: ErrorTipProps) => {
  const { errortip, width = 100, height = 70, errorUrl } = props;

  return (
    <ErrorTipContainer style={{ width: `${width}px`, height: `${height}px` }}>
      <div className="zens-error-icon-box">
        <svg
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          viewBox="0 0 48 48"
          aria-hidden="true"
          focusable="false"
          className="zens-error-icon"
        >
          <path d="M41 26V9a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v30a2 2 0 0 0 2 2h17"></path>
          <path d="m24 33 9-8.5V27s-2 1-3.5 2.5C27.841 31.159 27 33 27 33h-3Zm0 0-3.5-4.5L17 33h7Z"></path>
          <path
            fill="currentColor"
            stroke="none"
            d="M20.5 28.5 17 33h7l-3.5-4.5ZM33 24.5 24 33h3s.841-1.841 2.5-3.5C31 28 33 27 33 27v-2.5Z"
          ></path>
          <path
            fill="currentColor"
            fillRule="evenodd"
            stroke="none"
            d="M46 38a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-4.95-4.782 1.74 1.74-3.045 3.046 3.046 3.046-1.74 1.74-3.047-3.045-3.046 3.046-1.74-1.74 3.046-3.047-3.046-3.046 1.74-1.74 3.046 3.046 3.046-3.046Z"
            clipRule="evenodd"
          ></path>
          <path d="M17 15h-2v2h2v-2Z"></path>
        </svg>
      </div>

      <span className="zens-error-text">{errortip}</span>
      {errorUrl ? (
        <span className="zens-error-url" title={errorUrl}>
          {errorUrl}
        </span>
      ) : null}
    </ErrorTipContainer>
  );
};
export default ErrorTip;
