import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfirmProvider } from './components/ui/ConfirmModal';
import { AppLayout } from './components/layout/AppLayout';
import { DeliberationPage } from './pages/DeliberationPage';

function DashboardPlaceholder() {
  return (
    <div className="flex items-center justify-center h-full text-secondary">
      Dashboard coming soon...
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ConfirmProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/deliberate" replace />} />
            <Route path="/dashboard" element={<DashboardPlaceholder />} />
            <Route path="/deliberate" element={<DeliberationPage />} />
            <Route path="*" element={<Navigate to="/deliberate" replace />} />
          </Route>
        </Routes>
      </ConfirmProvider>
    </BrowserRouter>
  );
}

export default App;
