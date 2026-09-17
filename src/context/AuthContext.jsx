import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';

const AuthContext = createContext({
  session: null,
  user: null,
  profile: null,
  loading: true,
  error: null,
  signIn: async () => ({ success: false, error: 'Not initialized' }),
  signOut: async () => ({ success: false, error: 'Not initialized' }),
  clearError: () => {}
});

/**
 * Transforms Supabase auth error messages into clean, human-readable user notices.
 * Never exposes raw error objects or database details to clients.
 */
export function formatAuthError(error) {
  if (!error) return null;
  const msg = typeof error === 'string' ? error : error.message || '';
  const lower = msg.toLowerCase();

  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid_credentials') ||
    lower.includes('invalid grant')
  ) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Your email address has not been confirmed. Please check your inbox.';
  }
  if (lower.includes('user not found')) {
    return 'No account was found with this email address.';
  }
  if (
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('failed to fetch') ||
    lower.includes('connection refused')
  ) {
    return 'Unable to connect to authentication service. Please check your internet connection.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Too many login attempts. Please wait a moment before trying again.';
  }
  if (lower.includes('session expired') || lower.includes('jwt expired')) {
    return 'Your session has expired. Please sign in again.';
  }
  return msg || 'Authentication failed. Please try again.';
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Safely read authenticated user's profile from public.profiles using auth.uid()
  const loadProfile = useCallback(async (userId) => {
    if (!supabase || !userId) {
      setProfile(null);
      return;
    }
    try {
      const { data, error: profileErr } = await supabase
        .from('profiles')
        .select('id, full_name, role, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();

      if (profileErr) {
        console.warn('Profile fetch notice:', profileErr.message);
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.warn('Profile fetch exception:', err);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!supabase) {
      setLoading(false);
      return;
    }

    // 1. Session restoration on page load/refresh
    supabase.auth
      .getSession()
      .then(async ({ data: { session: initialSession }, error: sessionErr }) => {
        if (!isMounted) return;
        if (sessionErr) {
          console.warn('Session restoration notice:', sessionErr.message);
          setSession(null);
          setUser(null);
          setProfile(null);
        } else {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          if (initialSession?.user?.id) {
            await loadProfile(initialSession.user.id);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Session retrieval exception:', err);
        if (isMounted) setLoading(false);
      });

    // 2. Real-time auth state change subscription
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (!isMounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user?.id) {
        await loadProfile(currentSession.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [loadProfile]);

  // Secure sign in using Supabase email/password auth
  const signIn = useCallback(
    async ({ email, password }) => {
      setError(null);

      if (!email || !email.trim() || !password) {
        const errStr = 'Please enter both email and password.';
        setError(errStr);
        return { success: false, error: errStr };
      }

      if (!supabase) {
        const errStr = 'Authentication service is not configured.';
        setError(errStr);
        return { success: false, error: errStr };
      }

      try {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });

        if (authError) {
          const formatted = formatAuthError(authError);
          setError(formatted);
          return { success: false, error: formatted };
        }

        setSession(data.session);
        setUser(data.user);
        if (data.user?.id) {
          await loadProfile(data.user.id);
        }
        setError(null);
        return { success: true, user: data.user, session: data.session };
      } catch (err) {
        const formatted = formatAuthError(err);
        setError(formatted);
        return { success: false, error: formatted };
      }
    },
    [loadProfile]
  );

  // Secure sign out
  const signOut = useCallback(async () => {
    setError(null);
    if (!supabase) {
      setSession(null);
      setUser(null);
      setProfile(null);
      return { success: true };
    }

    try {
      const { error: signOutErr } = await supabase.auth.signOut();
      if (signOutErr) {
        const formatted = formatAuthError(signOutErr);
        setError(formatted);
        return { success: false, error: formatted };
      }
      setSession(null);
      setUser(null);
      setProfile(null);
      setError(null);
      return { success: true };
    } catch (err) {
      const formatted = formatAuthError(err);
      setError(formatted);
      return { success: false, error: formatted };
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = {
    session,
    user,
    profile,
    loading,
    error,
    signIn,
    signOut,
    clearError
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
