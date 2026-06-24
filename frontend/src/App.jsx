import { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ToastProvider } from './components/Common/Toast';
import { PageTransition } from './components/Common/PageTransition';
import { Sidebar } from './components/Layout/Sidebar';
import { Header } from './components/Layout/Header';
import { LivePipelineBar } from './components/Common/LivePipelineBar';

import Dashboard from './pages/Dashboard';
import ProcessInvoice from './pages/ProcessInvoice';
import ReviewQueue from './pages/ReviewQueue';
import AuditLog from './pages/AuditLog';
import Intelligence from './pages/Intelligence';
import Export from './pages/Export';
import DemoControls from './pages/DemoControls';
import HowTo from './pages/HowTo';

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Dashboard /></PageTransition>} />
        <Route path="/process" element={<PageTransition><ProcessInvoice /></PageTransition>} />
        <Route path="/review" element={<PageTransition><ReviewQueue /></PageTransition>} />
        <Route path="/audit" element={<PageTransition><AuditLog /></PageTransition>} />
        <Route path="/intelligence" element={<PageTransition><Intelligence /></PageTransition>} />
        <Route path="/export" element={<PageTransition><Export /></PageTransition>} />
        <Route path="/demo" element={<PageTransition><DemoControls /></PageTransition>} />
        <Route path="/howto" element={<PageTransition><HowTo /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
}

function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-midnight">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <LivePipelineBar />
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
          <AnimatedRoutes />
        </Layout>
      </ToastProvider>
    </BrowserRouter>
  );
}
