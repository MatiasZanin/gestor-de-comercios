import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RequireAuth from './components/RequireAuth';
import LoginPage from './pages/LoginPage';
import ProductsPage from './pages/ProductsPage';
import SalesPage from './pages/SalesPage';
import DailyReportPage from './pages/DailyReportPage';
import RangeReportPage from './pages/RangeReportPage';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/:commerceId/products"
          element={
            <RequireAuth>
              <ProductsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/:commerceId/sales"
          element={
            <RequireAuth>
              <SalesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/:commerceId/reports/daily"
          element={
            <RequireAuth>
              <DailyReportPage />
            </RequireAuth>
          }
        />
        <Route
          path="/:commerceId/reports/range"
          element={
            <RequireAuth>
              <RangeReportPage />
            </RequireAuth>
          }
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
};

export default App;