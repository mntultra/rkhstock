import { useState } from 'react';
import PhysicalCountSection from './components/PhysicalCountSection';
import ManualAdjustSection from './components/ManualAdjustSection';
import { ClipboardCheck, Edit3 } from 'lucide-react';

export default function StockAdjustmentPage() {
  const [activeTab, setActiveTab] = useState<'count' | 'manual'>('count');

  return (
    <div className="max-w-full mx-auto space-y-4">
      {/* Top Tab Bar */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-emerald-100 flex gap-2 w-full animate-fade-in-up">
        <button
          onClick={() => setActiveTab('count')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all ${
            activeTab === 'count'
              ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-200'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 border border-transparent'
          }`}
        >
          <ClipboardCheck size={20} />
          <span>📋 ตรวจนับจริง (Physical Count)</span>
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all ${
            activeTab === 'manual'
              ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-200'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 border border-transparent'
          }`}
        >
          <Edit3 size={20} />
          <span>✏️ ปรับยอดแมนวล (Manual Adjust)</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === 'count' && <PhysicalCountSection />}
        {activeTab === 'manual' && <ManualAdjustSection />}
      </div>
    </div>
  );
}
