import React, { useState, useEffect, useMemo } from 'react';
import {
  Church,
  Search,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Power,
  PowerOff,
  MapPin,
  Calendar,
  AlertCircle,
  Check,
  Loader2,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import {
  fetchAdminChurchesList,
  adminSetVerification,
  adminSetOperationalStatus
} from '../../services/churchService';

export default function AdminChurchManager() {
  const [churches, setChurches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'verified' | 'unverified' | 'rejected' | 'inactive'
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [operatingId, setOperatingId] = useState(null);

  const loadChurches = async () => {
    setLoading(true);
    setActionError('');
    const res = await fetchAdminChurchesList();
    if (res.success) {
      setChurches(res.data || []);
    } else {
      setActionError(res.error || 'Failed to load churches list.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadChurches();
  }, []);

  const handleVerificationChange = async (churchId, newStatus) => {
    setOperatingId(churchId);
    setActionError('');
    setActionSuccess('');

    const res = await adminSetVerification(churchId, newStatus);
    if (res.success) {
      setActionSuccess(`Church verification status set to ${newStatus}.`);
      await loadChurches();
    } else {
      setActionError(res.error || 'Failed to update verification status.');
    }
    setOperatingId(null);
  };

  const handleOperationalStatusChange = async (churchId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const confirmMsg = nextStatus === 'inactive'
      ? 'Deactivating this church will block workspace access for all its members. Proceed?'
      : 'Reactivate this church workspace?';

    if (!window.confirm(confirmMsg)) return;

    setOperatingId(churchId);
    setActionError('');
    setActionSuccess('');

    const res = await adminSetOperationalStatus(churchId, nextStatus);
    if (res.success) {
      setActionSuccess(`Church workspace status set to ${nextStatus}.`);
      await loadChurches();
    } else {
      setActionError(res.error || 'Failed to update operational status.');
    }
    setOperatingId(null);
  };

  const filteredChurches = useMemo(() => {
    return churches.filter(c => {
      // Status filter
      if (filterStatus === 'verified' && c.verification_status !== 'verified') return false;
      if (filterStatus === 'unverified' && c.verification_status !== 'unverified') return false;
      if (filterStatus === 'rejected' && c.verification_status !== 'rejected') return false;
      if (filterStatus === 'inactive' && c.status !== 'inactive') return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.slug && c.slug.toLowerCase().includes(q))
      );
    });
  }, [churches, filterStatus, searchQuery]);

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Church className="w-5 h-5 text-amber-400" />
            <span>Church Workspaces Administration</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Oversee congregations, manage directory verification, and control workspace operational statuses.
          </p>
        </div>

        <button
          onClick={loadChurches}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Controls: Search & Status Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search churches by name, slug, or city..."
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 shrink-0">
          {[
            { id: 'all', label: `All (${churches.length})` },
            { id: 'verified', label: 'Verified' },
            { id: 'unverified', label: 'Unverified' },
            { id: 'rejected', label: 'Rejected' },
            { id: 'inactive', label: 'Inactive' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterStatus(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                filterStatus === f.id
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Churches Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2 bg-slate-900/40 rounded-2xl border border-slate-800">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading church workspaces...</span>
        </div>
      ) : filteredChurches.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-sm bg-slate-900/30 rounded-2xl border border-slate-800">
          No church workspaces found matching filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                <th className="p-3 sm:p-4">Church Workspace</th>
                <th className="p-3 sm:p-4">Location</th>
                <th className="p-3 sm:p-4">Directory</th>
                <th className="p-3 sm:p-4">Verification</th>
                <th className="p-3 sm:p-4">Workspace</th>
                <th className="p-3 sm:p-4 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {filteredChurches.map(c => {
                const isBusy = operatingId === c.id;
                return (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition">
                    
                    {/* Name & Slug */}
                    <td className="p-3 sm:p-4">
                      <div className="font-bold text-white">{c.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        /church/{c.slug}
                      </div>
                    </td>

                    {/* Location */}
                    <td className="p-3 sm:p-4 text-slate-400">
                      {c.city || c.country || '—'}
                    </td>

                    {/* Directory Visibility */}
                    <td className="p-3 sm:p-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        c.is_public
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {c.is_public ? 'Public' : 'Private'}
                      </span>
                    </td>

                    {/* Verification Status */}
                    <td className="p-3 sm:p-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        c.verification_status === 'verified'
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                          : c.verification_status === 'rejected'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}>
                        {c.verification_status === 'verified' && <ShieldCheck className="w-3 h-3" />}
                        {c.verification_status === 'rejected' && <ShieldX className="w-3 h-3" />}
                        {c.verification_status === 'unverified' && <ShieldAlert className="w-3 h-3" />}
                        <span className="capitalize">{c.verification_status}</span>
                      </span>
                    </td>

                    {/* Operational Status */}
                    <td className="p-3 sm:p-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        c.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}>
                        {c.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-3 sm:p-4 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        
                        {/* Verification controls */}
                        {c.verification_status !== 'verified' && (
                          <button
                            onClick={() => handleVerificationChange(c.id, 'verified')}
                            disabled={isBusy}
                            title="Verify church for public directory"
                            className="px-2 py-1 rounded-lg text-[11px] font-bold bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/30 transition"
                          >
                            Verify
                          </button>
                        )}
                        {c.verification_status === 'verified' && (
                          <button
                            onClick={() => handleVerificationChange(c.id, 'unverified')}
                            disabled={isBusy}
                            title="Remove verified badge"
                            className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition"
                          >
                            Unverify
                          </button>
                        )}
                        {c.verification_status !== 'rejected' && (
                          <button
                            onClick={() => handleVerificationChange(c.id, 'rejected')}
                            disabled={isBusy}
                            title="Mark as rejected"
                            className="px-2 py-1 rounded-lg text-[11px] font-bold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition"
                          >
                            Reject
                          </button>
                        )}

                        {/* Operational status toggle */}
                        <button
                          onClick={() => handleOperationalStatusChange(c.id, c.status)}
                          disabled={isBusy}
                          title={c.status === 'active' ? 'Deactivate workspace' : 'Activate workspace'}
                          className={`p-1.5 rounded-lg border transition ${
                            c.status === 'active'
                              ? 'text-rose-400 hover:bg-rose-500/10 border-rose-500/20'
                              : 'text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/20'
                          }`}
                        >
                          {c.status === 'active' ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                        </button>

                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
