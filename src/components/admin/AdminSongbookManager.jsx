import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Plus,
  X,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Hash,
  Trash2,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import {
  getAvailableSongbooks,
  getSongbookAssociations,
  reconcileSongbookAssociations
} from '../../services/adminSongService';

/**
 * AdminSongbookManager Component
 * 
 * Manages songbook associations for a specific song.
 * Writes exclusively to public.songbook_songs (junction table).
 * Never modifies songs metadata, songs.songbooks JSONB, or pinned_songs.
 * 
 * Uses difference-based reconciliation:
 * - Calculates toAdd, toRemove, toUpdate from current vs desired state
 * - Does NOT blindly delete-all + reinsert-all
 * - Reports partial failures explicitly
 */
export default function AdminSongbookManager({ songId, songTitle, onClose, onSaved }) {
  // Data state
  const [availableSongbooks, setAvailableSongbooks] = useState([]);
  const [currentAssociations, setCurrentAssociations] = useState([]);
  const [editableAssociations, setEditableAssociations] = useState([]);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Feedback
  const [saveResult, setSaveResult] = useState(null); // { type: 'success'|'error'|'partial', message }

  // Track dirty state
  const isDirty = useCallback(() => {
    if (currentAssociations.length !== editableAssociations.length) return true;
    const currentMap = new Map();
    for (const a of currentAssociations) {
      currentMap.set(a.songbook_id, a.song_number);
    }
    for (const e of editableAssociations) {
      if (!currentMap.has(e.songbookId)) return true;
      const num = e.songNumber !== null && e.songNumber !== undefined && e.songNumber !== ''
        ? parseInt(e.songNumber, 10) : null;
      if (num !== currentMap.get(e.songbookId)) return true;
    }
    const editableSet = new Set(editableAssociations.map(e => e.songbookId));
    for (const a of currentAssociations) {
      if (!editableSet.has(a.songbook_id)) return true;
    }
    return false;
  }, [currentAssociations, editableAssociations]);

  // Load songbooks and current associations
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setSaveResult(null);

    try {
      const [sbResult, assocResult] = await Promise.all([
        getAvailableSongbooks(),
        getSongbookAssociations(songId)
      ]);

      if (sbResult.error) {
        setLoadError(`Failed to load songbooks: ${sbResult.error}`);
        setIsLoading(false);
        return;
      }
      if (assocResult.error) {
        setLoadError(`Failed to load associations: ${assocResult.error}`);
        setIsLoading(false);
        return;
      }

      const activeSongbooks = sbResult.songbooks || [];
      const currentAssocs = assocResult.associations || [];

      // Preserve existing associations with inactive/deprecated songbooks in the editable state
      const activeIds = new Set(activeSongbooks.map(s => s.id));
      const extraInactiveSongbooks = [];

      for (const assoc of currentAssocs) {
        if (!activeIds.has(assoc.songbook_id)) {
          const meta = assoc.songbooks || {};
          extraInactiveSongbooks.push({
            id: assoc.songbook_id,
            slug: meta.slug || 'inactive-songbook',
            title: meta.title || 'Archived / Inactive Songbook',
            title_native: meta.title_native || null,
            sort_order: meta.sort_order ?? 999,
            is_active: false,
            is_numbered: true
          });
        }
      }

      setAvailableSongbooks([...activeSongbooks, ...extraInactiveSongbooks]);
      setCurrentAssociations(currentAssocs);

      // Initialize editable state from current associations (retaining all active and inactive)
      setEditableAssociations(
        currentAssocs.map(a => ({
          songbookId: a.songbook_id,
          songNumber: a.song_number
        }))
      );
    } catch (err) {
      setLoadError('Failed to load songbook data.');
    } finally {
      setIsLoading(false);
    }
  }, [songId]);

  useEffect(() => {
    if (songId) loadData();
  }, [songId, loadData]);

  // Toggle songbook assignment
  const handleToggleSongbook = (songbookId) => {
    setSaveResult(null);
    setEditableAssociations(prev => {
      const existing = prev.find(a => a.songbookId === songbookId);
      if (existing) {
        return prev.filter(a => a.songbookId !== songbookId);
      } else {
        return [...prev, { songbookId, songNumber: null }];
      }
    });
  };

  // Update song number for an association
  const handleUpdateSongNumber = (songbookId, value) => {
    setSaveResult(null);
    setEditableAssociations(prev =>
      prev.map(a => a.songbookId === songbookId
        ? { ...a, songNumber: value === '' ? null : parseInt(value, 10) || null }
        : a
      )
    );
  };

  // Save associations
  const handleSave = async () => {
    setIsSaving(true);
    setSaveResult(null);

    try {
      const result = await reconcileSongbookAssociations(songId, editableAssociations);

      if (result.success) {
        const totalChanges = result.added + result.removed + result.updated;
        if (totalChanges === 0) {
          setSaveResult({ type: 'success', message: 'No changes to save.' });
        } else {
          const parts = [];
          if (result.added > 0) parts.push(`${result.added} added`);
          if (result.removed > 0) parts.push(`${result.removed} removed`);
          if (result.updated > 0) parts.push(`${result.updated} updated`);
          setSaveResult({
            type: 'success',
            message: `Songbook associations saved successfully (${parts.join(', ')}).`
          });
        }
        // Reload from database to get authoritative state
        await loadData();
        if (onSaved) onSaved();
      } else if (result.added > 0 || result.removed > 0 || result.updated > 0) {
        // Partial failure
        setSaveResult({
          type: 'partial',
          message: result.error
        });
        // Reload from database to show true state after partial success
        await loadData();
      } else {
        setSaveResult({
          type: 'error',
          message: result.error || 'Failed to save songbook associations.'
        });
      }
    } catch (err) {
      setSaveResult({ type: 'error', message: 'An unexpected error occurred.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Check if a songbook is currently assigned
  const isAssigned = (songbookId) => {
    return editableAssociations.some(a => a.songbookId === songbookId);
  };

  // Get editable song number for a songbook
  const getSongNumber = (songbookId) => {
    const assoc = editableAssociations.find(a => a.songbookId === songbookId);
    return assoc?.songNumber ?? '';
  };

  // --- Loading State ---
  if (isLoading) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        borderRadius: '16px',
        padding: '48px',
        textAlign: 'center',
        border: '1px solid rgba(255,255,255,0.08)'
      }}>
        <Loader2 size={32} className="animate-spin" style={{ color: '#f59e0b', margin: '0 auto 16px' }} />
        <div style={{ color: '#94a3b8', fontSize: '14px' }}>Loading songbook associations…</div>
      </div>
    );
  }

  // --- Error State ---
  if (loadError) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        borderRadius: '16px',
        padding: '32px',
        border: '1px solid rgba(239,68,68,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <AlertCircle size={20} style={{ color: '#ef4444' }} />
          <span style={{ color: '#fca5a5', fontWeight: 600 }}>Failed to Load</span>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>{loadError}</p>
        <button
          type="button"
          onClick={loadData}
          style={{
            background: 'rgba(245,158,11,0.15)',
            color: '#f59e0b',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: '8px',
            padding: '8px 16px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 600
          }}
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(217,119,6,0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <BookOpen size={18} style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <h3 style={{ color: '#e2e8f0', fontSize: '16px', fontWeight: 700, margin: 0 }}>
              Songbook Assignments
            </h3>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
              {songTitle ? `for "${songTitle}"` : `Song ID: ${songId?.slice(0, 8)}…`}
            </div>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={() => {
              if (isDirty()) {
                if (!window.confirm('You have unsaved changes. Discard them?')) return;
              }
              onClose();
            }}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '6px 8px',
              cursor: 'pointer',
              color: '#94a3b8'
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Feedback Banner */}
      {saveResult && (
        <div style={{
          padding: '12px 24px',
          background: saveResult.type === 'success'
            ? 'rgba(34,197,94,0.1)'
            : saveResult.type === 'partial'
              ? 'rgba(245,158,11,0.1)'
              : 'rgba(239,68,68,0.1)',
          borderBottom: `1px solid ${
            saveResult.type === 'success'
              ? 'rgba(34,197,94,0.2)'
              : saveResult.type === 'partial'
                ? 'rgba(245,158,11,0.2)'
                : 'rgba(239,68,68,0.2)'
          }`,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {saveResult.type === 'success'
            ? <CheckCircle2 size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
            : saveResult.type === 'partial'
              ? <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
              : <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
          }
          <span style={{
            color: saveResult.type === 'success' ? '#86efac'
              : saveResult.type === 'partial' ? '#fcd34d' : '#fca5a5',
            fontSize: '13px'
          }}>
            {saveResult.message}
          </span>
        </div>
      )}

      {/* Songbook List */}
      <div style={{ padding: '16px 24px' }}>
        <div style={{
          color: '#64748b',
          fontSize: '11px',
          textTransform: 'uppercase',
          fontWeight: 700,
          letterSpacing: '0.5px',
          marginBottom: '12px'
        }}>
          {availableSongbooks.length} Songbooks Available · {editableAssociations.length} Assigned
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {availableSongbooks.length === 0 ? (
            <div style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '13px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.06)'
            }}>
              No songbooks available in the database.
            </div>
          ) : (
            availableSongbooks.map(sb => {
              const assigned = isAssigned(sb.id);
              const songNumber = getSongNumber(sb.id);

              return (
              <div
                key={sb.id}
                style={{
                  background: assigned
                    ? 'rgba(245,158,11,0.08)'
                    : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${assigned ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '10px',
                  padding: '12px 16px',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  {/* Left: Toggle + Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '200px' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleSongbook(sb.id)}
                      disabled={isSaving || (!assigned && sb.is_active === false)}
                      title={!assigned && sb.is_active === false ? 'Cannot assign to an inactive songbook' : (assigned ? 'Assigned (click to unassign)' : 'Click to assign')}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        border: `2px solid ${assigned ? (sb.is_active === false ? '#f87171' : '#f59e0b') : 'rgba(255,255,255,0.15)'}`,
                        background: assigned
                          ? (sb.is_active === false
                              ? 'linear-gradient(135deg, rgba(239,68,68,0.3), rgba(185,28,28,0.2))'
                              : 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(217,119,6,0.2))')
                          : 'transparent',
                        cursor: (isSaving || (!assigned && sb.is_active === false)) ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.2s ease',
                        opacity: (isSaving || (!assigned && sb.is_active === false)) ? 0.5 : 1
                      }}
                    >
                      {assigned
                        ? <CheckCircle2 size={16} style={{ color: sb.is_active === false ? '#f87171' : '#f59e0b' }} />
                        : <Plus size={16} style={{ color: '#64748b' }} />
                      }
                    </button>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap'
                      }}>
                        <span style={{
                          color: assigned ? (sb.is_active === false ? '#fca5a5' : '#fbbf24') : '#cbd5e1',
                          fontWeight: 600,
                          fontSize: '14px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {sb.title}
                        </span>
                        {sb.is_active === false && (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(239,68,68,0.15)',
                            color: '#fca5a5',
                            border: '1px solid rgba(239,68,68,0.3)',
                            letterSpacing: '0.4px',
                            textTransform: 'uppercase'
                          }}>
                            Inactive / Deprecated
                          </span>
                        )}
                      </div>
                      {sb.title_native && sb.title_native !== sb.title && (
                        <div style={{
                          color: '#64748b',
                          fontSize: '12px',
                          marginTop: '1px'
                        }}>
                          {sb.title_native}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Song Number + Remove */}
                  {assigned && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '8px',
                        padding: '4px 8px',
                        border: '1px solid rgba(255,255,255,0.08)'
                      }}>
                        <Hash size={12} style={{ color: '#64748b' }} />
                        <input
                          type="number"
                          min="1"
                          value={songNumber || ''}
                          onChange={(e) => handleUpdateSongNumber(sb.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.preventDefault();
                          }}
                          placeholder="No."
                          disabled={isSaving}
                          style={{
                            width: '60px',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: '#e2e8f0',
                            fontSize: '13px',
                            fontWeight: 600,
                            padding: 0,
                            opacity: isSaving ? 0.5 : 1
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleSongbook(sb.id)}
                        disabled={isSaving}
                        title="Remove from songbook"
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          border: '1px solid rgba(239,68,68,0.2)',
                          background: 'rgba(239,68,68,0.08)',
                          cursor: isSaving ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: isSaving ? 0.5 : 1
                        }}
                      >
                        <Trash2 size={12} style={{ color: '#f87171' }} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Actions */}
      <div style={{
        padding: '16px 24px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ color: '#475569', fontSize: '11px' }}>
          {isDirty()
            ? <span style={{ color: '#fbbf24' }}>● Unsaved changes</span>
            : <span>No unsaved changes</span>
          }
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {onClose && (
            <button
              type="button"
              onClick={() => {
                if (isDirty()) {
                  if (!window.confirm('You have unsaved changes. Discard them?')) return;
                }
                onClose();
              }}
              disabled={isSaving}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: '#94a3b8',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isDirty()}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: '1px solid rgba(245,158,11,0.4)',
              background: isDirty()
                ? 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(217,119,6,0.15))'
                : 'rgba(255,255,255,0.03)',
              color: isDirty() ? '#fbbf24' : '#475569',
              cursor: (isSaving || !isDirty()) ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              opacity: isSaving ? 0.6 : 1
            }}
          >
            {isSaving
              ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
              : <><Save size={14} /> Save Associations</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
