import { KeyboardArrowRight } from '@styled-icons/material';
import styled, { css } from 'styled-components';
import { grey } from '../utils/colors';
import { mobile } from '../utils/media';
import rem from '../utils/rem';
import Link, { LinkProps } from './Link';

const Wrapper = styled(Link).attrs((/* props */) => ({
  unstyled: true,
}))`
  display: flex;
  flex-direction: row;
  align-items: stretch;
  justify-content: flex-end;

  width: 100%;
  padding: ${rem(40)} ${rem(20)};
  text-align: right;
  font-family: ${props => props.theme.fontFamily};

  ${mobile(css`
    text-align: left;
    justify-content: center;
    padding: ${rem(30)} ${rem(20)};
  `)};
`;

const Text = styled.h3`
  font-weight: normal;
  padding-right: ${rem(20)};
  margin: 0;
`;

const PageName = styled.h2`
  font-weight: 600;
  padding-right: ${rem(20)};
  margin: 0;
`;

const Icon = styled(KeyboardArrowRight)`
  color: ${grey};
  width: ${rem(30)};
`;

export interface NextPageProps extends Pick<LinkProps, 'href'> {
  title: string;
}

const NextPage = ({ title, href }: NextPageProps) => (
  <Wrapper unstyled href={href}>
    <div>
      <Text>Continue on the next page</Text>
      <PageName>{title}</PageName>
    </div>

    <div>
      <Icon />
    </div>
  </Wrapper>
);

export default NextPage;
