import React, { useState, useEffect, useId } from 'react';
import {
  X,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  KeyRound,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function UserAuthModal({
  isOpen,
  initialMode = 'login', // 'login' | 'signup' | 'forgot_password'
  onClose,
  onSuccess,
  onOpenAdmin
}) {
  const { signIn, signUp, resetPassword, globalAuthError, clearError } = useAuth();

  const [mode, setMode] = useState(initialMode); // 'login' | 'signup' | 'forgot_password' | 'confirmation_sent' | 'reset_sent'
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const firstNameId = useId();
  const lastNameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();

  // Reset form whenever modal opens or mode switches
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setSubmitting(false);
      setErrorMessage('');
      setSuccessMessage('');
      if (clearError) clearError();
    }
  }, [isOpen, initialMode, clearError]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  // Password strength evaluation
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: 'bg-slate-700' };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-rose-500' };
    if (score <= 2) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
    if (score <= 3) return { score: 3, label: 'Good', color: 'bg-emerald-500' };
    return { score: 4, label: 'Strong', color: 'bg-emerald-400' };
  };

  const passwordStrength = getPasswordStrength(password);

  const switchMode = (newMode) => {
    setErrorMessage('');
    setSuccessMessage('');
    if (clearError) clearError();
    setPassword('');
    setConfirmPassword('');
    setMode(newMode);
  };

  // ---------------------------------------------------------------------------
  // Sign In Handler
  // ---------------------------------------------------------------------------
  const handleSignIn = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    if (clearError) clearError();

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await signIn({ email: cleanEmail, password });
      if (!result.success) {
        setErrorMessage(result.error || 'Invalid credentials. Please try again.');
      } else {
        setPassword('');
        if (onSuccess) onSuccess(result.user);
        onClose();
      }
    } catch (_) {
      setErrorMessage('Unable to complete authentication. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Sign Up Handler
  // ---------------------------------------------------------------------------
  const handleSignUp = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    if (clearError) clearError();

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanEmail = email.trim();

    if (!cleanFirst) {
      setErrorMessage('Please enter your first name.');
      return;
    }
    if (!cleanLast) {
      setErrorMessage('Please enter your last name.');
      return;
    }
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please create a password.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await signUp({
        email: cleanEmail,
        password,
        firstName: cleanFirst,
        lastName: cleanLast
      });

      if (!result.success) {
        setErrorMessage(result.error || 'Failed to create account. Please try again.');
      } else {
        setPassword('');
        setConfirmPassword('');

        if (result.requiresConfirmation) {
          // Email confirmation is required by Supabase
          setMode('confirmation_sent');
        } else {
          // Auto-authenticated immediately
          if (onSuccess) onSuccess(result.user);
          onClose();
        }
      }
    } catch (_) {
      setErrorMessage('Unable to register at this time. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Reset Password Handler
  // ---------------------------------------------------------------------------
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    if (clearError) clearError();

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await resetPassword({ email: cleanEmail });
      if (!result.success) {
        setErrorMessage(result.error || 'Failed to send password reset email.');
      } else {
        setMode('reset_sent');
      }
    } catch (_) {
      setErrorMessage('Unable to process password reset request.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayedError = errorMessage || globalAuthError;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md my-auto bg-slate-900/95 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 text-slate-100 backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient background glows */}
        <div className="absolute -top-24 -left-24 w-52 h-52 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-52 h-52 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={submitting}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors disabled:opacity-50"
          title="Close"
          aria-label="Close authentication modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative flex items-center justify-center mb-3">
            <div className="absolute inset-0 bg-amber-400/20 rounded-full blur-md" />
            <img
              src="./images/gold-cross.png"
              alt="Gold Cross"
              className="relative w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(203,182,130,0.5)]"
            />
          </div>

          <h2
            id="auth-modal-title"
            className="text-xl sm:text-2xl font-bold tracking-tight text-white"
          >
            {mode === 'signup' && 'Create your account'}
            {mode === 'login' && 'Welcome Back'}
            {mode === 'forgot_password' && 'Reset your password'}
            {mode === 'confirmation_sent' && 'Confirm Your Email'}
            {mode === 'reset_sent' && 'Check Your Inbox'}
          </h2>

          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
            {mode === 'signup' &&
              'Join All Christian Songs to sync personal favorites and access church workspaces.'}
            {mode === 'login' &&
              'Sign in to access your cloud-synced favorites and church memberships.'}
            {mode === 'forgot_password' &&
              "Enter your account email and we'll send you a link to reset your password."}
            {mode === 'confirmation_sent' &&
              `We sent an activation link to ${email}. Please check your inbox.`}
            {mode === 'reset_sent' &&
              `We sent password reset instructions to ${email}.`}
          </p>
        </div>

        {/* Error Alert */}
        {displayedError && mode !== 'confirmation_sent' && mode !== 'reset_sent' && (
          <div className="mb-5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span className="leading-snug">{displayedError}</span>
          </div>
        )}

        {/* ===================================================================
            VIEW 1: SIGN IN
            =================================================================== */}
        {mode === 'login' && (
          <form onSubmit={handleSignIn} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor={emailId}
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Email Address <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id={emailId}
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  disabled={submitting}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/80 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label
                  htmlFor={passwordId}
                  className="block text-xs font-semibold text-slate-300"
                >
                  Password <span className="text-amber-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => switchMode('forgot_password')}
                  tabIndex={0}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-medium transition hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id={passwordId}
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={submitting}
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/80 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md hover:shadow-amber-500/25 flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Secondary: Switch to Sign Up */}
            <div className="pt-3 border-t border-slate-800 text-center text-xs text-slate-400 space-y-2">
              <div>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="font-bold text-amber-400 hover:text-amber-300 transition hover:underline"
                >
                  Create Account
                </button>
              </div>
              <div>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-200 transition text-[11px] underline"
                >
                  Continue browsing as guest
                </button>
              </div>

              {/* Discreet Admin Portal Entry */}
              {onOpenAdmin && (
                <div className="pt-2.5 border-t border-slate-800/80 mt-2.5 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAdmin();
                    }}
                    className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-amber-400/90 transition-colors py-1 px-2.5 rounded-lg hover:bg-slate-800/40"
                    title="Platform administrator access"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 opacity-60" />
                    <span>Admin Portal</span>
                  </button>
                </div>
              )}
            </div>
          </form>
        )}

        {/* ===================================================================
            VIEW 2: CREATE ACCOUNT (SIGN UP)
            =================================================================== */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-3.5" noValidate>
            {/* First & Last Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor={firstNameId}
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  First Name <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id={firstNameId}
                    type="text"
                    required
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Stacy"
                    disabled={submitting}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor={lastNameId}
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Last Name <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id={lastNameId}
                    type="text"
                    required
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Evangelin"
                    disabled={submitting}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition"
                  />
                </div>
              </div>
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor={emailId}
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Email Address <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id={emailId}
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  disabled={submitting}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor={passwordId}
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Password <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id={passwordId}
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  disabled={submitting}
                  className="w-full pl-10 pr-10 py-2 text-sm bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password strength bar */}
              {password.length > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden flex gap-1">
                    <div
                      className={`h-full transition-all ${passwordStrength.score >= 1 ? passwordStrength.color : 'bg-transparent'
                        } w-1/4 rounded-full`}
                    />
                    <div
                      className={`h-full transition-all ${passwordStrength.score >= 2 ? passwordStrength.color : 'bg-transparent'
                        } w-1/4 rounded-full`}
                    />
                    <div
                      className={`h-full transition-all ${passwordStrength.score >= 3 ? passwordStrength.color : 'bg-transparent'
                        } w-1/4 rounded-full`}
                    />
                    <div
                      className={`h-full transition-all ${passwordStrength.score >= 4 ? passwordStrength.color : 'bg-transparent'
                        } w-1/4 rounded-full`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {passwordStrength.label}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor={confirmPasswordId}
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Confirm Password <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id={confirmPasswordId}
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  disabled={submitting}
                  className={`w-full pl-10 pr-10 py-2 text-sm bg-slate-950/70 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition ${confirmPassword && confirmPassword !== password
                      ? 'border-rose-500/60 focus:ring-rose-400/50'
                      : confirmPassword && confirmPassword === password
                        ? 'border-emerald-500/60 focus:ring-emerald-400/50'
                        : 'border-slate-700/80 focus:ring-amber-400/50'
                    }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Primary CTA: Create Account */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md hover:shadow-amber-500/25 flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Secondary CTA: Sign In */}
            <div className="pt-3 border-t border-slate-800 text-center text-xs text-slate-400 space-y-2">
              <div>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-bold text-amber-400 hover:text-amber-300 transition hover:underline"
                >
                  Sign in
                </button>
              </div>
              <div>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-200 transition text-[11px] underline"
                >
                  Continue browsing as guest
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ===================================================================
            VIEW 3: FORGOT PASSWORD
            =================================================================== */}
        {mode === 'forgot_password' && (
          <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor={emailId}
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Account Email Address <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id={emailId}
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  disabled={submitting}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md hover:shadow-amber-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending reset link...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Send Reset Link</span>
                </>
              )}
            </button>

            <div className="pt-3 border-t border-slate-800 text-center text-xs text-slate-400 space-y-2">
              <div>
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-bold text-amber-400 hover:text-amber-300 transition hover:underline"
                >
                  Sign in
                </button>
              </div>
              <div>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-200 transition text-[11px] underline"
                >
                  Continue browsing as guest
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ===================================================================
            VIEW 4: CONFIRMATION EMAIL SENT NOTICE
            =================================================================== */}
        {mode === 'confirmation_sent' && (
          <div className="text-center space-y-5 py-2">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Check your email</h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
                We sent a confirmation email to <span className="text-amber-300 font-semibold">{email}</span>. Please click the link in that email to activate your account.
              </p>
            </div>

            <div className="p-3 bg-slate-800/60 border border-slate-700/80 rounded-xl text-[11px] text-slate-400 text-left space-y-1">
              <p className="font-semibold text-slate-300">Didn't receive the email?</p>
              <p>• Check your spam or junk folder.</p>
              <p>• Ensure your email was entered correctly.</p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-md"
              >
                Proceed to Sign In
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-slate-200 transition underline block mx-auto"
              >
                Continue browsing as guest
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================
            VIEW 5: PASSWORD RESET EMAIL SENT NOTICE
            =================================================================== */}
        {mode === 'reset_sent' && (
          <div className="text-center space-y-5 py-2">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
              <Mail className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Reset Link Sent</h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
                If an account exists for <span className="text-amber-300 font-semibold">{email}</span>, you will receive password reset instructions shortly.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-md"
              >
                Back to Sign In
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-slate-200 transition underline block mx-auto"
              >
                Continue browsing as guest
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
