import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Music,
  BookOpen,
  ShieldCheck,
  LogOut,
  Loader2,
  ChevronRight,
  LayoutDashboard,
  AlertCircle,
  Compass,
  Sliders
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AdminSongList from './AdminSongList';
import AdminSongbookManager from './AdminSongbookManager';
import AdminProductJourney from './AdminProductJourney';
import AdminFeatureControl from './AdminFeatureControl';

const TABS = [
  { id: 'catalog', label: 'Song Catalog', icon: Music, description: 'Manage hymns, create new songs, edit metadata' },
  { id: 'songbooks', label: 'Songbook Manager', icon: BookOpen, description: 'Assign songs to songbook collections' },
  { id: 'journey', label: 'Product Journey', icon: Compass, description: 'Roadmap, milestones, and development phases' },
  { id: 'features', label: 'Feature Control', icon: Sliders, description: 'Runtime availability switches and system locks' }
];

/**
 * AdminPortalModal
 *
 * Full-screen responsive overlay that serves as the admin command center.
 * Containers existing Phase 9 admin CRUD components (AdminSongList, AdminSongbookManager)
 * without rebuilding any CRUD logic.
 *
 * Authorization: UI checks are strictly a UX gate.
 * PostgreSQL RLS remains the final authority for all data operations.
 */
export default function AdminPortalModal({ isOpen, onClose }) {
  const { user, profile, signOut, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState('catalog');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');

  // Songbook manager sub-view state
  const [songbookTarget, setSongbookTarget] = useState(null); // { id, title }

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab('catalog');
      setIsSidebarCollapsed(false);
      setSigningOut(false);
      setSignOutError('');
      setSongbookTarget(null);
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Prevent body scroll when portal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    setSignOutError('');
    try {
      const result = await signOut();
      if (result.success) {
        onClose();
      } else {
        setSignOutError(result.error || 'Sign out failed.');
      }
    } catch (_) {
      setSignOutError('Unable to sign out.');
    } finally {
      setSigningOut(false);
    }
  }, [signOut, onClose]);

  if (!isOpen) return null;

  const isAdmin = Boolean(user && profile?.role === 'admin');

  // If somehow opened without auth or admin role, show guard
  if (!user || !isAdmin) {
    return (
      <div className="fixed inset-0 z-[110] bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Admin Access Required</h2>
          <p className="text-sm text-slate-400 mb-6">
            You must be signed in with an authorized administrator account to access this portal.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[110] flex bg-slate-950 animate-fadeIn">
      
      {/* ====== SIDEBAR ====== */}
      <aside
        className={`
          hidden md:flex flex-col
          bg-slate-900/95 border-r border-slate-800/80
          transition-all duration-300 ease-in-out shrink-0
          ${isSidebarCollapsed ? 'w-[68px]' : 'w-[260px]'}
        `}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/30 to-amber-600/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <LayoutDashboard className="w-5 h-5 text-amber-400" />
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white truncate">Admin Portal</h2>
                <p className="text-[10px] text-emerald-400 font-medium truncate flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  {profile?.full_name || user.email}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSongbookTarget(null);
                }}
                title={isSidebarCollapsed ? tab.label : undefined}
                className={`
                  w-full flex items-center gap-3 rounded-xl transition-all duration-200
                  ${isSidebarCollapsed ? 'justify-center p-3' : 'p-3 text-left'}
                  ${isActive
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
                  }
                `}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-amber-400' : ''}`} />
                {!isSidebarCollapsed && (
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold block truncate">{tab.label}</span>
                    <span className="text-[10px] text-slate-500 block truncate">{tab.description}</span>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800/80 shrink-0 space-y-2">
          {/* Collapse Toggle */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition text-xs"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${isSidebarCollapsed ? '' : 'rotate-180'}`} />
            {!isSidebarCollapsed && <span>Collapse</span>}
          </button>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10 transition text-xs disabled:opacity-50"
            title="Sign Out"
          >
            {signingOut ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            {!isSidebarCollapsed && <span>{signingOut ? 'Signing Out...' : 'Sign Out'}</span>}
          </button>
          {signOutError && !isSidebarCollapsed && (
            <p className="text-[10px] text-rose-400 text-center">{signOutError}</p>
          )}
        </div>
      </aside>

      {/* ====== MAIN CONTENT AREA ====== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top Bar */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-950/90 border-b border-slate-800/80 shrink-0">
          
          {/* Mobile: Tab Switcher */}
          <div className="md:hidden flex items-center gap-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSongbookTarget(null);
                  }}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition
                    ${isActive
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
                    }
                  `}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Desktop: Current Tab Breadcrumb */}
          <div className="hidden md:flex items-center gap-2 text-sm">
            <LayoutDashboard className="w-4 h-4 text-slate-500" />
            <span className="text-slate-500">Admin</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="font-semibold text-white">
              {TABS.find(t => t.id === activeTab)?.label}
            </span>
            {songbookTarget && activeTab === 'songbooks' && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-amber-300 text-xs truncate max-w-[200px]">{songbookTarget.title}</span>
              </>
            )}
          </div>

          {/* Right: User badge + Close */}
          <div className="flex items-center gap-3">
            {/* Admin Badge (desktop only) */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300 font-medium">Admin</span>
            </div>

            {/* Mobile Sign Out */}
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="md:hidden p-2 rounded-lg text-rose-400/80 hover:bg-rose-500/10 transition disabled:opacity-50"
              title="Sign Out"
            >
              {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            </button>

            {/* Close Portal */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close Admin Portal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {activeTab === 'catalog' && (
              <AdminSongList />
            )}

            {activeTab === 'songbooks' && (
              songbookTarget ? (
                <AdminSongbookManager
                  songId={songbookTarget.id}
                  songTitle={songbookTarget.title}
                  onClose={() => setSongbookTarget(null)}
                  onSaved={() => setSongbookTarget(null)}
                />
              ) : (
                <div className="text-center py-20">
                  <BookOpen className="w-16 h-16 mx-auto text-slate-700 mb-4" />
                  <h3 className="text-lg font-bold text-slate-300 mb-2">Songbook Manager</h3>
                  <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                    To manage songbook assignments, open a song from the{' '}
                    <button
                      onClick={() => setActiveTab('catalog')}
                      className="text-amber-400 hover:text-amber-300 underline underline-offset-2 font-medium transition"
                    >
                      Song Catalog
                    </button>
                    {' '}and use the songbook manager from the song's edit view.
                  </p>
                </div>
              )
            )}
            {activeTab === 'journey' && (
              <AdminProductJourney />
            )}

            {activeTab === 'features' && (
              <AdminFeatureControl />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
