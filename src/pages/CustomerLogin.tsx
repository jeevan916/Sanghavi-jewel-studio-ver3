
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { storeService } from '@/services/storeService.ts';
import { whatsappService } from '@/services/whatsappService.ts';
import { User } from '@/types.ts';
import { ArrowLeft, Loader2, Info, ShieldCheck, MessageCircle, Phone, ArrowRight, CheckCircle2, AlertTriangle, User as UserIcon, MapPin, Locate, Sparkles } from 'lucide-react';
import { Logo } from '@/components/Logo';

export const CustomerLogin: React.FC<{ onLoginSuccess: (u: User) => void }> = ({ onLoginSuccess }) => {
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [phone, setPhone] = useState('');
  const [isCheckingUser, setIsCheckingUser] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [existingUserName, setExistingUserName] = useState('');
  
  // Only for new users
  const [registrationData, setRegistrationData] = useState({ name: '', pincode: '' });
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

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

  // --- PHONE NUMBER HARMONIZATION ---
  const normalizePhone = (input: string): string => {
      // 1. Remove all non-numeric characters (spaces, +, -, etc.)
      let p = input.replace(/\D/g, '');
      
      // 2. Handle prefixes
      if (p.length > 10) {
          if (p.startsWith('91') && p.length === 12) {
              p = p.substring(2); // Remove 91
          } else if (p.startsWith('0') && p.length === 11) {
              p = p.substring(1); // Remove 0
          }
      }
      return p;
  };

  const getLocation = (): Promise<{lat: number, lng: number}> => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            resolve({ lat: 0, lng: 0 });
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
            (err) => resolve({ lat: 0, lng: 0 }), 
            { enableHighAccuracy: true, timeout: 5000 }
        );
    });
  };

  const handleVerifyPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = normalizePhone(phone);
    
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsCheckingUser(true);
    setError('');

    try {
        // 1. Get Location (Best Effort)
        const loc = await getLocation();
        setUserLocation(loc);

        // 2. Check Database with sanitized 10-digit phone
        const check = await storeService.checkCustomerExistence(cleanPhone);
        
        const hasDefaultName = check.user?.name?.startsWith('Client ') || false;

        if (check.exists && !hasDefaultName) {
            setExistingUserName(check.user?.name || '');
            setIsNewUser(false);
            initiateOtp(cleanPhone); // Pass normalized phone
        } else {
            if (check.exists && hasDefaultName && check.user?.pincode) {
                setRegistrationData(prev => ({...prev, pincode: check.user.pincode || ''}));
            }
            setIsNewUser(true);
            setIsCheckingUser(false);
        }
    } catch (err: any) {
        setError("Network Error: Unable to verify account status.");
        setIsCheckingUser(false);
    }
  };

  const handleRegisterAndSendOtp = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!registrationData.name.trim()) { setError('Full Name is required.'); return; }
      if (!registrationData.pincode.trim() || registrationData.pincode.length < 6) { setError('Valid Pincode is required.'); return; }
      
      const cleanPhone = normalizePhone(phone);
      initiateOtp(cleanPhone);
  };

  const initiateOtp = async (normalizedPhone: string) => {
      setIsLoading(true);
      setError('');
      setIsDemoMode(false);

      try {
          const config = await storeService.getConfig();
          const otp = whatsappService.generateOTP();
          
          // Send OTP with credentials from config
          const result = await whatsappService.sendOTP(normalizedPhone, otp, {
              phoneId: config.whatsappPhoneId,
              token: config.whatsappToken
          });

          if (result.success) {
            setGeneratedOtp(otp);
            setStep('otp');
            setTimer(60);
            if (result.isDemo) setIsDemoMode(true);
          } else {
            setError(result.error || 'WhatsApp delivery failed.');
          }
      } catch (err) {
          setError('Failed to initialize verification service.');
      } finally {
          setIsLoading(false);
          setIsCheckingUser(false);
      }
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

  const handleVerifyOtp = async () => {
    const entered = otpValue.join('');
    if (entered.length < 6) return;

    if (entered === generatedOtp) {
      setIsLoading(true);
      try {
        const cleanPhone = normalizePhone(phone);
        const user = await storeService.loginWithWhatsApp(
            cleanPhone, 
            isNewUser ? registrationData.name : undefined, 
            isNewUser ? registrationData.pincode : undefined,
            userLocation
        );
        if (user) {
          storeService.logEvent('login', undefined, user);
          onLoginSuccess(user);
        } else {
          setError('Session creation failed.');
        }
      } catch (err) {
        setError('Server verification failed.');
      } finally {
        setIsLoading(false);
      }
    } else {
      setError('Incorrect verification code.');
      if (navigator.vibrate) navigator.vibrate(100);
    }
  };

  useEffect(() => {
    if (otpValue.every(v => v !== '')) {
      handleVerifyOtp();
    }
  }, [otpValue]);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 animate-fade-in">
      <div className="max-w-md w-full bg-white p-12 rounded-[2.5rem] shadow-2xl border border-stone-100 relative overflow-hidden transition-all duration-500">
        
        {/* Progress indicator */}
        <div className="absolute top-0 left-0 right-0 h-1.5 flex">
          <div className={`flex-1 transition-all duration-700 ${step === 'details' || step === 'otp' ? 'bg-brand-gold' : 'bg-stone-50'}`} />
          <div className={`flex-1 transition-all duration-700 ${step === 'otp' ? 'bg-brand-gold' : 'bg-stone-50'}`} />
        </div>

        <button onClick={() => step === 'otp' ? setStep('details') : navigate('/')} className="absolute top-8 left-8 text-stone-300 hover:text-brand-dark transition-all p-2 hover:bg-stone-50 rounded-xl">
          <ArrowLeft size={24}/>
        </button>
        
        <div className="text-center mt-6 mb-12">
          <Logo size="md" showText={false} className="mb-8 mx-auto scale-110" />
          <h2 className="font-serif font-bold text-4xl text-brand-dark mb-3 tracking-tight">
            {step === 'details' ? 'Vault Access' : 'Identity Verification'}
          </h2>
          <p className="text-stone-400 font-serif italic text-base">
            {step === 'details' 
              ? 'Enter your credentials to unlock the collection.' 
              : `A secure code has been dispatched to ${phone}.`}
          </p>
        </div>

        {step === 'details' ? (
          <>
            {!isNewUser ? (
                // 1. Initial Phone Entry
                <form onSubmit={handleVerifyPhone} className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-[0.3em] text-stone-400 ml-1">WhatsApp Identity</label>
                        <div className="relative group">
                            <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-brand-gold transition-colors" size={20} />
                            <input 
                            type="tel" 
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            placeholder="Mobile Number"
                            className="w-full bg-stone-50 border border-stone-100 rounded-2xl pl-14 pr-6 py-5 text-brand-dark focus:ring-4 focus:ring-brand-gold/10 focus:bg-white focus:border-brand-gold/30 outline-none transition-all font-medium tracking-widest text-lg"
                            required
                            />
                        </div>
                    </div>
                    {error && (
                        <div className="p-4 bg-brand-red/5 text-brand-red text-xs rounded-2xl flex items-start gap-3 border border-brand-red/10 animate-shake">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                            <span className="font-medium">{error}</span>
                        </div>
                    )}
                    <button 
                        type="submit" 
                        disabled={isCheckingUser}
                        className="w-full bg-brand-dark text-white py-5 rounded-2xl font-bold uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 hover:bg-brand-gold transition-all shadow-2xl shadow-brand-dark/20 disabled:opacity-50 active:scale-95"
                    >
                        {isCheckingUser ? <Loader2 className="animate-spin" size={20}/> : <Locate size={20}/>}
                        {isCheckingUser ? 'Verifying...' : 'Request Access'}
                    </button>
                    <p className="text-[9px] text-center text-stone-300 uppercase tracking-widest">Secured via end-to-end encryption</p>
                </form>
            ) : (
                // 2. New User Registration
                <form onSubmit={handleRegisterAndSendOtp} className="space-y-6 animate-in slide-in-from-bottom-4">
                     <div className="p-4 bg-brand-gold/5 text-brand-gold text-[10px] uppercase font-bold tracking-widest rounded-2xl flex items-center gap-3 border border-brand-gold/10 mb-6">
                        <Sparkles size={18}/> <span>New Member Registration Required</span>
                     </div>
                     
                     <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-[0.3em] text-stone-400 ml-1">Full Name</label>
                        <div className="relative group">
                            <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-brand-gold transition-colors" size={20} />
                            <input 
                            type="text" 
                            value={registrationData.name}
                            onChange={e => setRegistrationData({...registrationData, name: e.target.value})}
                            placeholder="Artisan Name"
                            className="w-full bg-stone-50 border border-stone-100 rounded-2xl pl-14 pr-6 py-5 text-brand-dark focus:ring-4 focus:ring-brand-gold/10 focus:bg-white focus:border-brand-gold/30 outline-none transition-all font-medium text-lg"
                            required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-[0.3em] text-stone-400 ml-1">Location Pincode</label>
                        <div className="relative group">
                            <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-brand-gold transition-colors" size={20} />
                            <input 
                            type="number" 
                            value={registrationData.pincode}
                            onChange={e => setRegistrationData({...registrationData, pincode: e.target.value})}
                            placeholder="Postal Code"
                            className="w-full bg-stone-50 border border-stone-100 rounded-2xl pl-14 pr-6 py-5 text-brand-dark focus:ring-4 focus:ring-brand-gold/10 focus:bg-white focus:border-brand-gold/30 outline-none transition-all font-medium text-lg"
                            required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-brand-red/5 text-brand-red text-xs rounded-2xl flex items-start gap-3 border border-brand-red/10 animate-shake">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                            <span className="font-medium">{error}</span>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                         <button type="button" onClick={() => { setIsNewUser(false); setRegistrationData({name: '', pincode: ''}); }} className="px-6 py-5 bg-stone-50 text-stone-400 font-bold rounded-2xl hover:bg-stone-100 transition-colors uppercase text-[10px] tracking-widest">Back</button>
                         <button 
                            type="submit" 
                            disabled={isLoading}
                            className="flex-1 bg-brand-dark text-white py-5 rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 hover:bg-brand-gold transition-all shadow-2xl shadow-brand-dark/20 disabled:opacity-50 active:scale-95"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={20}/> : <ArrowRight size={20}/>}
                            Join & Verify
                        </button>
                    </div>
                </form>
            )}
          </>
        ) : (
          <div className="space-y-10 animate-in fade-in slide-in-from-right-4">
             {!isNewUser && existingUserName && (
                 <div className="text-center -mt-6 mb-6">
                     <span className="text-[10px] text-stone-400 uppercase font-bold tracking-[0.3em]">Welcome back,</span>
                     <h3 className="font-serif text-2xl text-brand-dark font-bold mt-1">{existingUserName}</h3>
                 </div>
             )}

            <div className="flex justify-between gap-3">
              {otpValue.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => { otpRefs.current[idx] = el; }}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(idx, e.target.value)}
                  onKeyDown={e => handleKeyDown(idx, e)}
                  className="w-full h-16 bg-stone-50 border border-stone-100 rounded-2xl text-center text-2xl font-bold text-brand-dark focus:border-brand-gold focus:ring-4 focus:ring-brand-gold/10 focus:bg-white outline-none transition-all"
                />
              ))}
            </div>

            {error && (
              <div className="p-4 bg-brand-red/5 text-brand-red text-xs rounded-2xl flex items-start gap-3 border border-brand-red/10 animate-shake">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {isDemoMode && (
              <div className="p-6 bg-brand-gold/5 border border-brand-gold/20 rounded-3xl shadow-sm animate-in zoom-in-95 duration-500">
                <div className="flex items-center gap-2 text-brand-gold font-bold text-[10px] uppercase tracking-[0.3em] mb-3">
                   <Sparkles size={18} className="animate-pulse" /> Debug Override
                </div>
                <p className="text-xs text-stone-500 font-medium leading-relaxed">
                  WhatsApp delivery is currently bypassed.
                  <span className="block mt-3 font-bold text-brand-dark bg-white/80 p-3 rounded-xl border border-brand-gold/20 text-center text-lg tracking-[0.5em]">
                    {generatedOtp}
                  </span>
                </p>
              </div>
            )}

            <div className="text-center space-y-4">
              <p className="text-stone-300 text-[10px] uppercase font-bold tracking-widest">Issue receiving the code?</p>
              <button 
                onClick={() => initiateOtp(normalizePhone(phone))}
                disabled={timer > 0 || isLoading}
                className={`text-[10px] font-bold uppercase tracking-[0.3em] transition-all px-6 py-3 rounded-full border ${timer > 0 ? 'text-stone-300 border-stone-100' : 'text-brand-gold border-brand-gold/20 hover:bg-brand-gold/5'}`}
              >
                {timer > 0 ? `Resend in ${timer}s` : 'Resend Access Code'}
              </button>
            </div>
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-stone-50 text-center space-y-6">
          <div className="flex justify-center items-center gap-3 text-stone-300">
            <ShieldCheck size={18} className="text-emerald-500" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Bespoke Security Protocol</span>
          </div>
          <Link to="/staff" className="inline-block text-stone-300 text-[10px] font-bold uppercase tracking-[0.3em] hover:text-brand-gold transition-all border-b border-transparent hover:border-brand-gold pb-1">Personnel Portal</Link>
        </div>
      </div>
      
      {isLoading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-md z-50 flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-brand-gold mb-6" size={56} />
          <p className="font-serif italic text-xl text-brand-dark animate-pulse tracking-widest uppercase">Securing Session...</p>
        </div>
      )}
    </div>
  );
};

export default CustomerLogin;
