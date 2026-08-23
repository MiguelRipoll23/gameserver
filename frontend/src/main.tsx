import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { Toasty } from '@cloudflare/kumo'
import './index.css'
import { router } from './router'
import { ConfigProvider } from './lib/config'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Toasty>
        <ConfigProvider>
          <RouterProvider router={router} />
        </ConfigProvider>
      </Toasty>
    </QueryClientProvider>
  </StrictMode>,
)
