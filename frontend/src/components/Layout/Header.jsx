import { useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Bell, Menu } from 'lucide-react';
import client from '../../api/client';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/process': 'Process Invoice',
  '/review': 'Review Queue',
  '/audit': 'Audit Log',
  '/intelligence': 'Intelligence',
  '/export': 'Export',
  '/demo': 'Demo Controls',
  '/howto': 'How To Use',
};

export function Header({ onMenuClick }) {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] || 'Invoice Router';
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      try {
        const res = await client.get('/review-queue');
        const data = res.data;
        const count = Array.isArray(data) ? data.length : data.pending_count || data.count || 0;
        if (mounted) setPending(count);
      } catch {
        // ignore
      }
    };
    fetch();
    const id = setInterval(fetch, 10000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return (
    <header className="bg-navy border-b border-cobalt px-4 md:px-6 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-1 text-silver hover:text-ivory transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-ivory font-semibold text-lg">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-steel text-xs hidden sm:block">demo.inspirationtechcorp.com</span>
        {pending > 0 && (
          <div className="flex items-center gap-2 bg-red-900/30 border border-red-700 text-red-300 px-3 py-1 rounded-full text-xs font-semibold">
            <Bell className="w-3.5 h-3.5" />
            {pending} pending review
          </div>
        )}
      </div>
    </header>
  );
}
