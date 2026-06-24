import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  ClipboardList,
  ScrollText,
  Brain,
  Download,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import client from '../../api/client';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/process', icon: Upload, label: 'Process Invoice' },
  { to: '/review', icon: ClipboardList, label: 'Review Queue', badge: true },
  { to: '/audit', icon: ScrollText, label: 'Audit Log' },
  { to: '/intelligence', icon: Brain, label: 'Intelligence', star: true },
  { to: '/export', icon: Download, label: 'Export' },
  { to: '/demo', icon: Settings, label: 'Demo Controls' },
];

export function Sidebar() {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const fetchPending = async () => {
      try {
        const res = await client.get('/review-queue');
        const data = res.data;
        const count = Array.isArray(data) ? data.length : data.pending_count || data.count || 0;
        if (mounted) setPendingCount(count);
      } catch {
        // silently ignore
      }
    };
    fetchPending();
    const id = setInterval(fetchPending, 10000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return (
    <aside className="w-64 bg-navy border-r border-cobalt flex flex-col shrink-0 min-h-screen">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-cobalt">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-gold" />
          <span className="text-gold font-bold text-sm tracking-wide leading-tight">
            Invoice Routing<br />Intelligence
          </span>
        </div>
        <p className="text-silver text-xs mt-1">Inspiration Tech Corp</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ to, icon: Icon, label, exact, badge, star }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative
              ${isActive
                ? 'text-gold bg-cobalt border-l-2 border-gold pl-[10px]'
                : 'text-silver hover:text-ivory hover:bg-cobalt/40 border-l-2 border-transparent'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {badge && pendingCount > 0 && (
              <span className="bg-red-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
            {star && (
              <span className="text-[10px] bg-gold/20 text-gold px-1.5 py-0.5 rounded font-semibold">
                ⭐ Key
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-cobalt">
        <p className="text-steel text-xs">demo.inspirationtechcorp.com</p>
        <p className="text-cobalt text-xs mt-0.5">Invoice Router v1.0</p>
      </div>
    </aside>
  );
}
