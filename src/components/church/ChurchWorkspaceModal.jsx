import React, { useState, useEffect } from 'react';
import {
  X,
  Church,
  Users,
  Sliders,
  Settings,
  Shield,
  ShieldCheck,
  UserCheck,
  UserX,
  AlertCircle,
  Loader2,
  Check,
  ChevronDown,
  Globe,
  MapPin,
  ExternalLink,
  LogOut,
  Music
} from 'lucide-react';
import ChurchWorshipTab from './ChurchWorshipTab';
import { useChurch } from '../../context/ChurchContext';
import { useFeatures } from '../../context/FeatureContext';
import {
  fetchChurchMembers,
  updateMemberStatus,
  updateMemberRole,
  removeMember
} from '../../services/churchService';

export default function ChurchWorkspaceModal({ isOpen, onClose, onOpenMyChurches, onSelectSong }) {
  const {
    activeChurch,
    activeChurches,
    myChurches,
    selectChurch,
    isPastor,
    isWorshipLeader,
    isMember,
    updateProfile,
    toggleChurchFeature,
    leaveCurrentChurch,
    isChurchFeatureActive
  } = useChurch();

  const churchList = activeChurches && activeChurches.length >= 0 ? activeChurches : (myChurches || []);

  const { isFeatureEnabled } = useFeatures();

  const [activeTab, setActiveTab] = useState('overview');
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Settings form state (for Pastor)
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    description: '',
    city: '',
    state_province: '',
    country: 'India',
    website_url: '',
    logo_url: '',
    is_public: false
  });

  // Load members when modal opens or active church changes
  useEffect(() => {
    if (isOpen && activeChurch?.id) {
      setActiveTab('overview');
      setActionError('');
      setActionSuccess('');
      setSettingsForm({
        name: activeChurch.name || '',
        description: activeChurch.description || '',
        city: activeChurch.city || '',
        state_province: activeChurch.state_province || '',
        country: activeChurch.country || 'India',
        website_url: activeChurch.website_url || '',
        logo_url: activeChurch.logo_url || '',
        is_public: Boolean(activeChurch.is_public)
      });
      loadMembers();
    }
  }, [isOpen, activeChurch?.id]);

  const loadMembers = async () => {
    if (!activeChurch?.id) return;
    setLoadingMembers(true);
    const res = await fetchChurchMembers(activeChurch.id);
    if (res.success) {
      setMembers(res.data || []);
    } else {
      setActionError(res.error || 'Failed to load member roster.');
    }
    setLoadingMembers(false);
  };

  if (!isOpen || !activeChurch) return null;

  const pendingMembers = members.filter(m => m.status === 'pending');
  const activeMembers = members.filter(m => m.status === 'active');
  const suspendedMembers = members.filter(m => m.status === 'suspended');

  // Handle member status change (approve / suspend)
  const handleStatusChange = async (membershipId, newStatus) => {
    setIsSubmitting(true);
    setActionError('');
    setActionSuccess('');
    const res = await updateMemberStatus(membershipId, newStatus);
    if (res.success) {
      setActionSuccess(newStatus === 'active' ? 'Member approved successfully.' : 'Member status updated.');
      await loadMembers();
    } else {
      setActionError(res.error || 'Failed to update member status.');
    }
    setIsSubmitting(false);
  };

  // Handle member role change (Pastor only)
  const handleRoleChange = async (membershipId, newRole) => {
    setIsSubmitting(true);
    setActionError('');
    setActionSuccess('');
    const res = await updateMemberRole(membershipId, newRole);
    if (res.success) {
      setActionSuccess(`Role updated to ${newRole}.`);
      await loadMembers();
    } else {
      setActionError(res.error || 'Failed to update role.');
    }
    setIsSubmitting(false);
  };

  // Handle member removal / leave
  const handleRemoveMember = async (membershipId, isSelf = false) => {
    const confirmMsg = isSelf
      ? 'Are you sure you want to leave this church workspace?'
      : 'Are you sure you want to remove this member from the fellowship?';
    if (!window.confirm(confirmMsg)) return;

    setIsSubmitting(true);
    setActionError('');
    setActionSuccess('');
    const res = await removeMember(membershipId);
    if (res.success) {
      setActionSuccess(isSelf ? 'You have left the church.' : 'Member removed.');
      if (isSelf) {
        onClose();
      } else {
        await loadMembers();
      }
    } else {
      setActionError(res.error || 'Failed to remove member.');
    }
    setIsSubmitting(false);
  };

  // Save Settings (Pastor only)
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setActionError('');
    setActionSuccess('');
    const res = await updateProfile(activeChurch.id, settingsForm);
    if (res.success) {
      setActionSuccess('Church profile updated successfully.');
    } else {
      setActionError(res.error || 'Failed to update church profile.');
    }
    setIsSubmitting(false);
  };

  // Toggle Feature Override (Pastor only)
  const handleToggleFeature = async (featureId, currentState) => {
    setIsSubmitting(true);
    setActionError('');
    setActionSuccess('');
    const nextState = !currentState;
    const res = await toggleChurchFeature(featureId, nextState);
    if (res.success) {
      setActionSuccess(`Feature ${nextState ? 'enabled' : 'disabled'} for workspace.`);
    } else {
      setActionError(res.error || 'Failed to update feature override.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Church className="w-6 h-6 text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-white truncate">
                  {activeChurch.name}
                </h2>
                {activeChurch.verification_status === 'verified' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    <ShieldCheck className="w-3 h-3" /> Verified
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  activeChurch.status === 'active'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                }`}>
                  {activeChurch.status === 'active' ? 'Active Workspace' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate flex items-center gap-2 mt-0.5">
                {activeChurch.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-500" /> {activeChurch.city}
                  </span>
                )}
                <span>•</span>
                <span className="capitalize font-medium text-amber-300/90">
                  Role: {activeChurch.role || 'Member'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {churchList.length > 1 && (
              <button
                onClick={onOpenMyChurches}
                className="px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              >
                Switch Church
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Role-Aware Navigation Tabs */}
        <div className="flex border-b border-slate-800 px-4 sm:px-6 bg-slate-900/50 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition shrink-0 ${
              activeTab === 'overview'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Overview
          </button>

          {/* Worship Tab: Repertoire & Song Collections */}
          <button
            onClick={() => setActiveTab('worship')}
            className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'worship'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>Worship</span>
          </button>

          {/* Roster tab: Available to Pastor and Worship Leader */}
          {(isPastor || isWorshipLeader) && (
            <button
              onClick={() => setActiveTab('roster')}
              className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-1.5 shrink-0 ${
                activeTab === 'roster'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{isPastor ? 'Roster & Approvals' : 'Team Directory'}</span>
              {isPastor && pendingMembers.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">
                  {pendingMembers.length}
                </span>
              )}
            </button>
          )}

          {/* Pastor Only Tabs: Governance & Features */}
          {isPastor && (
            <>
              <button
                onClick={() => setActiveTab('settings')}
                className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'settings'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>

              <button
                onClick={() => setActiveTab('features')}
                className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'features'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span>Features</span>
              </button>
            </>
          )}
        </div>

        {/* Notifications / Feedback */}
        {actionSuccess && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">About Our Fellowship</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {activeChurch.description || 'No description provided yet for this congregation.'}
                </p>
                {activeChurch.website_url && (
                  <a
                    href={activeChurch.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold mt-3"
                  >
                    <span>Visit Official Website</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Fellowship Members</span>
                  <div className="text-2xl font-bold text-white mt-1">{activeMembers.length}</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Directory Status</span>
                  <div className="text-sm font-bold text-amber-400 capitalize mt-2">
                    {activeChurch.is_public ? 'Public Listing' : 'Private Workspace'}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 col-span-2 sm:col-span-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Direct Church Link</span>
                  <div className="text-xs text-slate-300 font-mono mt-2 truncate" title={`/church/${activeChurch.slug}`}>
                    /church/{activeChurch.slug}
                  </div>
                </div>
              </div>

              {/* Leave church action (for regular members) */}
              {isMember && !isPastor && (
                <div className="pt-4 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => handleRemoveMember(activeChurch.membershipId, true)}
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Leave Church
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB: WORSHIP REPERTOIRE & COLLECTIONS */}
          {activeTab === 'worship' && (
            <ChurchWorshipTab
              activeChurch={activeChurch}
              isPastor={isPastor}
              isWorshipLeader={isWorshipLeader}
              isMember={isMember}
              isWorshipActive={isChurchFeatureActive('church_worship_collections')}
              onSelectSong={(song) => {
                onClose();
                if (onSelectSong) onSelectSong(song);
              }}
              onNavigateToFeatures={() => setActiveTab('features')}
            />
          )}

          {/* TAB 2: ROSTER & APPROVALS (Pastor & Worship Leader) */}
          {activeTab === 'roster' && (
            <div className="space-y-6">
              
              {/* Pending Join Requests (Pastor Only) */}
              {isPastor && pendingMembers.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <UserCheck className="w-4 h-4" />
                    <span>Pending Join Requests ({pendingMembers.length})</span>
                  </h3>
                  <div className="divide-y divide-slate-800 rounded-2xl bg-slate-800/40 border border-slate-700/60 overflow-hidden">
                    {pendingMembers.map(m => (
                      <div key={m.id} className="p-3.5 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">User ID: {m.user_id.slice(0, 8)}...</p>
                          <p className="text-xs text-slate-400">Requested: {new Date(m.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleStatusChange(m.id, 'active')}
                            disabled={isSubmitting}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => handleRemoveMember(m.id)}
                            disabled={isSubmitting}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Fellowship Members Roster */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>Active Fellowship Directory ({activeMembers.length})</span>
                </h3>

                {loadingMembers ? (
                  <div className="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading members...
                  </div>
                ) : activeMembers.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-sm bg-slate-800/20 rounded-2xl border border-slate-800">
                    No active members in roster yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800 rounded-2xl bg-slate-800/40 border border-slate-800 overflow-hidden">
                    {activeMembers.map(m => (
                      <div key={m.id} className="p-3.5 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">Member ({m.user_id.slice(0, 8)})</p>
                          <p className="text-xs text-slate-400">Joined: {new Date(m.created_at).toLocaleDateString()}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Pastor can change roles; Worship Leader sees read-only badge */}
                          {isPastor ? (
                            <select
                              value={m.role}
                              onChange={(e) => handleRoleChange(m.id, e.target.value)}
                              disabled={isSubmitting}
                              className="text-xs font-semibold bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-400"
                            >
                              <option value="member">Member</option>
                              <option value="worship_leader">Worship Leader</option>
                              <option value="pastor">Pastor</option>
                            </select>
                          ) : (
                            <span className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-800 text-amber-300 border border-slate-700 capitalize">
                              {m.role.replace('_', ' ')}
                            </span>
                          )}

                          {isPastor && (
                            <button
                              onClick={() => handleRemoveMember(m.id)}
                              disabled={isSubmitting}
                              title="Remove member"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: SETTINGS (Pastor Only) */}
          {isPastor && activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Congregation Name</label>
                  <input
                    type="text"
                    required
                    value={settingsForm.name}
                    onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-amber-400/50 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">City</label>
                  <input
                    type="text"
                    value={settingsForm.city}
                    onChange={(e) => setSettingsForm({ ...settingsForm, city: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-amber-400/50 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">State / Province</label>
                  <input
                    type="text"
                    value={settingsForm.state_province}
                    onChange={(e) => setSettingsForm({ ...settingsForm, state_province: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-amber-400/50 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Website URL</label>
                  <input
                    type="url"
                    value={settingsForm.website_url}
                    onChange={(e) => setSettingsForm({ ...settingsForm, website_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-amber-400/50 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Description & Mission</label>
                <textarea
                  rows={3}
                  value={settingsForm.description}
                  onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-amber-400/50 outline-none"
                />
              </div>

              {/* Public Directory Opt-In Toggle */}
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between gap-4">
                <div>
                  <span className="text-sm font-semibold text-white block">Public Directory Listing</span>
                  <span className="text-xs text-slate-400 block mt-0.5">
                    When enabled, verified fellowships appear in the platform church discovery directory.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settingsForm.is_public}
                  onChange={(e) => setSettingsForm({ ...settingsForm, is_public: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-700 text-amber-500 focus:ring-amber-400"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Profile Changes</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: CHURCH FEATURE CONTROLS (Pastor Only) */}
          {isPastor && activeTab === 'features' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed">
                <strong>Two-Tier Feature Control:</strong> Configure workspace capabilities for your congregation. If a feature is disabled globally by the platform Super Admin, it will remain disabled regardless of church toggles.
              </div>

              <div className="divide-y divide-slate-800 rounded-2xl bg-slate-800/40 border border-slate-800 overflow-hidden">
                {/* Feature 1: Worship Team Roles */}
                <div className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-white">Worship Team & Pastor Roles</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Enable role-based fellowship collaboration between pastors, worship leaders, and members.
                    </p>
                    <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-400">
                      Platform Status: {isFeatureEnabled('worship_team_roles') ? 'Available' : 'Disabled by Platform'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggleFeature('worship_team_roles', isChurchFeatureActive('worship_team_roles'))}
                    disabled={isSubmitting || !isFeatureEnabled('worship_team_roles')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      isChurchFeatureActive('worship_team_roles')
                        ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                    }`}
                  >
                    {isChurchFeatureActive('worship_team_roles') ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                {/* Feature 2: Church Worship Collections */}
                <div className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-white">Worship Repertoire & Song Collections</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Enable congregational song collections, custom worship key/tempo arrangements, and repertoire curation.
                    </p>
                    <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-400">
                      Platform Status: {isFeatureEnabled('church_worship_collections') ? 'Available' : 'Disabled by Platform'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggleFeature('church_worship_collections', isChurchFeatureActive('church_worship_collections'))}
                    disabled={isSubmitting || !isFeatureEnabled('church_worship_collections')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      isChurchFeatureActive('church_worship_collections')
                        ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                    }`}
                  >
                    {isChurchFeatureActive('church_worship_collections') ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
