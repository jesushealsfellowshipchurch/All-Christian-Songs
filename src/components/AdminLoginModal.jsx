import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Mail,
  Loader2,
  LogOut,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
  LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminLoginModal({ isOpen, onClose, onOpenPortal }) {
  const { user, profile, loading: authLoading, signIn, signOut, error: globalAuthError, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  // Clear transient form state and errors on modal open/close
  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setPassword('');
      setShowPassword(false);
      setSubmitting(false);
      setLocalError('');
      clearError();
    }
  }, [isOpen, clearError]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setLocalError('Please enter your email address.');
      return;
    }
    if (!password) {
      setLocalError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await signIn({ email: cleanEmail, password });
      if (!result.success) {
        setLocalError(result.error || 'Authentication failed. Please check your credentials.');
      } else {
        // Clear password from memory immediately upon success
        setPassword('');
      }
    } catch (_) {
      setLocalError('Unable to complete authentication. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setSubmitting(true);
    setLocalError('');
    try {
      const result = await signOut();
      if (!result.success) {
        setLocalError(result.error || 'Failed to sign out cleanly.');
      }
    } catch (_) {
      setLocalError('Error during sign out.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayedError = localError || globalAuthError;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div
        className="relative w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient decoration */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={submitting}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors disabled:opacity-50"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {user ? (
          /* =======================================================
             AUTHENTICATED STATE VIEW
             ======================================================= */
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                  Admin Portal
                </h3>
                <p className="text-xs text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                  <UserCheck className="w-3.5 h-3.5" /> Authenticated Session Active
                </p>
              </div>
            </div>

            {displayedError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{displayedError}</span>
              </div>
            )}

            {/* Account Details Card */}
            <div className="p-4 bg-slate-800/60 border border-slate-700/80 rounded-2xl mb-5 text-xs space-y-2.5">
              <div className="flex justify-between items-center py-1 border-b border-slate-700/60">
                <span className="text-slate-400">Account:</span>
                <span className="text-slate-200 font-medium font-mono text-[11px] truncate max-w-[200px]">
                  {user.email}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-700/60">
                <span className="text-slate-400">User ID:</span>
                <span className="text-slate-400 font-mono text-[10px] truncate max-w-[200px]" title={user.id}>
                  {user.id}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-700/60">
                <span className="text-slate-400">Profile Role:</span>
                <span
                  className={`px-2 py-0.5 rounded-full font-semibold text-[10px] uppercase tracking-wider ${
                    profile?.role === 'admin'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : profile?.role === 'editor'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {profile?.role || 'User (No Profile)'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Security Engine:</span>
                <span className="text-emerald-300/90 font-medium">Supabase Auth (RLS Guarded)</span>
              </div>
            </div>

            {profile?.role === 'admin' ? (
              <>
                <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                  Your administrator session is active. Open the Admin Portal to manage the hymnal catalog, create songs, and organize songbooks.
                </p>

                <div className="flex flex-col gap-3">
                  {onOpenPortal && (
                    <button
                      type="button"
                      onClick={onOpenPortal}
                      className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md hover:shadow-amber-500/25 flex items-center justify-center gap-2"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      <span>Open Admin Portal</span>
                    </button>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={submitting}
                      className="flex-1 py-2.5 px-4 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-medium rounded-xl text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <LogOut className="w-4 h-4" />
                          <span>Sign Out</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={submitting}
                      className="py-2.5 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl text-xs transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl mb-5 text-xs text-amber-300/90 leading-relaxed flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    You are signed in as a standard member. Administrative features require an authorized Super Admin account.
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={submitting}
                      className="flex-1 py-2.5 px-4 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <LogOut className="w-4 h-4" />
                          <span>Sign Out & Switch</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={submitting}
                      className="py-2.5 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl text-xs transition-colors"
                    >
                      Return to Hymnal
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* =======================================================
             UNAUTHENTICATED SIGN IN VIEW
             ======================================================= */
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white tracking-wide">
                  Admin Sign In
                </h3>
                <p className="text-xs text-slate-400">Jesus Heals Fellowship Hymnal Portal</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Sign in with your authorized administrator credentials to manage hymns and catalog settings.
            </p>

            {displayedError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-relaxed">{displayedError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Administrator Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (displayedError) {
                        setLocalError('');
                        clearError();
                      }
                    }}
                    placeholder="admin@example.com"
                    autoComplete="username"
                    disabled={submitting || authLoading}
                    className="w-full bg-slate-950 border border-slate-700/90 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (displayedError) {
                        setLocalError('');
                        clearError();
                      }
                    }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={submitting || authLoading}
                    className="w-full bg-slate-950 border border-slate-700/90 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={submitting || authLoading}
                  className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md hover:shadow-amber-500/25 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <span>Sign In</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs sm:text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>

            <p className="text-[11px] text-slate-500 mt-4 text-center">
              Public registration is disabled. Administrator accounts are created via controlled Supabase provisioning.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
