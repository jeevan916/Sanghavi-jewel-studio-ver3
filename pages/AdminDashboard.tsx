import React, { useEffect, useState } from 'react';
import { getJewelryMarketTrends } from '../services/geminiService';
import { Loader2, TrendingUp, BarChart3, Users, Settings } from 'lucide-react';

interface AdminDashboardProps {
  onNavigate?: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [trends, setTrends] = useState<{text: string, sources: any[]} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch trends on mount
    getJewelryMarketTrends()
      .then(setTrends)
      .catch(() => console.error("Failed to load trends"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 pb-24">
      <header className="mb-8 flex justify-between items-center">
        <div>
           <h2 className="font-serif text-3xl text-gold-700">Admin Dashboard</h2>
           <p className="text-stone-500">Market intelligence & shop performance.</p>
        </div>
        <div className="flex gap-2 items-center">
            {onNavigate && (
                <button 
                    onClick={() => onNavigate('settings')} 
                    className="p-2 text-stone-500 hover:text-stone-900 bg-white border border-stone-200 rounded-lg shadow-sm"
                    title="Settings"
                >
                    <Settings size={20} />
                </button>
            )}
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Node Server Active
            </span>
        </div>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Users size={24} /></div>
            <div>
                <p className="text-stone-500 text-sm">Active Visitors</p>
                <p className="text-2xl font-bold text-stone-800">124</p>
            </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-4">
            <div className="p-3 bg-gold-50 text-gold-600 rounded-xl"><BarChart3 size={24} /></div>
            <div>
                <p className="text-stone-500 text-sm">Products Indexed</p>
                <p className="text-2xl font-bold text-stone-800">48</p>
            </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><TrendingUp size={24} /></div>
            <div>
                <p className="text-stone-500 text-sm">Inquiries Today</p>
                <p className="text-2xl font-bold text-stone-800">8</p>
            </div>
        </div>
      </div>

      {/* AI Insights Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        <div className="p-6 border-b border-stone-100 bg-gradient-to-r from-gold-50 to-white">
            <h3 className="font-serif text-xl text-gold-800 flex items-center gap-2">
                <SparklesIcon className="text-gold-600" />
                Live Market Trends (AI)
            </h3>
        </div>
        <div className="p-6">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-stone-400">
                    <Loader2 className="animate-spin mb-2" size={32} />
                    <p>Scouring the web for jewelry trends...</p>
                </div>
            ) : (
                <div className="prose prose-stone max-w-none">
                    <div className="whitespace-pre-wrap text-stone-700 leading-relaxed">
                        {trends?.text}
                    </div>
                    
                    {trends?.sources && trends.sources.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-stone-100">
                            <h4 className="text-sm font-bold text-stone-400 uppercase tracking-wider mb-4">Sources</h4>
                            <div className="grid gap-2">
                                {trends.sources.map((chunk, idx) => (
                                    <div key={idx} className="text-sm truncate text-blue-600 hover:underline">
                                       <a href={chunk.web?.uri} target="_blank" rel="noopener noreferrer">
                                            {chunk.web?.title || chunk.web?.uri}
                                       </a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

const SparklesIcon = ({ className = "" }) => (
  <svg className={`w-5 h-5 ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" fill="currentColor"/>
  </svg>
);