import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Calendar as CalendarIcon, Users, Clock, CheckCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isWeekend } from 'date-fns';
import { cn } from '../lib/utils';

export function Dashboard() {
  const { user, token } = useAuth();
  const [summary, setSummary] = useState<any[]>([]);
  const [calendarData, setCalendarData] = useState<{ leaves: any[], holidays: any[] }>({ leaves: [], holidays: [] });
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    fetchSummary();
    fetchCalendarData(currentDate);
  }, [currentDate]);

  const fetchSummary = async () => {
    const res = await fetch('/api/dashboard/summary', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setSummary(data.onLeaveToday || []);
  };

  const fetchCalendarData = async (date: Date) => {
    const start = format(startOfMonth(date), 'yyyy-MM-dd');
    const end = format(endOfMonth(date), 'yyyy-MM-dd');
    const res = await fetch(`/api/dashboard/calendar?start=${start}&end=${end}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setCalendarData(data);
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Welcome back, {user?.name}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">On Leave Today</p>
            <p className="text-2xl font-bold text-gray-900">{summary.length}</p>
          </div>
        </div>
        
        {/* Add more stats here if needed */}
      </div>

      {/* Today's Leave Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Who's Away Today</h2>
          <span className="text-sm text-gray-500">{format(new Date(), 'MMMM d, yyyy')}</span>
        </div>
        <div className="p-6">
          {summary.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Everyone is working today.</p>
          ) : (
            <div className="space-y-4">
              {summary.map((leave: any) => (
                <div key={leave.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                      {leave.user_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{leave.user_name}</p>
                      <p className="text-sm text-gray-500">{leave.leave_type_name}</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {leave.days} day(s)
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Calendar View */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Leave Calendar</h2>
          <div className="flex items-center gap-4">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">&larr;</button>
            <span className="font-medium w-32 text-center">{format(currentDate, 'MMMM yyyy')}</span>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">&rarr;</button>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="bg-gray-50 py-2 text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
            
            {/* Empty cells for start of month */}
            {Array.from({ length: startOfMonth(currentDate).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-white min-h-[100px] p-2" />
            ))}

            {/* Days */}
            {daysInMonth.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const isToday = isSameDay(day, new Date());
              const isWknd = isWeekend(day);
              
              const holiday = calendarData.holidays.find(h => h.date === dateStr);
              const leavesOnDay = calendarData.leaves.filter(l => 
                dateStr >= l.start_date && dateStr <= l.end_date
              );

              return (
                <div 
                  key={dateStr} 
                  className={cn(
                    "bg-white min-h-[100px] p-2 border-t border-gray-100",
                    isWknd && "bg-gray-50",
                    isToday && "bg-blue-50/30"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <span className={cn(
                      "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full",
                      isToday ? "bg-blue-600 text-white" : "text-gray-700",
                      isWknd && !isToday && "text-gray-400"
                    )}>
                      {format(day, 'd')}
                    </span>
                  </div>
                  
                  <div className="mt-2 space-y-1">
                    {holiday && (
                      <div className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded truncate" title={holiday.name}>
                        🎉 {holiday.name}
                      </div>
                    )}
                    {leavesOnDay.map(leave => (
                      <div 
                        key={leave.id} 
                        className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded truncate"
                        title={`${leave.user_name} - ${leave.leave_type_name}`}
                      >
                        {leave.user_name}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
