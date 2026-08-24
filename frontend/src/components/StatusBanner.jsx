import React from 'react';
import { FaCircleCheck, FaCircleXmark, FaClock, FaCalendarDays, FaUsers, FaCheckDouble } from 'react-icons/fa6';

const StatusBanner = () => {
  // Change isOpen to false to test "Ayasfelgewm" status
  const status = {
    isOpen: true,
    remainingDays: 7,
    totalEvaluations: 1250,
    completedEvaluations: 847,
    responseRate: 67.8,
  };

  const { isOpen, remainingDays, totalEvaluations, completedEvaluations, responseRate } = status;

  const getBadge = () => {
    return isOpen 
      ? { text: 'Yasfelgewal (Open)', color: 'bg-green-500' }
      : { text: 'Ayasfelgewm (Closed)', color: 'bg-red-500' };
  };

  const badge = getBadge();

  return (
    <div className={`rounded-2xl p-6 md:p-8 transition-all duration-500 ${
      isOpen 
        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200' 
        : 'bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200'
    }`}>
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${
            isOpen ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
          }`}>
            {isOpen ? <FaCircleCheck /> : <FaCircleXmark />}
          </div>
          
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`px-4 py-1 rounded-full text-sm font-bold text-white ${badge.color}`}>
                {badge.text}
              </span>
              <span className="text-sm text-gray-500">
                {isOpen ? '✅ Evaluation in progress' : '⛔ Evaluation closed'}
              </span>
            </div>
            <p className="text-gray-600 mt-1 font-medium">
              {isOpen 
                ? 'Students can evaluate their instructors now!' 
                : 'The evaluation period is currently closed. Please check back later.'}
            </p>
          </div>
        </div>

        {isOpen && (
          <div className="flex items-center gap-2 bg-white/60 px-4 py-2 rounded-full">
            <FaClock className="text-ieps-blue-500" />
            <span className="font-semibold text-ieps-blue-600">
              {remainingDays} days remaining
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-ieps-blue-100 text-ieps-blue-600 flex items-center justify-center">
            <FaUsers />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Evaluations</p>
            <p className="font-bold text-gray-700">{totalEvaluations.toLocaleString()}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <FaCheckDouble />
          </div>
          <div>
            <p className="text-xs text-gray-500">Completed</p>
            <p className="font-bold text-gray-700">{completedEvaluations.toLocaleString()}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
            <FaCalendarDays />
          </div>
          <div>
            <p className="text-xs text-gray-500">Response Rate</p>
            <p className="font-bold text-gray-700">{responseRate}%</p>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-green-500 h-2.5 rounded-full transition-all duration-1000"
              style={{ width: `${responseRate}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-400 mt-1 text-right">{responseRate}% completion rate</p>
        </div>
      )}
    </div>
  );
};

export default StatusBanner;