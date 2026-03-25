import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

export function Approvals() {
  const { token } = useAuth();
  const [pending, setPending] = useState<any[]>([]);
  const [comments, setComments] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    const res = await fetch('/api/approvals/pending', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setPending(data);
  };

  const handleAction = async (id: number, action: 'Approved' | 'Rejected') => {
    try {
      const res = await fetch(`/api/approvals/${id}/action`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ action, comments: comments[id] || '' })
      });
      
      if (!res.ok) throw new Error('Failed to process approval');
      fetchPending();
    } catch (err) {
      alert(err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
        <p className="text-gray-500">Review and manage leave requests from your team</p>
      </div>

      <div className="grid gap-6">
        {pending.length === 0 ? (
          <div className="bg-white p-8 text-center rounded-xl border border-gray-100 shadow-sm">
            <p className="text-gray-500">No pending approvals at the moment.</p>
          </div>
        ) : (
          pending.map((app) => (
            <div key={app.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xl">
                      {app.applicant_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{app.applicant_name}</h3>
                      <p className="text-sm text-gray-500">Applied on {format(new Date(app.applied_at), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                    {app.leave_type_name}
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-500 mb-1">Duration</p>
                    <p className="text-gray-900 font-medium">
                      {format(new Date(app.start_date), 'MMM d, yyyy')} - {format(new Date(app.end_date), 'MMM d, yyyy')}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">{app.days} day(s)</p>
                  </div>
                  <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-500 mb-1">Reason</p>
                    <p className="text-gray-900">{app.reason}</p>
                  </div>
                </div>

                <div className="mt-6 border-t pt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add Comments (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={comments[app.id] || ''}
                    onChange={(e) => setComments({ ...comments, [app.id]: e.target.value })}
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 border p-3"
                    placeholder="Provide a reason for rejection or approval notes..."
                  />
                  
                  <div className="mt-4 flex justify-end gap-3">
                    <button
                      onClick={() => handleAction(app.id, 'Rejected')}
                      className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleAction(app.id, 'Approved')}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
