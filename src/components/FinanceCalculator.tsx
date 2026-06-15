import React, { useState } from 'react';
import { Product, AppConfig } from '@/types.ts';
import { Calculator, ArrowRight, Wallet, Percent, Scale, RefreshCw } from 'lucide-react';

interface FinanceCalculatorProps {
  product: Product;
  config: AppConfig;
  priceData: {
    total: number;
    goldRate: number;
    basePrice: number;
    makingCharges: number;
    gst: number;
    makingPercent: number;
  };
  showFullDetails: boolean;
}

export const FinanceCalculator: React.FC<FinanceCalculatorProps> = ({ product, config, priceData, showFullDetails }) => {
  const [exchangeWeight, setExchangeWeight] = useState<string>('');
  const [exchangePurity, setExchangePurity] = useState<'22K' | '20K' | '18K'>('22K');
  
  if (!showFullDetails) {
      return (
          <div className="bg-stone-50 border border-stone-100 rounded-xl p-6 text-center">
              <Calculator size={24} className="mx-auto text-stone-300 mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Finance & Exchange</p>
              <p className="text-[10px] text-stone-400">Login to unlock payment plans and live exchange valuation.</p>
          </div>
      );
  }

  const advanceAmount = priceData.total * 0.20;
  const balanceAmount = priceData.total - advanceAmount;
  
  const goldRate24k = config.goldRate24k || (config.goldRate22k * (24/22));
  
  const getExchangeRate = (purity: '22K' | '20K' | '18K') => {
      switch (purity) {
          case '22K': return config.goldRate22k;
          case '20K': return goldRate24k * (20/24);
          case '18K': return goldRate24k * (18/24);
      }
  };
  
  const exchangeRate = getExchangeRate(exchangePurity);
  const exchangeValue = (parseFloat(exchangeWeight) || 0) * exchangeRate;
  const netPayable = Math.max(0, priceData.total - exchangeValue);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
        {/* Payment Plan */}
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
                <Wallet size={18} className="text-brand-dark" />
                <h3 className="text-xs font-bold text-brand-dark uppercase tracking-widest">Payment Plan</h3>
            </div>
            
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-stone-200/50">
                <div>
                   <p className="text-[9px] text-stone-500 uppercase font-bold tracking-tighter">Booking Advance (20%)</p>
                   <p className="text-sm font-bold text-brand-gold">₹{Math.round(advanceAmount).toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                   <p className="text-[9px] text-stone-500 uppercase font-bold tracking-tighter">Balance Amount</p>
                   <p className="text-sm font-mono text-brand-dark">₹{Math.round(balanceAmount).toLocaleString('en-IN')}</p>
                </div>
            </div>
            
            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-3">Balance Payment Schedule</p>
            <div className={`grid gap-2 ${((config.paymentPlanMonths || [1, 2, 3, 6]).length > 2) ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'}`}>
                {(config.paymentPlanMonths && config.paymentPlanMonths.length > 0 ? config.paymentPlanMonths : [1, 2, 3, 6]).map(months => (
                    <div key={months} className="bg-white border border-stone-100 rounded-lg p-3 text-center">
                        <p className="text-[10px] text-stone-400 mb-1 font-medium">{months} Month{months > 1 ? 's' : ''}</p>
                        <p className="text-xs font-mono font-bold text-brand-dark">₹{Math.round(balanceAmount / months).toLocaleString('en-IN')}<span className="text-[9px] text-stone-400 font-sans">/mo</span></p>
                    </div>
                ))}
            </div>
        </div>

        {/* Exchange Calculator */}
        <div className="bg-white border border-brand-gold/30 rounded-xl p-5 relative">
            <div className="absolute top-0 right-0 p-4">
                 <RefreshCw size={16} className="text-brand-gold/50" />
            </div>
            <div className="flex items-center gap-2 mb-4">
                <Scale size={18} className="text-brand-gold" />
                <h3 className="text-xs font-bold text-brand-dark uppercase tracking-widest">Old Gold Exchange</h3>
            </div>
            
            <p className="text-xs text-stone-500 mb-4 leading-relaxed">
                Exchange your old gold against this product. Calculated using live market rates.
            </p>
            
            <div className="flex flex-col md:flex-row gap-3 mb-4">
                <div className="flex-1 bg-stone-50 rounded-lg p-1.5 flex outline-1 outline-stone-200 focus-within:outline-brand-gold">
                    {(['22K', '20K', '18K'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setExchangePurity(p)}
                            className={`flex-1 py-1.5 text-[10px] font-bold tracking-widest rounded-md transition-all ${
                                exchangePurity === p 
                                    ? 'bg-white shadow-sm text-brand-gold' 
                                    : 'text-stone-400 hover:text-stone-600'
                            }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
                
                <div className="flex-1 relative">
                    <input 
                        type="number"
                        placeholder="Weight (grams)"
                        value={exchangeWeight}
                        onChange={(e) => setExchangeWeight(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-lg py-2.5 px-3 text-sm font-mono text-brand-dark focus:outline-none focus:border-brand-gold"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-stone-400 font-bold bg-stone-50">g</span>
                </div>
            </div>

            {exchangeValue > 0 && (
                <div className="mt-4 pt-4 border-t border-stone-100 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-stone-500">Exchange Value (@ ₹{Math.round(exchangeRate)}/g)</span>
                        <span className="font-mono text-emerald-600 font-bold">- ₹{Math.round(exchangeValue).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-stone-500">Product Price</span>
                        <span className="font-mono text-stone-500">₹{Math.round(priceData.total).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-stone-100">
                        <span className="text-xs font-bold uppercase tracking-widest text-brand-dark">Net Payable</span>
                        <span className="text-brand-gold font-bold text-lg">₹{Math.round(netPayable).toLocaleString('en-IN')}</span>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};
