import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Music,
  Plus,
  Star,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  FileText,
  ExternalLink,
  AlertCircle,
  Check,
  Loader2,
  Sliders,
  FolderOpen,
  Clock,
  Archive,
  ChevronRight,
  Info
} from 'lucide-react';
import {
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  ensureDefaultCollection,
  getCollectionItems,
  addSongToCollection,
  updateCollectionItem,
  removeSongFromCollection,
  reorderCollectionItems,
  formatWorshipError
} from '../../services/churchWorshipService';
import ChurchSongPickerModal from './ChurchSongPickerModal';
import ChurchArrangementModal from './ChurchArrangementModal';

export default function ChurchWorshipTab({
  activeChurch,
  isPastor,
  isWorshipLeader,
  isMember,
  isWorshipActive,
  onSelectSong,
  onNavigateToFeatures
}) {
  const isCurator = Boolean(isPastor || isWorshipLeader);

  // Collections state
  const [collections, setCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);

  // Items state
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Feedback notifications
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Dialog states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPickerModalOpen, setIsPickerModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Form states for collection create/edit
  const [collectionForm, setCollectionForm] = useState({ name: '', description: '' });
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  // Helper to show transient feedback
  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev.message === message ? { type: '', message: '' } : prev));
    }, 4000);
  };

  // Load collections & ensure default collection exists
  const loadCollectionsData = useCallback(async () => {
    if (!activeChurch?.id || !isWorshipActive) return;
    setLoadingCollections(true);

    try {
      // 1. Ensure default "Church Repertoire" collection exists
      await ensureDefaultCollection(activeChurch.id);

      // 2. Fetch all collections for church
      const res = await getCollections(activeChurch.id);
      if (res.success) {
        const list = res.data || [];
        setCollections(list);

        // Select first/default collection if current selection is invalid
        setSelectedCollectionId((curr) => {
          if (curr && list.some((c) => c.id === curr)) return curr;
          const def = list.find((c) => c.is_default);
          return def ? def.id : list[0]?.id || null;
        });
      } else {
        showFeedback('error', res.error || 'Failed to load collections.');
      }
    } catch (err) {
      showFeedback('error', formatWorshipError(err));
    } finally {
      setLoadingCollections(false);
    }
  }, [activeChurch?.id, isWorshipActive]);

  useEffect(() => {
    loadCollectionsData();
  }, [loadCollectionsData]);

  // Load items for selected collection
  const loadItemsData = useCallback(async (collId) => {
    if (!collId || !isWorshipActive) {
      setItems([]);
      return;
    }
    setLoadingItems(true);
    try {
      const res = await getCollectionItems(collId);
      if (res.success) {
        setItems(res.data || []);
      } else {
        showFeedback('error', res.error || 'Failed to load songs in collection.');
      }
    } catch (err) {
      showFeedback('error', formatWorshipError(err));
    } finally {
      setLoadingItems(false);
    }
  }, [isWorshipActive]);

  useEffect(() => {
    if (selectedCollectionId) {
      loadItemsData(selectedCollectionId);
    }
  }, [selectedCollectionId, loadItemsData]);

  // Selected collection object
  const selectedCollection = useMemo(() => {
    return collections.find((c) => c.id === selectedCollectionId) || null;
  }, [collections, selectedCollectionId]);

  // Existing song IDs in the selected collection (for Song Picker prevention of duplicates)
  const existingSongIds = useMemo(() => {
    return new Set(items.map((it) => it.song_id));
  }, [items]);

  // =========================================================================
  // Collection Actions
  // =========================================================================

  const handleOpenCreateModal = () => {
    setCollectionForm({ name: '', description: '' });
    setIsCreateModalOpen(true);
  };

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    if (!isCurator) return;
    setIsSubmittingForm(true);

    const res = await createCollection(activeChurch.id, collectionForm);
    if (res.success) {
      showFeedback('success', `Created collection "${res.data.name}".`);
      setIsCreateModalOpen(false);
      setCollectionForm({ name: '', description: '' });
      await loadCollectionsData();
      if (res.data?.id) setSelectedCollectionId(res.data.id);
    } else {
      showFeedback('error', res.error);
    }
    setIsSubmittingForm(false);
  };

  const handleOpenEditModal = () => {
    if (!selectedCollection || selectedCollection.is_default) return;
    setCollectionForm({
      name: selectedCollection.name || '',
      description: selectedCollection.description || ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditCollection = async (e) => {
    e.preventDefault();
    if (!isCurator || !selectedCollection || selectedCollection.is_default) return;
    setIsSubmittingForm(true);

    const res = await updateCollection(selectedCollection.id, collectionForm);
    if (res.success) {
      showFeedback('success', 'Collection updated successfully.');
      setIsEditModalOpen(false);
      await loadCollectionsData();
    } else {
      showFeedback('error', res.error);
    }
    setIsSubmittingForm(false);
  };

  const handleDeleteCollection = async () => {
    if (!isPastor || !selectedCollection || selectedCollection.is_default) return;
    const confirmMsg = `Are you sure you want to delete the collection "${selectedCollection.name}"? This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    const res = await deleteCollection(selectedCollection.id);
    if (res.success) {
      showFeedback('success', 'Collection deleted.');
      await loadCollectionsData();
    } else {
      showFeedback('error', res.error);
    }
  };

  // =========================================================================
  // Song Item Actions
  // =========================================================================

  const handleAddSongToCollection = async (songId, data = {}) => {
    if (!isCurator || !selectedCollectionId) {
      return { success: false, error: 'Permission denied or no collection selected.' };
    }
    const res = await addSongToCollection(selectedCollectionId, songId, data);
    if (res.success) {
      await loadItemsData(selectedCollectionId);
    }
    return res;
  };

  const handleRemoveSong = async (item) => {
    if (!isCurator) return;
    const title = item.song?.title || item.song?.title_telugu || 'this song';
    if (!window.confirm(`Remove "${title}" from ${selectedCollection.name}?`)) return;

    // Optimistic removal
    const prevItems = [...items];
    setItems((curr) => curr.filter((it) => it.id !== item.id));

    const res = await removeSongFromCollection(item.id);
    if (res.success) {
      showFeedback('success', `Removed "${title}" from collection.`);
    } else {
      setItems(prevItems);
      showFeedback('error', res.error);
    }
  };

  const handleSaveArrangement = async (itemId, data) => {
    if (!isCurator) return { success: false, error: 'Permission denied.' };
    const res = await updateCollectionItem(itemId, data);
    if (res.success) {
      showFeedback('success', 'Arrangement notes updated.');
      await loadItemsData(selectedCollectionId);
    }
    return res;
  };

  // Reordering: Move item up or down
  const handleMoveItem = async (index, direction) => {
    if (!isCurator || !selectedCollectionId) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    // Build minimal positional payload with updated sort_order values
    const orderedPayload = newItems.map((it, idx) => ({
      id: it.id,
      sort_order: idx + 1
    }));

    // Optimistic UI update
    const prevItems = [...items];
    setItems(newItems);

    const res = await reorderCollectionItems(selectedCollectionId, orderedPayload);
    if (res.success) {
      showFeedback('success', 'Repertoire order updated.');
    } else {
      setItems(prevItems);
      showFeedback('error', res.error);
    }
  };

  // =========================================================================
  // Feature Disabled State
  // =========================================================================
  if (!isWorshipActive) {
    return (
      <div className="py-12 px-4 sm:px-6 text-center space-y-4 max-w-lg mx-auto animate-fadeIn">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
          <Music className="w-8 h-8 stroke-1" />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white">Worship Collections Unavailable</h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
            Church worship collections and repertoire management are currently disabled for{' '}
            <span className="font-semibold text-slate-200">{activeChurch?.name}</span>.
          </p>
        </div>

        {isPastor && onNavigateToFeatures && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onNavigateToFeatures}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-lg shadow-amber-500/20"
            >
              <Sliders className="w-4 h-4" />
              <span>Configure Features</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      
      {/* Header Notification Banner */}
      {feedback.message && (
        <div
          className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 border transition ${
            feedback.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <Check className="w-4 h-4 shrink-0" />
          )}
          <span className="truncate">{feedback.message}</span>
        </div>
      )}

      {/* Main Responsive Grid Layout: Collections List + Items Pane */}
      <div className="flex flex-col md:flex-row gap-4 items-start">
        
        {/* =================================================================== */}
        {/* LEFT / TOP PANE: Collections Selector */}
        {/* =================================================================== */}
        <div className="w-full md:w-64 shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FolderOpen className="w-4 h-4 text-amber-400" />
              <span>Collections ({collections.length})</span>
            </h3>

            {/* Curator: Add Custom Collection */}
            {isCurator && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="min-h-[32px] px-2.5 py-1 text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl transition flex items-center gap-1"
                title="Create a new custom worship collection"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            )}
          </div>

          {/* Collection Cards (Scrollable chips on mobile, stacked cards on desktop) */}
          {loadingCollections ? (
            <div className="p-6 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span>Loading collections...</span>
            </div>
          ) : collections.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800 text-center text-xs text-slate-400">
              No collections available.
            </div>
          ) : (
            <div className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
              {collections.map((coll) => {
                const isSelected = coll.id === selectedCollectionId;

                return (
                  <button
                    key={coll.id}
                    type="button"
                    onClick={() => setSelectedCollectionId(coll.id)}
                    className={`min-h-[44px] text-left p-3 rounded-2xl border transition flex items-center justify-between gap-3 shrink-0 md:shrink md:w-full ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/40 text-white shadow-sm'
                        : 'bg-slate-800/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {coll.is_default && (
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                        )}
                        <span className="font-bold text-xs sm:text-sm truncate">
                          {coll.name}
                        </span>
                      </div>
                      {coll.description && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {coll.description}
                        </p>
                      )}
                    </div>

                    {coll.is_default && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 shrink-0">
                        Default
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* RIGHT / MAIN PANE: Selected Collection Repertoire */}
        {/* =================================================================== */}
        <div className="flex-1 w-full space-y-4">
          {selectedCollection ? (
            <div className="p-4 sm:p-5 rounded-3xl bg-slate-800/40 border border-slate-800/90 space-y-4">
              
              {/* Collection Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-700/60">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-1.5">
                      {selectedCollection.is_default && (
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      )}
                      <span>{selectedCollection.name}</span>
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      {items.length} {items.length === 1 ? 'Hymn' : 'Hymns'}
                    </span>
                  </div>
                  {selectedCollection.description && (
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {selectedCollection.description}
                    </p>
                  )}
                </div>

                {/* Collection Management Controls */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {/* Curator: Add Songs */}
                  {isCurator && (
                    <button
                      type="button"
                      onClick={() => setIsPickerModalOpen(true)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Songs</span>
                    </button>
                  )}

                  {/* Curator: Edit Collection metadata (Custom collections only) */}
                  {isCurator && !selectedCollection.is_default && (
                    <button
                      type="button"
                      onClick={handleOpenEditModal}
                      title="Edit collection name and details"
                      className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center justify-center"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Pastor: Delete Collection (Custom collections only; default protected) */}
                  {isPastor && !selectedCollection.is_default && (
                    <button
                      type="button"
                      onClick={handleDeleteCollection}
                      title="Delete this custom collection"
                      className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-rose-500/20 text-rose-400 border border-slate-700 hover:border-rose-500/30 transition flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Items List */}
              {loadingItems ? (
                <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                  <span>Loading hymns in repertoire...</span>
                </div>
              ) : items.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-3">
                  <Music className="w-10 h-10 text-slate-600 mx-auto stroke-1" />
                  <p className="text-sm font-semibold text-slate-300">No hymns in this collection yet</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {isCurator
                      ? 'Add songs from the global catalog to build your congregational setlist.'
                      : 'Worship leaders have not yet added hymns to this collection.'}
                  </p>
                  {isCurator && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setIsPickerModalOpen(true)}
                        className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add First Hymn</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 space-y-1">
                  {items.map((item, index) => {
                    const isArchived = !item.song || item.song.is_published === false;
                    const songTitle = item.song?.title || item.song?.title_telugu || 'Archived Song';

                    return (
                      <div
                        key={item.id}
                        className="pt-3 pb-3 first:pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 p-2.5 rounded-2xl transition"
                      >
                        {/* Song Details & Arrangement Metadata */}
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-500 font-mono w-5">
                              {index + 1}.
                            </span>

                            <h4 className="font-telugu font-bold text-sm sm:text-base text-white truncate">
                              {songTitle}
                            </h4>

                            {isArchived ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                                <Archive className="w-3 h-3" /> Archived Song
                              </span>
                            ) : (
                              item.song?.language && (
                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60">
                                  {item.song.language}
                                </span>
                              )
                            )}

                            {/* Key Badge */}
                            {item.default_key && (
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Key: {item.default_key}
                              </span>
                            )}

                            {/* Tempo Badge */}
                            {item.tempo_notes && (
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>{item.tempo_notes}</span>
                              </span>
                            )}
                          </div>

                          {/* Transliterated Subtitle if available */}
                          {item.song?.title_telugu && item.song.title !== item.song.title_telugu && (
                            <p className="text-xs text-slate-400 font-sans pl-7">
                              {item.song.title}
                            </p>
                          )}

                          {/* Arrangement Notes Box */}
                          {item.arrangement_notes && (
                            <div className="ml-7 p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                              <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                              <span className="leading-relaxed">{item.arrangement_notes}</span>
                            </div>
                          )}

                          {/* Archived Notice */}
                          {isArchived && (
                            <p className="text-[11px] text-rose-300/80 italic pl-7 flex items-center gap-1">
                              <Info className="w-3 h-3" />
                              This song is no longer available in the public catalog.
                            </p>
                          )}
                        </div>

                        {/* Actions Area */}
                        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0 flex-wrap">
                          {/* Open Song Lyrics / Detail */}
                          {!isArchived && onSelectSong && (
                            <button
                              type="button"
                              onClick={() => onSelectSong(item.song)}
                              aria-label={`Open lyrics for ${songTitle}`}
                              className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1.5"
                            >
                              <span>Lyrics</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Curator Controls */}
                          {isCurator && (
                            <>
                              {/* Reorder Up */}
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMoveItem(index, 'up')}
                                aria-label="Move hymn up in repertoire order"
                                className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center justify-center"
                              >
                                <ArrowUp className="w-4 h-4" />
                              </button>

                              {/* Reorder Down */}
                              <button
                                type="button"
                                disabled={index === items.length - 1}
                                onClick={() => handleMoveItem(index, 'down')}
                                aria-label="Move hymn down in repertoire order"
                                className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center justify-center"
                              >
                                <ArrowDown className="w-4 h-4" />
                              </button>

                              {/* Edit Arrangement */}
                              <button
                                type="button"
                                onClick={() => setEditingItem(item)}
                                aria-label={`Edit arrangement notes for ${songTitle}`}
                                className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition flex items-center justify-center"
                                title="Edit key, tempo, and arrangement notes"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {/* Remove from Collection */}
                              <button
                                type="button"
                                onClick={() => handleRemoveSong(item)}
                                aria-label={`Remove ${songTitle} from collection`}
                                className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition flex items-center justify-center"
                                title="Remove from collection"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs bg-slate-800/20 rounded-3xl border border-slate-800">
              Select a collection to view its worship songs.
            </div>
          )}
        </div>

      </div>

      {/* ===================================================================== */}
      {/* DIALOG 1: Create Collection Modal (Curators Only) */}
      {/* ===================================================================== */}
      {isCreateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-collection-title"
          className="fixed inset-0 z-[110] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreateModalOpen(false);
          }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 id="create-collection-title" className="text-base font-bold text-white flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-amber-400" />
                <span>Create Worship Collection</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="w-9 h-9 rounded-lg text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCollection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Collection Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  placeholder="e.g. Sunday Morning, Youth Fellowship, Easter 2026"
                  value={collectionForm.name}
                  onChange={(e) => setCollectionForm({ ...collectionForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-amber-400/50 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  maxLength={300}
                  placeholder="Purpose or ministry context for this collection..."
                  value={collectionForm.description}
                  onChange={(e) => setCollectionForm({ ...collectionForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-amber-400/50 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingForm}
                  className="min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-1.5 shadow-md"
                >
                  {isSubmittingForm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>Create Collection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DIALOG 2: Edit Collection Modal (Curators Only; Custom Collections Only) */}
      {/* ===================================================================== */}
      {isEditModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-collection-title"
          className="fixed inset-0 z-[110] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditModalOpen(false);
          }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 id="edit-collection-title" className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                <span>Edit Collection Details</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-9 h-9 rounded-lg text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditCollection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Collection Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={collectionForm.name}
                  onChange={(e) => setCollectionForm({ ...collectionForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-amber-400/50 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={collectionForm.description}
                  onChange={(e) => setCollectionForm({ ...collectionForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-amber-400/50 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingForm}
                  className="min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-1.5 shadow-md"
                >
                  {isSubmittingForm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DIALOG 3: Song Picker Modal (Curators Only) */}
      {/* ===================================================================== */}
      <ChurchSongPickerModal
        isOpen={isPickerModalOpen}
        onClose={() => setIsPickerModalOpen(false)}
        collectionName={selectedCollection?.name || 'Repertoire'}
        existingSongIds={existingSongIds}
        onAddSong={handleAddSongToCollection}
      />

      {/* ===================================================================== */}
      {/* DIALOG 4: Edit Arrangement Modal (Curators Only) */}
      {/* ===================================================================== */}
      <ChurchArrangementModal
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        item={editingItem}
        onSave={handleSaveArrangement}
      />

    </div>
  );
}
