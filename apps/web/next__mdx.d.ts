import { NextConfig } from 'next';

declare module '@next/mdx' {
  interface WithMDXConfig {
    extension?: RegExp;
    options?: {
      providerImportSource?: string;
      remarkPlugins: any[];
      rehypePlugins?: any[];
    };
  }

  export default function WithMDX(config: WithMDXConfig): (config: NextConfig) => NextConfig;
}
