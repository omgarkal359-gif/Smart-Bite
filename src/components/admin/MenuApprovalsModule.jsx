import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  CheckCircle2, XCircle, Clock, AlertTriangle, Search, Filter, 
  Eye, RefreshCw, Layers, ArrowRight, ShieldCheck, Tag, DollarSign, Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../api';
import { supabase } from '../../supabaseClient';
import { useCart } from '../../context/CartContext';

export const MenuApprovalsModule = () => {
  const { showToast } = useCart();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PENDING'); // PENDING | APPROVED | REJECTED | ALL
  const [typeFilter, setTypeFilter] = useState('ALL');   // ALL | CREATE | UPDATE | DELETE
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected request for side-by-side diff review modal
  const [selectedRequest, setSelectedRequest] = useState(null);
  
  // Rejection modal state
  const [rejectionModalRequest, setRejectionModalRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAdminMenuRequests('ALL');
      setRequests(data);
    } catch (err) {
      console.error('Failed to load menu requests:', err);
      showToast('Error loading menu change requests.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchRequests();

    // Supabase Realtime subscription for instant updates on admin dashboard
    const channel = supabase
      .channel('admin-menu-requests-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_change_requests' },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRequests]);

  // Metrics computation
  const metrics = useMemo(() => {
    const pending = requests.filter(r => r.status === 'PENDING').length;
    const approved = requests.filter(r => r.status === 'APPROVED').length;
    const rejected = requests.filter(r => r.status === 'REJECTED').length;
    return { pending, approved, rejected, total: requests.length };
  }, [requests]);

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesTab = activeTab === 'ALL' || r.status === activeTab;
      const matchesType = typeFilter === 'ALL' || r.requestType === typeFilter;
      
      const itemName = r.proposedData?.name || r.currentData?.name || '';
      const stallName = r.stallName || '';
      const submitter = r.submittedBy || '';
      
      const matchesSearch = !searchQuery.trim() || 
        itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stallName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        submitter.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.id.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesTab && matchesType && matchesSearch;
    });
  }, [requests, activeTab, typeFilter, searchQuery]);

  // Handle Approve Request
  const handleApprove = async (requestId) => {
    setActionLoading(true);
    try {
      const res = await api.approveMenuRequest(requestId);
      if (!res.success) {
        throw new Error(res.message || 'Approval failed.');
      }
      showToast('Menu change request APPROVED successfully! 🚀', 'success');
      setSelectedRequest(null);
      await fetchRequests();
    } catch (err) {
      showToast(err.message || 'Failed to approve request.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reject Request
  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      showToast('Please provide a rejection reason.', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.rejectMenuRequest(rejectionModalRequest.id, rejectionReason.trim());
      if (!res.success) {
        throw new Error(res.message || 'Rejection failed.');
      }
      showToast('Menu change request REJECTED.', 'info');
      setRejectionModalRequest(null);
      setRejectionReason('');
      setSelectedRequest(null);
      await fetchRequests();
    } catch (err) {
      showToast(err.message || 'Failed to reject request.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <ShieldCheck size={24} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Menu Change Approvals</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Review and approve vendor menu modifications, additions, and deactivations before they publish to the live menu.
          </p>
        </div>

        <button 
          onClick={fetchRequests}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all border-none cursor-pointer text-sm"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase text-amber-600 tracking-wider">Pending Review</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1">{metrics.pending}</h3>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <Clock size={28} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase text-emerald-600 tracking-wider">Approved Requests</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1">{metrics.approved}</h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <CheckCircle2 size={28} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-red-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase text-red-600 tracking-wider">Rejected Requests</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1">{metrics.rejected}</h3>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
            <XCircle size={28} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase text-slate-500 tracking-wider">Total History</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1">{metrics.total}</h3>
          </div>
          <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl">
            <Layers size={28} />
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
          {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all border-none cursor-pointer ${
                activeTab === tab 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800 bg-transparent'
              }`}
            >
              {tab}
              {tab === 'PENDING' && metrics.pending > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-amber-500 text-white font-bold rounded-full">
                  {metrics.pending}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filters & Search */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Search item, stall, submitter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="CREATE">CREATE (Add)</option>
            <option value="UPDATE">UPDATE (Edit)</option>
            <option value="DELETE">DELETE (Deactivate)</option>
          </select>
        </div>
      </div>

      {/* Requests List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-bold">
            <RefreshCw size={28} className="animate-spin mx-auto mb-2 text-indigo-500" />
            Loading menu change requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No requests found</h3>
            <p className="text-xs text-slate-500 mt-1">There are no menu approval requests matching your current filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="p-4">Stall / Vendor</th>
                  <th className="p-4">Request Type</th>
                  <th className="p-4">Proposed Menu Item</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Submitted At</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredRequests.map(r => {
                  const proposedName = r.proposedData?.name || r.currentData?.name || 'Unnamed Item';
                  const proposedPrice = r.proposedData?.price !== undefined ? r.proposedData?.price : r.currentData?.price;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{r.stallName}</div>
                        <div className="text-xs text-slate-500">{r.submittedBy}</div>
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wide inline-flex items-center gap-1 ${
                          r.requestType === 'CREATE' ? 'bg-emerald-100 text-emerald-800' :
                          r.requestType === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {r.requestType}
                        </span>
                      </td>

                      <td className="p-4 font-semibold text-slate-800">
                        {proposedName}
                        {r.proposedData?.category && (
                          <span className="ml-2 text-xs font-medium text-slate-400">({r.proposedData.category})</span>
                        )}
                      </td>

                      <td className="p-4 font-bold text-slate-900">
                        {proposedPrice !== undefined ? `₹${proposedPrice}` : '-'}
                      </td>

                      <td className="p-4 text-xs text-slate-500">
                        {new Date(r.createdAt).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                          r.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                          r.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {r.status === 'PENDING' && <Clock size={12} />}
                          {r.status === 'APPROVED' && <CheckCircle2 size={12} />}
                          {r.status === 'REJECTED' && <XCircle size={12} />}
                          {r.status}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedRequest(r)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors border-none cursor-pointer flex items-center gap-1"
                          >
                            <Eye size={14} /> Review
                          </button>

                          {r.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleApprove(r.id)}
                                disabled={actionLoading}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors border-none cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setRejectionModalRequest(r)}
                                disabled={actionLoading}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs transition-colors border-none cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
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

      {/* Side-by-Side Visual Diff Modal */}
      <AnimatePresence>
        {selectedRequest && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    Review Menu Change Request #{selectedRequest.id.slice(0, 8)}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Stall: <span className="text-white font-semibold">{selectedRequest.stallName}</span> | Submitted by: {selectedRequest.submittedBy}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="text-slate-400 hover:text-white border-none bg-transparent cursor-pointer p-2"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body (Diff View) */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {selectedRequest.requestType === 'CREATE' && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-900">
                    <h4 className="font-bold text-emerald-800 text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                      <CheckCircle2 size={18} /> New Menu Item Addition
                    </h4>
                    <p className="text-xs text-emerald-700">Vendor is requesting to add a brand new item to the live stall menu.</p>
                  </div>
                )}

                {selectedRequest.requestType === 'DELETE' && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-900">
                    <h4 className="font-bold text-red-800 text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                      <AlertTriangle size={18} /> Menu Item Deactivation Request
                    </h4>
                    <p className="text-xs text-red-700">Vendor is requesting to soft-deactivate this item from the live menu.</p>
                  </div>
                )}

                {/* Side-by-Side Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Current Live Version */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Current Live Version</h3>
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded">LIVE DB</span>
                    </div>

                    {selectedRequest.currentData ? (
                      <div className="space-y-3 text-sm">
                        {selectedRequest.currentData.img && (
                          <img 
                            src={selectedRequest.currentData.img} 
                            alt="Current photo" 
                            className="w-full h-40 object-cover rounded-xl border border-slate-200" 
                          />
                        )}
                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase">Item Name</label>
                          <p className="font-semibold text-slate-800">{selectedRequest.currentData.name}</p>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase">Price</label>
                          <p className="font-bold text-slate-900">₹{selectedRequest.currentData.price}</p>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase">Category</label>
                          <p className="text-slate-700">{selectedRequest.currentData.category || 'Main'}</p>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase">Dietary Type</label>
                          <p className="text-slate-700">{selectedRequest.currentData.isVeg ? 'Veg 🟢' : 'Non-Veg 🔴'}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic py-12 text-center">
                        No previous live version (New Item Creation).
                      </div>
                    )}
                  </div>

                  {/* Proposed Version */}
                  <div className="bg-indigo-50/50 border border-indigo-200 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-indigo-200 pb-3">
                      <h3 className="font-bold text-indigo-900 text-sm uppercase tracking-wider">Proposed Changes</h3>
                      <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded">PROPOSED</span>
                    </div>

                    <div className="space-y-3 text-sm">
                      {selectedRequest.proposedData?.img && (
                        <img 
                          src={selectedRequest.proposedData.img} 
                          alt="Proposed photo" 
                          className="w-full h-40 object-cover rounded-xl border border-indigo-200" 
                        />
                      )}

                      <div>
                        <label className="text-xs font-bold text-indigo-400 uppercase">Item Name</label>
                        <p className={`font-semibold ${
                          selectedRequest.currentData && selectedRequest.currentData.name !== selectedRequest.proposedData?.name
                            ? 'text-indigo-700 bg-indigo-100 p-1 rounded font-bold'
                            : 'text-slate-800'
                        }`}>
                          {selectedRequest.proposedData?.name || selectedRequest.currentData?.name || '-'}
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-indigo-400 uppercase">Price</label>
                        <p className={`font-bold ${
                          selectedRequest.currentData && Number(selectedRequest.currentData.price) !== Number(selectedRequest.proposedData?.price)
                            ? 'text-emerald-700 bg-emerald-100 p-1 rounded font-bold text-base'
                            : 'text-slate-900'
                        }`}>
                          ₹{selectedRequest.proposedData?.price !== undefined ? selectedRequest.proposedData.price : selectedRequest.currentData?.price}
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-indigo-400 uppercase">Category</label>
                        <p className="text-slate-700">{selectedRequest.proposedData?.category || selectedRequest.currentData?.category || 'Main'}</p>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-indigo-400 uppercase">Dietary Type</label>
                        <p className="text-slate-700">{selectedRequest.proposedData?.is_veg ?? selectedRequest.currentData?.isVeg ? 'Veg 🟢' : 'Non-Veg 🔴'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rejection Reason Display if Rejected */}
                {selectedRequest.status === 'REJECTED' && selectedRequest.rejectionReason && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-900">
                    <h4 className="font-bold text-red-800 text-xs uppercase tracking-wider">Rejection Reason:</h4>
                    <p className="text-sm mt-1 font-medium">{selectedRequest.rejectionReason}</p>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
                <span className="text-xs text-slate-400 font-medium">Request Status: {selectedRequest.status}</span>

                {selectedRequest.status === 'PENDING' ? (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setRejectionModalRequest(selectedRequest)}
                      disabled={actionLoading}
                      className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors border-none cursor-pointer"
                    >
                      Reject Request
                    </button>
                    <button
                      onClick={() => handleApprove(selectedRequest.id)}
                      disabled={actionLoading}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors border-none cursor-pointer"
                    >
                      Approve & Publish Live
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs border-none cursor-pointer"
                  >
                    Close
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mandatory Rejection Reason Modal */}
      <AnimatePresence>
        {rejectionModalRequest && (
          <div className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.form
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onSubmit={handleConfirmReject}
              className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-200"
            >
              <div className="flex items-center gap-3 text-red-600">
                <AlertTriangle size={24} />
                <h3 className="text-lg font-bold text-slate-900">Reject Menu Request</h3>
              </div>

              <p className="text-xs text-slate-500">
                Please enter a clear reason for rejecting this change request. The vendor will be able to view this feedback in their dashboard.
              </p>

              <textarea
                required
                rows={4}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Proposed price exceeds maximum campus capping limit of ₹250."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
              />

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setRejectionModalRequest(null); setRejectionReason(''); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs border-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !rejectionReason.trim()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs border-none cursor-pointer disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
