
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { storeService } from '../services/storeService';
import { whatsappService } from '../services/whatsappService';
import { User } from '../types';
import { ArrowLeft, Loader2, Info, ShieldCheck, MessageCircle, Phone, ArrowRight, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';

export const CustomerLogin: React.FC<{ onLoginSuccess: (u: User) => void }> = ({ onLoginSuccess }) => {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpValue, setOtpValue] = useState(['', '', '', '', '', '']);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [timer, setTimer] = useState(0);
  const navigate = useNavigate();
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid WhatsApp number with country code (e.g., 91...)');
      return;
    }

    setIsLoading(true);
    setError('');
    setIsDemoMode(false);
    
    const otp = whatsappService.generateOTP();
    const result = await whatsappService.sendOTP(phoneNumber, otp);

    if (result.success) {
      setGeneratedOtp(otp);
      setStep('otp');
      setTimer(60);
      if (result.isDemo) {
        setIsDemoMode(true);
      }
    } else {
      setError(result.error || 'WhatsApp delivery failed. Please check your Meta configuration.');
    }
    setIsLoading(false);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    const newOtp = [...otpValue];
    newOtp[index] = value.slice(-1);
    setOtpValue(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpValue[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const entered = otpValue.join('');
    if (entered.length < 6) return;

    if (entered === generatedOtp) {
      setIsLoading(true);
      try {
        const user = await storeService.loginWithWhatsApp(phoneNumber);
        if (user) {
          onLoginSuccess(user);
        } else {
          setError('Session creation failed. Please contact support.');
        }
      } catch (err) {
        setError('Server verification failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    } else {
      setError('Incorrect verification code.');
      // Vibration for failure
      if (navigator.vibrate) navigator.vibrate(100);
    }
  };

  useEffect(() => {
    if (otpValue.every(v => v !== '')) {
      handleVerify();
    }
  }, [otpValue]);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 animate-fade-in">
      <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-2xl border border-stone-100 relative overflow-hidden">
        
        {/* Progress indicator */}
        <div className="absolute top-0 left-0 right-0 h-1 flex">
          <div className={`flex-1 transition-colors duration-500 ${step === 'phone' || step === 'otp' ? 'bg-gold-500' : 'bg-stone-100'}`} />
          <div className={`flex-1 transition-colors duration-500 ${step === 'otp' ? 'bg-gold-500' : 'bg-stone-100'}`} />
        </div>

        <button onClick={() => step === 'otp' ? setStep('phone') : navigate('/')} className="absolute top-6 left-6 text-stone-400 hover:text-stone-900 transition p-2">
          <ArrowLeft size={24}/>
        </button>
        
        <div className="text-center mt-4 mb-10">
          <div className="bg-gold-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gold-600">
            {step === 'phone' ? <MessageCircle size={32} /> : <ShieldCheck size={32} />}
          </div>
          <h2 className="font-serif text-3xl text-stone-800 mb-2">
            {step === 'phone' ? 'Studio Access' : 'Verify Identity'}
          </h2>
          <p className="text-stone-500 font-light text-sm">
            {step === 'phone' 
              ? 'Enter your registered WhatsApp number for secure access.' 
              : `A 6-digit code has been dispatched to your WhatsApp.`}
          </p>
        </div>

        {step === 'phone' ? (
          <form onSubmit={handleSendOtp} className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-widest text-stone-400 ml-1">International Format</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input 
                  type="tel" 
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="e.g. 919876543210"
                  className="w-full bg-stone-50 border border-stone-100 rounded-2xl pl-12 pr-4 py-4 text-stone-800 focus:ring-2 focus:ring-gold-500/50 outline-none transition-all font-medium"
                  required
                />
              </div>
            </div>
            
            {error && (
              <div className="p-4 bg-red-50 text-red-700 text-xs rounded-2xl flex flex-col gap-2 border border-red-100 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span className="font-bold">WhatsApp Delivery Error</span>
                </div>
                <p className="opacity-80 ml-6">{error}</p>
                <div className="ml-6 pt-2 border-t border-red-100/50">
                    <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-red-800 underline flex items-center gap-1 hover:text-red-900 transition">
                        Check Meta Settings <ExternalLink size={10} />
                    </a>
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all shadow-xl shadow-stone-200 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20}/> : <ArrowRight size={20}/>}
              {isLoading ? 'Requesting Code...' : 'Send Access Code'}
            </button>
          </form>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <div className="flex justify-between gap-2">
              {otpValue.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => otpRefs.current[idx] = el}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(idx, e.target.value)}
                  onKeyDown={e => handleKeyDown(idx, e)}
                  className="w-12 h-14 bg-stone-50 border border-stone-200 rounded-xl text-center text-xl font-bold text-stone-800 focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 outline-none transition-all"
                />
              ))}
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-start gap-2 border border-red-100">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {isDemoMode && (
              <div className="p-5 bg-gold-50 border border-gold-200 rounded-2xl shadow-sm animate-in zoom-in-95 duration-500">
                <div className="flex items-center gap-2 text-gold-800 font-bold text-xs uppercase tracking-widest mb-2">
                   <Info size={16} /> Admin Debug Active
                </div>
                <p className="text-[11px] text-stone-600 font-medium leading-relaxed">
                  WhatsApp message failed (likely Template or Token issue).
                  <span className="block mt-2 font-bold text-stone-800 bg-white/50 p-2 rounded border border-gold-200">
                    Press F12 (Console) to view your 6-digit verification code.
                  </span>
                </p>
              </div>
            )}

            <div className="text-center">
              <p className="text-stone-400 text-xs mb-2">Issue receiving the code?</p>
              <button 
                onClick={() => handleSendOtp()}
                disabled={timer > 0 || isLoading}
                className={`text-xs font-bold uppercase tracking-widest ${timer > 0 ? 'text-stone-300' : 'text-gold-600 hover:text-gold-700'}`}
              >
                {timer > 0 ? `Resend in ${timer}s` : 'Resend Access Code'}
              </button>
            </div>
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-stone-100 text-center space-y-4">
          <p className="text-[10px] uppercase font-bold tracking-widest text-stone-300">Sanghavi Biometric Standard</p>
          <div className="flex justify-center gap-2 text-stone-400">
            <CheckCircle2 size={16} className="text-gold-500" />
            <span className="text-[10px] font-medium">Bespoke Authorization Encrypted</span>
          </div>
          <Link to="/staff" className="block text-stone-400 text-[10px] font-bold uppercase tracking-widest hover:text-gold-600 transition">Personnel Portal →</Link>
        </div>
      </div>
      
      {isLoading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-gold-600 mb-4" size={48} />
          <p className="font-serif text-lg text-stone-800 animate-pulse">Establishing Secure Session...</p>
        </div>
      )}
    </div>
  );
};
