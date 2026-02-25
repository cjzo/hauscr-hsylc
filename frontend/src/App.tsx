import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfirmProvider } from './components/ui/ConfirmModal';
import { AppLayout } from './components/layout/AppLayout';
import { DeliberationPage } from './pages/DeliberationPage';
import { DashboardPage } from './pages/DashboardPage';
import { DatabasePage } from './pages/DatabasePage';

function App() {
  return (
    <BrowserRouter>
      <ConfirmProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/deliberate" element={<DeliberationPage />} />
            <Route path="/data" element={<DatabasePage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </ConfirmProvider>
    </BrowserRouter>
  );
}

export default App;
