import React from 'react';
import { Settings, Save, Loader2, Gem, Tag, TrendingUp, DollarSign } from 'lucide-react';
import { Product, AppConfig } from '@/types.ts';

interface AdminEditControlsProps {
    editForm: Partial<Product>;
    setEditForm: (form: Partial<Product>) => void;
    config: AppConfig | null;
    isSaving: boolean;
    onSave: () => void;
}

export const AdminEditControls: React.FC<AdminEditControlsProps> = ({ editForm, setEditForm, config, isSaving, onSave }) => {
    return (
        <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100 space-y-6 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between">
                <h3 className="text-[9px] font-bold text-brand-gold uppercase tracking-[0.3em] flex items-center gap-2">
                    <Settings size={17} /> Admin Pricing Controls
                </h3>
                <button type="button" onClick={onSave} disabled={isSaving} className="px-4 py-2 bg-brand-dark text-white rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-brand-red transition-all flex items-center gap-2">
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
                </button>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-[8px] font-bold uppercase text-stone-400 tracking-widest mb-1.5 ml-1">Product Title</label>
                    <input 
                        value={editForm.title || ''} 
                        onChange={e => setEditForm({...editForm, title: e.target.value})}
                        className="w-full font-serif text-2xl text-brand-dark bg-white p-3 rounded-xl border border-stone-100 outline-none focus:border-brand-gold transition-all"
                        placeholder="Product Title"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="block text-[9px] font-bold uppercase text-stone-400 tracking-widest ml-1">Gold Weight (g)</label>
                        <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-stone-100">
                            <Gem size={22} className="text-brand-gold" />
                            <input 
                                type="number" 
                                step="0.01"
                                value={editForm.weight || 0} 
                                onChange={e => setEditForm({...editForm, weight: parseFloat(e.target.value)})}
                                className="flex-1 bg-transparent outline-none font-mono font-bold text-brand-dark text-lg"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[9px] font-bold uppercase text-stone-400 tracking-widest ml-1">Making Segment</label>
                        <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-stone-100">
                            <Tag size={22} className="text-brand-gold" />
                            <select 
                                value={editForm.meta?.makingChargeSegmentId || ''}
                                onChange={e => setEditForm({...editForm, meta: {...(editForm.meta || {}), makingChargeSegmentId: e.target.value, makingChargePercent: e.target.value === 'custom' ? (editForm.meta?.makingChargePercent || 12) : undefined}})}
                                className="flex-1 bg-transparent outline-none text-xs font-bold uppercase tracking-widest"
                            >
                                <option value="">Default ({config?.makingChargeSegments.find(s => s.id === config?.defaultMakingChargeSegmentId)?.name || '12%'})</option>
                                {config?.makingChargeSegments.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.percent}%)</option>
                                ))}
                                <option value="custom">Custom %</option>
                            </select>
                        </div>
                    </div>

                    {editForm.meta?.makingChargeSegmentId === 'custom' && (
                        <div className="space-y-2">
                            <label className="block text-[9px] font-bold uppercase text-stone-400 tracking-widest ml-1">Custom Making %</label>
                            <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-stone-100">
                                <TrendingUp size={22} className="text-brand-gold" />
                                <input 
                                    type="number"
                                    value={editForm.meta?.makingChargePercent || 12}
                                    onChange={e => setEditForm({...editForm, meta: {...(editForm.meta || {}), makingChargePercent: parseFloat(e.target.value)}})}
                                    className="flex-1 bg-transparent outline-none font-mono font-bold text-brand-dark"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="block text-[9px] font-bold uppercase text-stone-400 tracking-widest ml-1">Other Charges (₹)</label>
                        <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-stone-100">
                            <DollarSign size={22} className="text-brand-gold" />
                            <input 
                                type="number"
                                value={editForm.meta?.otherCharges || 0}
                                onChange={e => setEditForm({...editForm, meta: {...(editForm.meta || {}), otherCharges: parseFloat(e.target.value)}})}
                                className="flex-1 bg-transparent outline-none font-mono font-bold text-brand-dark"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
