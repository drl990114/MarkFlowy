import { useRouter } from 'next/router';
import React from 'react';
import Footer from './Footer';
import { Container, Content, Title } from './Layout';
import Nav, { NavProps } from './Nav';
import Head from './SeoHead';

export interface DocsLayoutProps {
  description?: string;
  pages?: NavProps['pages'];
  title?: string;
  useDocsSidebarMenu?: boolean;
}

export default function DocsLayout({
  children,
  title = '',
  description = '',
  useDocsSidebarMenu = true,
  pages,
}: React.PropsWithChildren<DocsLayoutProps>) {
  const router = useRouter();
  const [isSideFolded, setIsSideFolded] = React.useState(true);
  const [isMobileNavFolded, setIsMobileNavFolded] = React.useState(true);

  const onSideToggle = React.useCallback(() => {
    setIsMobileNavFolded(true);
    setIsSideFolded(x => !x);
  }, []);

  const onMobileNavToggle = React.useCallback(() => {
    setIsMobileNavFolded(x => !x);
    setIsSideFolded(true);
  }, []);

  React.useEffect(() => {
    setIsMobileNavFolded(true);
    setIsSideFolded(true);
  }, [router.asPath]);

  return (
    <Container>
      <Head title={`MarkFlowy${title ? `: ${title}` : ''}`} description={description}>
        <meta name="robots" content="noodp" />
      </Head>

      <Nav
        useDocsSidebarMenu={useDocsSidebarMenu}
        isSideFolded={isSideFolded}
        isMobileNavFolded={isMobileNavFolded}
        pages={pages}
        onSideToggle={onSideToggle}
        onMobileNavToggle={onMobileNavToggle}
      />

      <Content $moveRight={!isSideFolded} data-e2e-id="content">
        <Title>{title}</Title>

        {children}
      </Content>

      <Footer />
    </Container>
  );
}
