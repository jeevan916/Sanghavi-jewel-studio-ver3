import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/services/storeService';
import { Loader2, Megaphone, CheckCircle2, TrendingDown } from 'lucide-react';
import { Product } from '@/types';
import { storeService } from '@/services/storeService';

export const WishlistCampaigns = ({ config }: { config: any }) => {
    const [wishlists, setWishlists] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isNotifying, setIsNotifying] = useState(false);
    const [candidates, setCandidates] = useState<any[]>([]);

    useEffect(() => {
        loadWishlists();
    }, []);

    const loadWishlists = async () => {
        setIsLoading(true);
        try {
            const data = await apiFetch('/admin/wishlists/all');
            setWishlists(data);
            
            // Calculate which ones to notify
            const toNotify = [];
            for (const item of data) {
                // Mock product for calculation
                const p: Product = {
                    id: item.productId,
                    title: item.title,
                    category: item.category,
                    weight: item.weight,
                    meta: typeof item.meta === 'string' ? JSON.parse(item.meta || '{}') : (item.meta || {}),
                    isHidden: item.isHidden,
                    images: typeof item.images === 'string' ? JSON.parse(item.images || '[]') : (item.images || []),
                    thumbnails: typeof item.thumbnails === 'string' ? JSON.parse(item.thumbnails || '[]') : (item.thumbnails || []),
                    tags: [],
                    createdAt: new Date().toISOString(),
                    description: '',
                    subCategory: ''
                };
                
                const currentPriceData = storeService.calculatePrice(p, config);
                const currentPrice = currentPriceData.total;
                
                // Only consider if current price is less than requested price
                if (currentPrice < item.priceWhenWishlisted) {
                    // Check if not notified in last 3 days
                    if (item.lastNotifiedAt) {
                        const diffDays = (Date.now() - new Date(item.lastNotifiedAt).getTime()) / (1000 * 60 * 60 * 24);
                        if (diffDays < 3) continue;
                    }
                    toNotify.push({
                        ...item,
                        currentPrice: Math.round(currentPrice)
                    });
                }
            }
            setCandidates(toNotify);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNotify = async () => {
        if (!config.whatsappToken || !config.whatsappPhoneId) {
            alert('WhatsApp API is not configured in Settings.');
            return;
        }

        if (!confirm(`Are you sure you want to send WhatsApp notifications to ${candidates.length} clients?`)) return;

        setIsNotifying(true);
        try {
            const payload = candidates.map(c => ({
                wishlistId: c.wishlistId,
                customerId: c.customerId,
                customerName: c.customerName,
                phone: c.phone,
                productTitle: c.title,
                productId: c.productId,
                currentPrice: c.currentPrice
            }));
            
            const res = await apiFetch('/admin/wishlists/notify', {
                method: 'POST',
                body: JSON.stringify({ notifications: payload })
            });

            if (res.success) {
                alert(`Successfully sent ${res.sentCount} WhatsApp messages!`);
                loadWishlists(); // Reload to reflect updated lastNotifiedAt
            }
        } catch (e) {
            console.error(e);
            alert('Failed to send notifications. Try again later.');
        } finally {
            setIsNotifying(false);
        }
    };

    if (isLoading) {
        return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-brand-gold" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 flex items-center justify-between">
                <div>
                    <h3 className="font-serif text-2xl font-bold flex items-center gap-2"><Megaphone className="text-brand-gold" /> Price Drop Campaign</h3>
                    <p className="text-stone-400 text-sm mt-1">Automatically send WhatsApp notifications to users whose wishlisted items have dropped in price. Anti-spam prevents duplicate messages within 3 days.</p>
                </div>
                <button 
                    onClick={handleNotify} 
                    disabled={candidates.length === 0 || isNotifying}
                    className="px-6 py-3 bg-brand-dark text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-brand-red disabled:opacity-50 transition flex items-center gap-2"
                >
                    {isNotifying ? <Loader2 className="animate-spin" /> : <TrendingDown />}
                    Send Notification ({candidates.length})
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-stone-50 border-b border-stone-100 uppercase tracking-widest text-[10px] text-stone-400">
                        <tr>
                            <th className="p-4 font-bold">Client</th>
                            <th className="p-4 font-bold">Item</th>
                            <th className="p-4 font-bold">Wishlist Price</th>
                            <th className="p-4 font-bold text-green-600">Current Price</th>
                            <th className="p-4 font-bold">Last Notified</th>
                            <th className="p-4 font-bold text-center">Eligibility</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {wishlists.map((w, index) => {
                            const candidate = candidates.find(c => c.wishlistId === w.wishlistId);
                            const isEligible = !!candidate;
                            return (
                                <tr key={index} className={isEligible ? 'bg-green-50/20' : ''}>
                                    <td className="p-4">
                                        <p className="text-xs font-bold text-brand-dark">{w.customerName}</p>
                                        <p className="text-[10px] font-mono text-stone-400">{w.phone}</p>
                                    </td>
                                    <td className="p-4 text-xs font-bold text-brand-dark">{w.title}</td>
                                    <td className="p-4 text-xs font-mono text-stone-500">₹{Math.round(w.priceWhenWishlisted).toLocaleString('en-IN')}</td>
                                    <td className="p-4 text-xs font-mono text-green-600 font-bold">
                                        {candidate ? `₹${candidate.currentPrice.toLocaleString('en-IN')}` : '-'}
                                    </td>
                                    <td className="p-4 text-xs text-stone-400">
                                        {w.lastNotifiedAt ? new Date(w.lastNotifiedAt).toLocaleDateString() : 'Never'}
                                    </td>
                                    <td className="p-4 flex justify-center">
                                        {isEligible ? (
                                            <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold uppercase rounded-md flex items-center gap-1"><CheckCircle2 size={12}/> Eligible</span>
                                        ) : (
                                            <span className="px-2 py-1 bg-stone-100 text-stone-400 text-[10px] uppercase rounded-md">Pending</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {wishlists.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-stone-400 text-xs uppercase tracking-widest">No wishlist data available</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
