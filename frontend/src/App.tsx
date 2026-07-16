import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppRoutes } from '@/routes/AppRoutes';
import { queryClient } from '@/lib/queryClient';
import { useThemeStore } from '@/stores/themeStore';

/**
 * 앱 루트 — Provider 배선 + 테마 적용.
 * 테마는 document root `data-theme` 로 반영(U-005). 값 오버라이드는 index.css.
 */
export function App() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
