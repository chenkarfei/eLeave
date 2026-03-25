import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { differenceInBusinessDays, isWeekend, parseISO, format, eachDayOfInterval, startOfDay } from 'date-fns';
import { Calendar } from '@/components/ui/Calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { Button } from '@/components/ui/Button';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ApplyLeave() {
  const { token } = useAuth();
  const navigate = useNavigate();
  
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    days: 0,
    reason: ''
  });
  const [halfDayStart, setHalfDayStart] = useState(false);
  const [halfDayEnd, setHalfDayEnd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [typesRes, balRes, holRes] = await Promise.all([
      fetch('/api/leaves/types', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/leaves/balances', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/leaves/holidays', { headers: { Authorization: `Bearer ${token}` } })
    ]);
    
    setLeaveTypes(await typesRes.json());
    setBalances(await balRes.json());
    setHolidays(await holRes.json());
  };

  // Calculate business days between dates
  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      const start = parseISO(formData.start_date);
      const end = parseISO(formData.end_date);
      
      if (end < start) {
        setFormData(prev => ({ ...prev, days: 0 }));
        return;
      }

      const daysInterval = eachDayOfInterval({ start, end });
      let businessDays = 0;
      daysInterval.forEach(day => {
        if (!isWeekend(day)) {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isHoliday = holidays.some(h => h.date === dateStr);
          if (!isHoliday) businessDays++;
        }
      });
      
      if (businessDays > 0) {
        if (halfDayStart) businessDays -= 0.5;
        if (halfDayEnd && formData.start_date !== formData.end_date) businessDays -= 0.5;
      }
      
      setFormData(prev => ({ ...prev, days: Math.max(0, businessDays) }));
    }
  }, [formData.start_date, formData.end_date, holidays, halfDayStart, halfDayEnd]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.start_date || !formData.end_date) {
        throw new Error("Please select both start and end dates");
      }

      // Validation: No past dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = parseISO(formData.start_date);
      
      if (start < today) {
        throw new Error("Cannot apply for past dates");
      }

      // Validation: 3 days in advance rule
      const diffDays = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      let finalTypeId = formData.leave_type_id;
      const selectedType = leaveTypes.find(t => t.id.toString() === formData.leave_type_id);
      
      if (selectedType?.code === 'AL' && diffDays < 3) {
        // Auto convert to EL
        const elType = leaveTypes.find(t => t.code === 'EL');
        if (elType) {
          finalTypeId = elType.id.toString();
          alert("Notice: Applied less than 3 days in advance. Automatically converted to Emergency Leave (EL).");
        }
      }

      const res = await fetch('/api/leaves/apply', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          ...formData,
          leave_type_id: finalTypeId
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to apply leave');

      navigate('/my-leaves');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isDateDisabled = (date: Date) => {
    const today = startOfDay(new Date());
    if (date < today) return true;
    if (isWeekend(date)) return true;
    const dateStr = format(date, 'yyyy-MM-dd');
    return holidays.some(h => h.date === dateStr);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Apply for Leave</h1>
        <p className="text-gray-500">Submit a new leave request</p>
      </div>

      {/* Balances Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {balances.map(bal => (
          <div key={bal.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm font-medium text-gray-500">{bal.leave_type_name}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {bal.total_days + bal.carried_forward - bal.used_days} <span className="text-sm font-normal text-gray-500">days left</span>
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Leave Type
              </label>
              <select
                required
                value={formData.leave_type_id}
                onChange={e => setFormData({...formData, leave_type_id: e.target.value})}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 border p-2.5"
              >
                <option value="">Select a leave type</option>
                {leaveTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Days (Auto-calculated)
              </label>
              <input
                type="number"
                step="0.5"
                required
                readOnly
                value={formData.days}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 border p-2.5 bg-gray-100 text-gray-700 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Excludes weekends and public holidays.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal border-gray-300 rounded-lg shadow-sm p-2.5 h-auto",
                      !formData.start_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.start_date ? format(parseISO(formData.start_date), "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.start_date ? parseISO(formData.start_date) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const dateStr = format(date, 'yyyy-MM-dd');
                        setFormData(prev => ({ ...prev, start_date: dateStr }));
                        if (!formData.end_date || dateStr > formData.end_date) {
                          setFormData(prev => ({ ...prev, start_date: dateStr, end_date: dateStr }));
                        }
                      }
                    }}
                    disabled={isDateDisabled}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {formData.start_date && (
                <div className="mt-2 flex items-center">
                  <input
                    type="checkbox"
                    id="halfDayStart"
                    checked={halfDayStart}
                    onChange={(e) => setHalfDayStart(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="halfDayStart" className="ml-2 block text-sm text-gray-900">
                    Half Day (Start Date)
                  </label>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal border-gray-300 rounded-lg shadow-sm p-2.5 h-auto",
                      !formData.end_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.end_date ? format(parseISO(formData.end_date), "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.end_date ? parseISO(formData.end_date) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setFormData(prev => ({ ...prev, end_date: format(date, 'yyyy-MM-dd') }));
                      }
                    }}
                    disabled={(date) => {
                      if (isDateDisabled(date)) return true;
                      if (formData.start_date && date < parseISO(formData.start_date)) return true;
                      return false;
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {formData.end_date && formData.start_date !== formData.end_date && (
                <div className="mt-2 flex items-center">
                  <input
                    type="checkbox"
                    id="halfDayEnd"
                    checked={halfDayEnd}
                    onChange={(e) => setHalfDayEnd(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="halfDayEnd" className="ml-2 block text-sm text-gray-900">
                    Half Day (End Date)
                  </label>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason
            </label>
            <textarea
              required
              rows={3}
              value={formData.reason}
              onChange={e => setFormData({...formData, reason: e.target.value})}
              className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 border p-2.5"
              placeholder="Please provide a reason for your leave..."
            />
          </div>

          <div className="flex justify-end pt-4 border-t">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mr-3 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
