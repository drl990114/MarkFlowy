import { Input } from 'zens';
import styled from 'styled-components';

const DemoContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 500px;
`;

const SizeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const SizeLabel = styled.div`
  width: 80px;
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.theme.primaryFontColor};
`;

const InputWrapper = styled.div`
  flex: 1;
`;

export default () => {
  const handlePressEnter = () => {
    alert('You pressed enter!');
  };

  return (
    <DemoContainer>
      <h3 style={{ margin: '0 0 16px 0', color: '#333' }}>
        Input Component Size Comparison
      </h3>
      
      <SizeRow>
        <SizeLabel>Small:</SizeLabel>
        <InputWrapper>
          <Input 
            size="small" 
            placeholder="Small input field" 
            onPressEnter={handlePressEnter}
          />
        </InputWrapper>
      </SizeRow>

      <SizeRow>
        <SizeLabel>Medium:</SizeLabel>
        <InputWrapper>
          <Input 
            size="medium" 
            placeholder="Medium input field (default)" 
            onPressEnter={handlePressEnter}
          />
        </InputWrapper>
      </SizeRow>

      <SizeRow>
        <SizeLabel>Large:</SizeLabel>
        <InputWrapper>
          <Input 
            size="large" 
            placeholder="Large input field" 
            onPressEnter={handlePressEnter}
          />
        </InputWrapper>
      </SizeRow>

      <SizeRow>
        <SizeLabel>Disabled:</SizeLabel>
        <InputWrapper>
          <Input 
            size="medium" 
            placeholder="Disabled input field" 
            disabled
          />
        </InputWrapper>
      </SizeRow>

      <SizeRow>
        <SizeLabel>Error:</SizeLabel>
        <InputWrapper>
          <Input 
            size="medium" 
            placeholder="Error input field" 
            data-error="true"
          />
        </InputWrapper>
      </SizeRow>
    </DemoContainer>
  );
};
