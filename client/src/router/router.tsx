import { createBrowserRouter, Navigate } from 'react-router';
import { WithGuard } from './guard';
import { lazy } from 'react';
import Register from '@/pages/register';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: WithGuard(lazy(() => import('@/pages/home'))),
    children: [
      {
        path: 'chat', // '/chat',
        Component: WithGuard(lazy(() => import('@/pages/home'))),
      },
      {
        path: 'contact', // /'contact',
        Component: WithGuard(lazy(() => import('@/pages/home'))),
      },
    ],
  },
  {
    path: '/login',
    Component: lazy(() => import('@/pages/login')),
  },
  {
    path: '/register',
    // Component: Register,
    element: <Register />,
  },
  {
    path: '*',
    element: <Navigate to="/" />,
  },
]);
