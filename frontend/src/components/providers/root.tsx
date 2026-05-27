import type { PropsWithChildren } from 'react';

import { Toaster } from '@/components/ui/sonner';

import ThemeProvider from './theme';

type TRootProvider = PropsWithChildren;

export default function RootProvider({ children }: Readonly<TRootProvider>) {
  return (
    <ThemeProvider>
      {children}
      <Toaster richColors closeButton />
    </ThemeProvider>
  );
}
