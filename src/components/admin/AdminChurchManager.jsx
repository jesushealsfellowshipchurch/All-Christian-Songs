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
  ExternalLink,
  Plus,
  X,
  Globe,
  FileText,
  UserCheck,
  UserX,
  Users
} from 'lucide-react';
import {
  fetchAdminChurchesList,
  adminSetVerification,
  adminSetOperationalStatus,
  adminSetDirectoryVisibility,
  createChurch,
  generateSlug,
  isValidSlug,
  adminAssignChurchPastor,
  searchPlatformUsers,
  getChurchPastor
} from '../../services/churchService';
import LocationCombobox from './LocationCombobox';

export default function AdminChurchManager() {
  const [churches, setChurches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'verified' | 'unverified' | 'rejected' | 'inactive'
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [operatingId, setOperatingId] = useState(null);

  // Directory Visibility Confirmation Modal State
  const [visibilityConfirmTarget, setVisibilityConfirmTarget] = useState(null);
  // { church: Object, targetIsPublic: boolean }
  const [updatingVisibility, setUpdatingVisibility] = useState(false);

  // Pastor Management State (Step 4D)
  const [pastors, setPastors] = useState({}); // { [churchId]: { id, full_name, role } | null }
  const [loadingPastors, setLoadingPastors] = useState(false);
  const [pastorModalTarget, setPastorModalTarget] = useState(null); // church object or null
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [userSearchError, setUserSearchError] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [isConfirmingAssignment, setIsConfirmingAssignment] = useState(false);
  const [assigningPastor, setAssigningPastor] = useState(false);
  const [pastorAssignError, setPastorAssignError] = useState('');

  // Create Church Modal State
  const initialForm = {
    name: '',
    slug: '',
    city: '',
    state_province: '',
    country: '',
    description: '',
    website_url: '',
    is_public: false
  };
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState(initialForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Geographic Dataset (Dynamically imported when modal opens)
  const [geoLib, setGeoLib] = useState(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [selectedCountryIso, setSelectedCountryIso] = useState('');
  const [selectedStateIso, setSelectedStateIso] = useState('');

  const countryOptions = useMemo(() => {
    return geoLib?.Country?.getAllCountries() || [];
  }, [geoLib]);

  const stateOptions = useMemo(() => {
    if (!geoLib || !selectedCountryIso) return [];
    return geoLib.State.getStatesOfCountry(selectedCountryIso) || [];
  }, [geoLib, selectedCountryIso]);

  const cityOptions = useMemo(() => {
    if (!geoLib || !selectedCountryIso || !selectedStateIso) return [];
    return geoLib.City.getCitiesOfState(selectedCountryIso, selectedStateIso) || [];
  }, [geoLib, selectedCountryIso, selectedStateIso]);

  const loadPastorsForChurches = async (churchList) => {
    if (!churchList || churchList.length === 0) {
      setPastors({});
      return;
    }
    setLoadingPastors(true);
    const pastorMap = {};
    await Promise.all(
      churchList.map(async (c) => {
        try {
          const res = await getChurchPastor(c.id);
          if (res.success && res.data) {
            pastorMap[c.id] = {
              id: res.data.profile?.id || res.data.user_id,
              full_name: res.data.profile?.full_name || 'Unnamed user',
              role: res.data.profile?.role || null
            };
          } else {
            pastorMap[c.id] = null;
          }
        } catch {
          pastorMap[c.id] = null;
        }
      })
    );
    setPastors(pastorMap);
    setLoadingPastors(false);
  };

  const loadChurches = async () => {
    setLoading(true);
    setActionError('');
    const res = await fetchAdminChurchesList();
    if (res.success) {
      const churchList = res.data || [];
      setChurches(churchList);
      setLoading(false);
      await loadPastorsForChurches(churchList);
    } else {
      setActionError(res.error || 'Failed to load churches list.');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChurches();
  }, []);

  const handleOpenCreateModal = async () => {
    setCreateForm(initialForm);
    setSelectedCountryIso('');
    setSelectedStateIso('');
    setCreateError('');
    setIsCreateModalOpen(true);

    // Dynamic import isolates the ~8MB geographic dataset to the Create Church flow
    if (!geoLib) {
      setLoadingGeo(true);
      try {
        const { Country, State, City } = await import('country-state-city');
        setGeoLib({ Country, State, City });
      } catch (err) {
        setCreateError('Failed to load geographic dataset. Please check your connection or reload.');
      } finally {
        setLoadingGeo(false);
      }
    }
  };

  const handleCountrySelect = (option) => {
    if (!option) {
      setSelectedCountryIso('');
      setSelectedStateIso('');
      setCreateForm((prev) => ({
        ...prev,
        country: '',
        state_province: '',
        city: ''
      }));
      return;
    }

    setSelectedCountryIso(option.isoCode);
    setSelectedStateIso('');
    setCreateForm((prev) => ({
      ...prev,
      country: option.name,
      state_province: '',
      city: ''
    }));
  };

  const handleStateSelect = (option) => {
    if (!option) {
      setSelectedStateIso('');
      setCreateForm((prev) => ({
        ...prev,
        state_province: '',
        city: ''
      }));
      return;
    }

    setSelectedStateIso(option.isoCode);
    setCreateForm((prev) => ({
      ...prev,
      state_province: option.name,
      city: ''
    }));
  };

  const handleCitySelect = (option) => {
    if (!option) {
      setCreateForm((prev) => ({
        ...prev,
        city: ''
      }));
      return;
    }

    setCreateForm((prev) => ({
      ...prev,
      city: option.name
    }));
  };

  const handleNameChange = (e) => {
    const newName = e.target.value;
    setCreateForm((prev) => {
      const prevDerived = generateSlug(prev.name);
      const shouldAutoDerive = !prev.slug || prev.slug === prevDerived;
      return {
        ...prev,
        name: newName,
        slug: shouldAutoDerive ? generateSlug(newName) : prev.slug
      };
    });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError('');

    const trimmedName = createForm.name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setCreateError('Church name must be at least 2 characters.');
      return;
    }

    const trimmedCountry = createForm.country.trim();
    if (!trimmedCountry) {
      setCreateError('Please select a country.');
      return;
    }

    const trimmedState = createForm.state_province.trim();
    if (!trimmedState) {
      setCreateError('Please select a state or province.');
      return;
    }

    const trimmedCity = createForm.city.trim();
    if (!trimmedCity) {
      setCreateError('Please select a city.');
      return;
    }

    const trimmedSlug = createForm.slug.trim();
    if (trimmedSlug && !isValidSlug(trimmedSlug)) {
      setCreateError('Slug must be 3-60 lowercase alphanumeric characters with single hyphens (e.g., "grace-fellowship").');
      return;
    }

    const trimmedWebsite = createForm.website_url.trim();
    if (trimmedWebsite) {
      try {
        const url = new URL(trimmedWebsite);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error();
        }
      } catch (_) {
        setCreateError('Website URL must be a valid URL starting with http:// or https://');
        return;
      }
    }

    setCreating(true);

    // Call existing churchService.createChurch()
    // Note: created_by, status, verification_status are strictly database-controlled
    const res = await createChurch({
      name: trimmedName,
      slug: trimmedSlug || undefined,
      city: trimmedCity,
      state_province: trimmedState,
      country: trimmedCountry,
      description: createForm.description.trim(),
      website_url: trimmedWebsite || null,
      is_public: Boolean(createForm.is_public)
    });

    if (res.success) {
      setActionSuccess(`Church "${res.data?.name || trimmedName}" created successfully in Awaiting Pastor state.`);
      setIsCreateModalOpen(false);
      setCreateForm(initialForm);
      setSelectedCountryIso('');
      setSelectedStateIso('');
      await loadChurches();
    } else {
      setCreateError(res.error || 'Failed to create church workspace.');
    }
    setCreating(false);
  };

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

  const handleRequestVisibilityChange = (church, targetIsPublic) => {
    setActionError('');
    setActionSuccess('');
    setVisibilityConfirmTarget({ church, targetIsPublic });
  };

  const handleCancelVisibilityChange = () => {
    if (updatingVisibility) return;
    setVisibilityConfirmTarget(null);
  };

  const handleConfirmVisibilityChange = async () => {
    if (!visibilityConfirmTarget) return;
    const { church, targetIsPublic } = visibilityConfirmTarget;
    const churchId = church.id;

    setUpdatingVisibility(true);
    setOperatingId(churchId);
    setActionError('');
    setActionSuccess('');

    const res = await adminSetDirectoryVisibility(churchId, targetIsPublic);

    if (res.success) {
      setVisibilityConfirmTarget(null);

      // Reconcile local row state
      setChurches((prev) =>
        prev.map((c) => (c.id === churchId ? { ...c, is_public: targetIsPublic } : c))
      );

      // Informative toast feedback strictly adhering to product rules
      if (targetIsPublic) {
        if (church.verification_status === 'verified' && church.status === 'active') {
          setActionSuccess(`Church directory visibility updated. ${church.name} is now Public.`);
        } else {
          setActionSuccess('Directory setting updated. Public listing will become visible after the church is verified and active.');
        }
      } else {
        setActionSuccess(`Church directory visibility updated. ${church.name} is now Private.`);
      }

      await loadChurches();
    } else {
      setActionError(res.error || 'Failed to update directory visibility.');
      setVisibilityConfirmTarget(null);
    }

    setUpdatingVisibility(false);
    setOperatingId(null);
  };

  // Debounced search for platform users in Pastor selector modal
  useEffect(() => {
    if (!pastorModalTarget) {
      setUserSearchResults([]);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      setSearchingUsers(true);
      setUserSearchError('');
      const res = await searchPlatformUsers(userSearchQuery);
      if (!isCancelled) {
        if (res.success) {
          setUserSearchResults(res.data || []);
        } else {
          setUserSearchError(res.error || 'Failed to search registered platform users.');
        }
        setSearchingUsers(false);
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [userSearchQuery, pastorModalTarget]);

  const handleOpenPastorModal = (church) => {
    setActionError('');
    setActionSuccess('');
    setPastorModalTarget(church);
    setUserSearchQuery('');
    setSelectedUser(null);
    setIsConfirmingAssignment(false);
    setPastorAssignError('');
    setUserSearchError('');
  };

  const handleClosePastorModal = () => {
    if (assigningPastor) return;
    setPastorModalTarget(null);
    setSelectedUser(null);
    setUserSearchQuery('');
    setUserSearchResults([]);
    setIsConfirmingAssignment(false);
    setPastorAssignError('');
    setUserSearchError('');
  };

  const handleConfirmAssignPastor = async () => {
    if (!pastorModalTarget || !selectedUser) return;
    const churchId = pastorModalTarget.id;
    const churchName = pastorModalTarget.name;
    const targetUserId = selectedUser.id;
    const targetUserName = selectedUser.full_name || 'Unnamed user';
    const isChange = Boolean(pastors[churchId]);

    setAssigningPastor(true);
    setPastorAssignError('');
    setActionError('');
    setActionSuccess('');

    const res = await adminAssignChurchPastor(churchId, targetUserId);

    if (res.success) {
      // Refresh pastor state for this specific church
      const pastorRes = await getChurchPastor(churchId);
      if (pastorRes.success && pastorRes.data) {
        setPastors((prev) => ({
          ...prev,
          [churchId]: {
            id: pastorRes.data.profile?.id || pastorRes.data.user_id || targetUserId,
            full_name: pastorRes.data.profile?.full_name || targetUserName,
            role: pastorRes.data.profile?.role || selectedUser.role || null
          }
        }));
      } else {
        setPastors((prev) => ({
          ...prev,
          [churchId]: {
            id: targetUserId,
            full_name: targetUserName,
            role: selectedUser.role || null
          }
        }));
      }

      setActionSuccess(
        isChange
          ? `Pastor for "${churchName}" changed to ${targetUserName} successfully.`
          : `Pastor assigned to "${churchName}" successfully (${targetUserName}).`
      );

      // Close modal and reset state
      setPastorModalTarget(null);
      setSelectedUser(null);
      setIsConfirmingAssignment(false);
      setPastorAssignError('');
    } else {
      setPastorAssignError(res.error || 'Failed to assign pastor. Please try again.');
    }

    setAssigningPastor(false);
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

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-1.5 shadow-sm active:scale-95"
            title="Create a new church workspace"
          >
            <Plus className="w-4 h-4" />
            <span>Create Church</span>
          </button>

          <button
            type="button"
            onClick={loadChurches}
            disabled={loading}
            className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
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
                <th className="p-3 sm:p-4">Pastor</th>
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

                    {/* Pastor Assignment Status & Action */}
                    <td className="p-3 sm:p-4">
                      {loadingPastors && !pastors[c.id] && pastors[c.id] !== null ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 min-h-[44px]">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
                          <span>Checking Pastor...</span>
                        </div>
                      ) : pastors[c.id] ? (
                        <div className="space-y-1.5 min-w-[130px]">
                          <div className="flex flex-col gap-0.5">
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 max-w-[170px] truncate"
                              title={pastors[c.id].full_name || 'Unnamed user'}
                            >
                              <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="truncate">{pastors[c.id].full_name || 'Unnamed user'}</span>
                            </span>
                            {pastors[c.id].role === 'admin' && (
                              <span className="text-[10px] text-slate-400 pl-1 font-medium">
                                Platform Administrator
                              </span>
                            )}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => handleOpenPastorModal(c)}
                              disabled={isBusy}
                              aria-label={`Change Pastor for ${c.name}. Current: ${pastors[c.id].full_name || 'Unnamed user'}`}
                              className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <RefreshCw className="w-3 h-3 text-slate-400" />
                              <span>Change Pastor</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5 min-w-[130px]">
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <UserX className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>Awaiting Pastor</span>
                            </span>
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => handleOpenPastorModal(c)}
                              disabled={isBusy}
                              aria-label={`Assign Pastor for ${c.name}`}
                              className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span>Assign Pastor</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Directory Visibility Control */}
                    <td className="p-3 sm:p-4">
                      <button
                        type="button"
                        onClick={() => handleRequestVisibilityChange(c, !c.is_public)}
                        disabled={isBusy || updatingVisibility}
                        aria-label={`Directory visibility for ${c.name}: currently ${c.is_public ? 'Public' : 'Private'}. Click to make ${c.is_public ? 'Private' : 'Public'}.`}
                        title={c.is_public ? 'Click to make church Private' : 'Click to make church Public'}
                        className={`min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition active:scale-95 ${
                          c.is_public
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25 shadow-sm'
                            : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white shadow-sm'
                        } ${isBusy || updatingVisibility ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <span className="text-xs" aria-hidden="true">{c.is_public ? '🟢' : '⚪'}</span>
                        <span>{c.is_public ? 'Public' : 'Private'}</span>
                      </button>
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

      {/* Create Church Modal (Super Admin only) */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-church-modal-title"
        >
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Church className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="create-church-modal-title" className="text-base font-bold text-white">
                    Create Church Workspace
                  </h3>
                  <p className="text-xs text-slate-400">
                    Platform Administrator church registration
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !creating && setIsCreateModalOpen(false)}
                disabled={creating}
                aria-label="Close modal"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 space-y-4 overflow-y-auto flex-1">

                {/* Error Banner */}
                {createError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{createError}</span>
                  </div>
                )}

                {/* Church Name (Required) */}
                <div>
                  <label htmlFor="church-name-input" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Church Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="church-name-input"
                    type="text"
                    required
                    minLength={2}
                    value={createForm.name}
                    onChange={handleNameChange}
                    placeholder="e.g., Calvary Worship Center"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Minimum 2 characters. Used as the display name of the congregation.
                  </p>
                </div>

                {/* Workspace Slug (Optional, auto-derived) */}
                <div>
                  <label htmlFor="church-slug-input" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Workspace Slug <span className="text-slate-500 font-normal">(optional, auto-derived)</span>
                  </label>
                  <input
                    id="church-slug-input"
                    type="text"
                    value={createForm.slug}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, slug: e.target.value.toLowerCase() }))}
                    placeholder="calvary-worship-center"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Direct URL: <span className="font-mono text-slate-400">/church/{createForm.slug || 'calvary-worship-center'}</span>
                  </p>
                </div>

                {/* Location Hierarchy: Country -> State / Province -> City */}
                <div className="space-y-3">
                  <LocationCombobox
                    id="church-country"
                    label="Country"
                    required
                    value={createForm.country}
                    onChange={handleCountrySelect}
                    options={countryOptions}
                    placeholder={loadingGeo ? 'Loading countries...' : 'Search and select country...'}
                    disabled={loadingGeo || !geoLib}
                    loading={loadingGeo}
                    helperText={countryOptions.length > 0 ? `${countryOptions.length} countries available` : ''}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <LocationCombobox
                      id="church-state"
                      label="State / Province"
                      required
                      value={createForm.state_province}
                      onChange={handleStateSelect}
                      options={stateOptions}
                      placeholder={!selectedCountryIso ? 'Select Country first' : 'Search and select state...'}
                      disabled={!selectedCountryIso || loadingGeo}
                      disabledReason="Select Country first"
                      helperText={selectedCountryIso ? `${stateOptions.length} states/provinces found` : ''}
                    />

                    <LocationCombobox
                      id="church-city"
                      label="City"
                      required
                      value={createForm.city}
                      onChange={handleCitySelect}
                      options={cityOptions}
                      placeholder={!selectedStateIso ? 'Select State first' : 'Search and select city...'}
                      disabled={!selectedStateIso || loadingGeo}
                      disabledReason="Select State / Province first"
                      helperText={selectedStateIso ? `${cityOptions.length} cities available` : ''}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="church-desc-input" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Description <span className="text-slate-500 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="church-desc-input"
                    rows={2}
                    value={createForm.description}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of the congregation or ministry..."
                    className="w-full min-h-[60px] px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-400 transition resize-none"
                  />
                </div>

                {/* Website URL */}
                <div>
                  <label htmlFor="church-website-input" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Website URL <span className="text-slate-500 font-normal">(optional)</span>
                  </label>
                  <input
                    id="church-website-input"
                    type="url"
                    value={createForm.website_url}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, website_url: e.target.value }))}
                    placeholder="https://examplechurch.org"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-400 transition"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Must start with http:// or https:// if provided.
                  </p>
                </div>

                {/* Public Directory Listing (Toggle, default OFF) */}
                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-start gap-3">
                  <input
                    id="church-is-public-input"
                    type="checkbox"
                    checked={createForm.is_public}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, is_public: e.target.checked }))}
                    className="mt-1 w-4 h-4 rounded border-slate-600 text-amber-500 focus:ring-amber-400 focus:ring-offset-slate-900 cursor-pointer"
                  />
                  <div className="flex-1">
                    <label htmlFor="church-is-public-input" className="text-xs font-semibold text-white block cursor-pointer">
                      List in Public Church Directory
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Default is OFF (private workspace). When enabled, this church will be visible in the public directory once verified by an admin.
                    </p>
                  </div>
                </div>

                {/* Database Authority Notice */}
                <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Initial state: <strong>Active</strong>, <strong>Unverified</strong>, <strong>Awaiting Pastor</strong>.
                  </span>
                </div>

              </div>

              {/* Modal Footer Actions */}
              <div className="px-5 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={creating}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Workspace...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Create Workspace</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Directory Visibility Confirmation Dialog (Super Admin only) */}
      {visibilityConfirmTarget && (
        <div
          className="fixed inset-0 z-[130] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="visibility-confirm-title"
        >
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl border shrink-0 ${
                visibilityConfirmTarget.targetIsPublic
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}>
                <Globe className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="visibility-confirm-title" className="text-base font-bold text-white">
                  {visibilityConfirmTarget.targetIsPublic ? 'Make church public?' : 'Make church private?'}
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {visibilityConfirmTarget.targetIsPublic
                    ? 'This allows the church to become eligible for the public directory once it is Verified and Active.'
                    : 'This removes the church from public directory eligibility.'}
                </p>
                <div className="mt-3 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-[11px] text-slate-400">
                  <span className="font-semibold text-white">{visibilityConfirmTarget.church.name}</span>
                  <div className="flex items-center gap-2 mt-1 text-[10px]">
                    <span>Verification: <strong className="text-slate-300 capitalize">{visibilityConfirmTarget.church.verification_status}</strong></span>
                    <span>•</span>
                    <span>Workspace: <strong className="text-slate-300 capitalize">{visibilityConfirmTarget.church.status}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleCancelVisibilityChange}
                disabled={updatingVisibility}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVisibilityChange}
                disabled={updatingVisibility}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 ${
                  visibilityConfirmTarget.targetIsPublic
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                    : 'bg-slate-700 hover:bg-slate-600 text-white shadow-sm'
                }`}
              >
                {updatingVisibility ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>{visibilityConfirmTarget.targetIsPublic ? 'Make Public' : 'Make Private'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign / Change Pastor Modal (Super Admin only) */}
      {pastorModalTarget && (
        <div
          className="fixed inset-0 z-[140] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pastor-modal-title"
        >
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="pastor-modal-title" className="text-base font-bold text-white">
                    {pastors[pastorModalTarget.id] ? 'Change Church Pastor' : 'Assign Church Pastor'}
                  </h3>
                  <p className="text-xs text-slate-400 truncate max-w-[240px] sm:max-w-md">
                    {pastorModalTarget.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClosePastorModal}
                disabled={assigningPastor}
                aria-label="Close modal"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">

              {/* Error Banner */}
              {pastorAssignError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{pastorAssignError}</span>
                </div>
              )}

              {/* Current Pastor Status Card */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/70 text-xs text-slate-300">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Current Pastor
                </div>
                {pastors[pastorModalTarget.id] ? (
                  <div className="flex items-center gap-2 font-bold text-white">
                    <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{pastors[pastorModalTarget.id].full_name || 'Unnamed user'}</span>
                    <span className="text-[11px] font-normal text-slate-400">
                      ({pastors[pastorModalTarget.id].role === 'admin' ? 'Platform Administrator' : 'Active Pastor'})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 font-semibold text-amber-300">
                    <UserX className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Awaiting Pastor</span>
                    <span className="text-[11px] font-normal text-slate-400">
                      (No Pastor assigned yet)
                    </span>
                  </div>
                )}
              </div>

              {!isConfirmingAssignment ? (
                /* Step 1: Search and Select User */
                <div className="space-y-3">
                  <div>
                    <label htmlFor="pastor-search-input" className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Search Platform Users
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        id="pastor-search-input"
                        type="text"
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        placeholder="Search by user's full name..."
                        className="w-full min-h-[44px] pl-10 pr-4 py-2.5 text-sm bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Registered platform users only. Pastors must have an existing platform account.
                    </p>
                  </div>

                  {/* Search Error */}
                  {userSearchError && (
                    <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{userSearchError}</span>
                    </div>
                  )}

                  {/* Users Selection List */}
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>Available Users</span>
                      {searchingUsers && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                          <span>Searching...</span>
                        </span>
                      )}
                    </div>

                    <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/40 divide-y divide-slate-800/60">
                      {searchingUsers && userSearchResults.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                          <span>Loading platform users...</span>
                        </div>
                      ) : userSearchResults.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400">
                          {userSearchQuery
                            ? `No users found matching "${userSearchQuery}".`
                            : 'No registered platform users found.'}
                        </div>
                      ) : (
                        userSearchResults.map((user) => {
                          const isCurrent =
                            pastors[pastorModalTarget.id] &&
                            pastors[pastorModalTarget.id].id === user.id;
                          const isSelected = selectedUser?.id === user.id;

                          return (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => !isCurrent && setSelectedUser(user)}
                              disabled={isCurrent}
                              className={`w-full min-h-[48px] px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition ${
                                isCurrent
                                  ? 'opacity-50 cursor-not-allowed bg-slate-900/50 text-slate-500'
                                  : isSelected
                                  ? 'bg-amber-500/15 border-l-4 border-amber-400 text-white'
                                  : 'hover:bg-slate-800/60 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                    isSelected
                                      ? 'bg-amber-400 text-slate-950'
                                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                                  }`}
                                >
                                  {(user.full_name || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-xs text-white truncate">
                                    {user.full_name || 'Unnamed user'}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    {user.role === 'admin' ? 'Platform Administrator' : 'Platform User'}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center gap-2">
                                {isCurrent ? (
                                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                                    Current Pastor
                                  </span>
                                ) : isSelected ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full">
                                    <Check className="w-3 h-3" />
                                    <span>Selected</span>
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Step 2: Confirmation View */
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs leading-relaxed space-y-2">
                    <div className="font-bold text-sm text-white flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Confirm Pastor Assignment</span>
                    </div>
                    {pastors[pastorModalTarget.id] ? (
                      <p>
                        Are you sure you want to replace{' '}
                        <strong className="text-white font-bold">
                          {pastors[pastorModalTarget.id].full_name || 'Unnamed user'}
                        </strong>{' '}
                        with{' '}
                        <strong className="text-white font-bold">
                          {selectedUser.full_name || 'Unnamed user'}
                        </strong>{' '}
                        as the Pastor of{' '}
                        <strong className="text-white font-bold">
                          {pastorModalTarget.name}
                        </strong>
                        ?
                      </p>
                    ) : (
                      <p>
                        Are you sure you want to assign{' '}
                        <strong className="text-white font-bold">
                          {selectedUser.full_name || 'Unnamed user'}
                        </strong>{' '}
                        as the Pastor of{' '}
                        <strong className="text-white font-bold">
                          {pastorModalTarget.name}
                        </strong>
                        ?
                      </p>
                    )}
                    <p className="text-[11px] text-amber-300/80">
                      {pastors[pastorModalTarget.id]
                        ? 'The previous Pastor will transition to a regular fellowship member. No historical records or memberships will be deleted.'
                        : 'The assigned user will receive Pastor role and full leadership access for this church workspace.'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs space-y-1.5">
                    <div className="text-slate-400 text-[11px]">Selected Candidate:</div>
                    <div className="font-bold text-white flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{selectedUser.full_name || 'Unnamed user'}</span>
                      <span className="text-[11px] font-normal text-slate-400">
                        ({selectedUser.role === 'admin' ? 'Platform Administrator' : 'Platform User'})
                      </span>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer Actions */}
            <div className="px-5 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={isConfirmingAssignment ? () => setIsConfirmingAssignment(false) : handleClosePastorModal}
                disabled={assigningPastor}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition"
              >
                {isConfirmingAssignment ? 'Back' : 'Cancel'}
              </button>

              {!isConfirmingAssignment ? (
                <button
                  type="button"
                  onClick={() => setIsConfirmingAssignment(true)}
                  disabled={!selectedUser || (pastors[pastorModalTarget.id]?.id === selectedUser.id)}
                  className="min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  <span>Continue</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmAssignPastor}
                  disabled={assigningPastor}
                  className="min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {assigningPastor ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Assigning Pastor...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>
                        {pastors[pastorModalTarget.id] ? 'Confirm Change' : 'Confirm Assignment'}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
