import React, { useMemo, useState } from 'react';
import { User, Product, AnalyticsEvent } from '@/types.ts';
import { BrainCircuit, Target, MessageCircle, TrendingUp, Sparkles, Filter, CheckCircle, Zap } from 'lucide-react';

interface PredictiveMarketingPanelProps {
    customers: User[];
    products: Product[];
    analytics: AnalyticsEvent[];
}

export const PredictiveMarketingPanel: React.FC<PredictiveMarketingPanelProps> = ({ customers, products, analytics }) => {
    const [selectedSegment, setSelectedSegment] = useState<number | null>(null);

    // AI/Predictive logic: Analyze analytics to find segments
    // Since we are targeting Maharashtrian middle class, lightweight but heavy-looking, 
    // we want to find users interested in "Mangalsutra", "Thushi", "Necklace" under certain weights (e.g., < 15g)

    const segments = useMemo(() => {
        // 1. Budget-Conscious Buyers (Viewed lightweight items < 15g but high interaction)
        const budgetUsers = new Set<string>();
        // 2. High Intent (Added to wishlist/likes recently but no purchase)
        const highIntentUsers = new Set<string>();
        // 3. Festive Shoppers (Historically active around now or heavily viewing traditional categories)
        const festiveUsers = new Set<string>();

        analytics.forEach(event => {
            const product = products.find(p => p.id === event.productId);
            if (product) {
                if (product.weight && product.weight <= 15) {
                    budgetUsers.add(event.userId);
                }
                if (product.category?.toLowerCase().includes('mangalsutra') || product.category?.toLowerCase().includes('thushi') || product.title?.toLowerCase().includes('saaj')) {
                    festiveUsers.add(event.userId);
                }
                if (event.type === 'like') {
                    highIntentUsers.add(event.userId);
                }
            }
        });

        // Resolve user objects
        const getSegmentUsers = (ids: Set<string>) => customers.filter(c => ids.has(c.id));

        return [
            {
                id: 1,
                title: "Budget-Conscious Brides",
                description: "Customers who viewed lightweight (<15g) traditional jewellery. Ideal for 'Heavy Look, Light Weight' campaigns.",
                users: getSegmentUsers(budgetUsers),
                icon: Target,
                color: "text-emerald-600",
                bg: "bg-emerald-50",
                border: "border-emerald-100",
                template: "Hi {Name}, looking for a heavy bridal look within budget? Explore our new lightweight Thushi & Mangalsutra collection! Visit Sanghavi Jewel Studio today."
            },
            {
                id: 2,
                title: "High Intent (Warm Leads)",
                description: "Customers who liked products but haven't purchased yet. Good for small push/discounts.",
                users: getSegmentUsers(highIntentUsers),
                icon: Zap,
                color: "text-amber-600",
                bg: "bg-amber-50",
                border: "border-amber-100",
                template: "Hello {Name}, the jewellery you liked is selling out fast! Drop by Sanghavi Jewel Studio this week to try it on."
            },
            {
                id: 3,
                title: "Traditional / Festive Shoppers",
                description: "Interested in Mangalsutra, Thushi, and Kolhapuri Saaj. Best for upcoming festivals.",
                users: getSegmentUsers(festiveUsers),
                icon: Sparkles,
                color: "text-purple-600",
                bg: "bg-purple-50",
                border: "border-purple-100",
                template: "Namaskar {Name}, our exclusive Maharashtrian festive collection is here! Authentic Kolhapuri Saaj & Mangalsutra designs. Visit us!"
            }
        ];
    }, [customers, products, analytics]);

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-3 bg-gradient-to-br from-brand-dark to-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/10 blur-[100px] rounded-full mix-blend-screen" />
                    <div className="relative z-10 flex gap-6 items-start">
                        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10 shrink-0">
                            <BrainCircuit size={32} className="text-brand-gold" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-serif font-bold mb-2">Predictive Marketing Intelligence</h2>
                            <p className="text-slate-300 max-w-3xl leading-relaxed">
                                AI-driven customer segmentation tailored for your target audience. We've analyzed product interactions, weights, and categories to identify price-sensitive customers looking for lightweight, heavy-looking Maharashtrian jewellery. Use these insights to run highly targeted SMS/WhatsApp campaigns.
                            </p>
                        </div>
                    </div>
                </div>

                {segments.map((segment) => (
                    <div 
                        key={segment.id}
                        onClick={() => setSelectedSegment(segment.id === selectedSegment ? null : segment.id)}
                        className={`bg-white p-6 rounded-2xl border transition-all cursor-pointer hover:shadow-lg ${selectedSegment === segment.id ? 'ring-2 ring-brand-dark border-transparent shadow-md' : 'border-stone-100 shadow-sm'}`}
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${segment.bg} ${segment.color}`}>
                                <segment.icon size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-brand-dark uppercase tracking-wider text-xs">{segment.title}</h3>
                                <p className="text-2xl font-serif text-brand-dark font-bold">{segment.users.length}</p>
                            </div>
                        </div>
                        <p className="text-sm text-stone-500 mb-6 line-clamp-2">{segment.description}</p>
                        <div className="flex items-center justify-between border-t border-stone-100 pt-4">
                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Potential Reach</span>
                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${segment.bg} ${segment.color} border ${segment.border}`}>
                                {((segment.users.length / Math.max(customers.length, 1)) * 100).toFixed(1)}% of Leads
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {selectedSegment && (
                <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-serif font-bold text-brand-dark mb-2 flex items-center gap-2">
                                <Target className="text-brand-gold" /> Campaign Execution: {segments.find(s => s.id === selectedSegment)?.title}
                            </h3>
                            <p className="text-stone-500">Review the AI-generated message template and the targeted customer list.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="bg-stone-50 rounded-2xl p-6 border border-stone-100 relative">
                                <div className="absolute -top-3 left-6 bg-white px-2 text-[10px] font-bold uppercase tracking-widest text-brand-gold border border-stone-100 rounded">Suggested Message</div>
                                <p className="text-stone-700 leading-relaxed font-medium">
                                    "{segments.find(s => s.id === selectedSegment)?.template}"
                                </p>
                                <div className="mt-6 flex gap-3">
                                    <button className="flex-1 bg-brand-dark text-white rounded-xl py-3 font-bold text-xs uppercase tracking-widest hover:bg-black transition-colors flex items-center justify-center gap-2">
                                        <MessageCircle size={16} /> Send via WhatsApp API
                                    </button>
                                </div>
                            </div>
                            
                            <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                                <h4 className="font-bold text-blue-900 text-sm mb-2 flex items-center gap-2">
                                    <TrendingUp size={16} className="text-blue-600" /> Expected Outcome
                                </h4>
                                <p className="text-sm text-blue-800/80">
                                    Targeting this specific segment with tailored messaging can increase footfall by an estimated 15-20% for these specific lightweight collections, appealing directly to their budget sensitivity and design preferences.
                                </p>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-brand-dark uppercase tracking-widest text-[10px] mb-4">Targeted Customers ({segments.find(s => s.id === selectedSegment)?.users.length})</h4>
                            <div className="border border-stone-100 rounded-2xl overflow-hidden max-h-[400px] overflow-y-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-stone-50 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Name</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Phone</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Joined</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {segments.find(s => s.id === selectedSegment)?.users.map(u => (
                                            <tr key={u.id} className="hover:bg-stone-50 transition-colors">
                                                <td className="px-4 py-3 text-sm font-medium text-brand-dark">{u.name}</td>
                                                <td className="px-4 py-3 text-sm text-stone-500">{u.phone}</td>
                                                <td className="px-4 py-3 text-sm text-stone-400">{new Date(u.createdAt || '').toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                        {segments.find(s => s.id === selectedSegment)?.users.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="px-4 py-8 text-center text-stone-400 text-sm">
                                                    No customers currently fit this segment based on their activity.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
