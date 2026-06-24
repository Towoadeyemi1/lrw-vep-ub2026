import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Common/Toast';
import { Sidebar } from './components/Layout/Sidebar';
import { Header } from './components/Layout/Header';

import Dashboard from './pages/Dashboard';
import ProcessInvoice from './pages/ProcessInvoice';
import ReviewQueue from './pages/ReviewQueue';
import AuditLog from './pages/AuditLog';
import Intelligence from './pages/Intelligence';
import Export from './pages/Export';
import DemoControls from './pages/DemoControls';

function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-midnight">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/process" element={<ProcessInvoice />} />
            <Route path="/review" element={<ReviewQueue />} />
            <Route path="/audit" element={<AuditLog />} />
            <Route path="/intelligence" element={<Intelligence />} />
            <Route path="/export" element={<Export />} />
            <Route path="/demo" element={<DemoControls />} />
          </Routes>
        </Layout>
      </ToastProvider>
    </BrowserRouter>
  );
}
