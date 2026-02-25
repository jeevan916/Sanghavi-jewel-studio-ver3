
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { storeService } from '@/services/storeService.ts';
import { whatsappService } from '@/services/whatsappService.ts';
import { User } from '@/types.ts';
import { ArrowLeft, Loader2, Info, ShieldCheck, MessageCircle, Phone, ArrowRight, CheckCircle2, AlertTriangle, User as UserIcon, MapPin, Locate } from 'lucide-react';
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

      const otp = whatsappService.generateOTP();
      
      // Send OTP (whatsappService handles adding 91 prefix for API)
      const result = await whatsappService.sendOTP(normalizedPhone, otp);

      if (result.success) {
        setGeneratedOtp(otp);
        setStep('otp');
        setTimer(60);
        if (result.isDemo) setIsDemoMode(true);
      } else {
        setError(result.error || 'WhatsApp delivery failed.');
      }
      setIsLoading(false);
      setIsCheckingUser(false);
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
    <div className="min-h-screen bg-white flex items-center justify-center p-6 animate-fade-in">
      <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-2xl border border-stone-100 relative overflow-hidden transition-all duration-500">
        
        {/* Progress indicator */}
        <div className="absolute top-0 left-0 right-0 h-1 flex">
          <div className={`flex-1 transition-colors duration-500 ${step === 'details' || step === 'otp' ? 'bg-brand-gold' : 'bg-stone-50'}`} />
          <div className={`flex-1 transition-colors duration-500 ${step === 'otp' ? 'bg-brand-gold' : 'bg-stone-50'}`} />
        </div>

        <button onClick={() => step === 'otp' ? setStep('details') : navigate('/')} className="absolute top-6 left-6 text-stone-300 hover:text-brand-dark transition p-2">
          <ArrowLeft size={24}/>
        </button>
        
        <div className="text-center mt-4 mb-8">
          <Logo size="md" className="mb-6" />
          <h2 className="font-sans font-bold text-3xl text-brand-dark mb-2">
            {step === 'details' ? 'Studio Access' : 'Verify Identity'}
          </h2>
          <p className="text-stone-400 font-serif italic text-sm">
            {step === 'details' 
              ? 'Enter your number to check eligibility.' 
              : `Code sent to ${phone}. Location Secured.`}
          </p>
        </div>

        {step === 'details' ? (
          <>
            {!isNewUser ? (
                // 1. Initial Phone Entry
                <form onSubmit={handleVerifyPhone} className="space-y-4">
                     <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-stone-400 ml-1">WhatsApp Number</label>
                        <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
                            <input 
                            type="tel" 
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            placeholder="e.g. 9876543210"
                            className="w-full bg-stone-50 border border-stone-100 rounded-2xl pl-12 pr-4 py-4 text-brand-dark focus:ring-2 focus:ring-brand-gold/50 outline-none transition-all font-medium tracking-wider"
                            required
                            />
                        </div>
                    </div>
                    {error && (
                        <div className="p-3 bg-brand-red/10 text-brand-red text-xs rounded-xl flex items-start gap-2 border border-brand-red/20">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}
                    <button 
                        type="submit" 
                        disabled={isCheckingUser}
                        className="w-full bg-brand-dark text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-brand-red transition-all shadow-xl shadow-brand-dark/10 disabled:opacity-50"
                    >
                        {isCheckingUser ? <Loader2 className="animate-spin" size={20}/> : <Locate size={20}/>}
                        {isCheckingUser ? 'Verifying...' : 'Verify Number'}
                    </button>
                    <p className="text-[10px] text-center text-stone-300 mt-2">Format: 10 digit Indian mobile number.</p>
                </form>
            ) : (
                // 2. New User Registration
                <form onSubmit={handleRegisterAndSendOtp} className="space-y-4 animate-in slide-in-from-bottom-4">
                     <div className="p-3 bg-brand-gold/10 text-brand-gold text-xs rounded-xl flex items-center gap-2 border border-brand-gold/20 mb-4">
                        <Info size={16}/> <span>Welcome! Complete your profile to register.</span>
                     </div>
                     
                     <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-stone-400 ml-1">Full Name</label>
                        <div className="relative">
                            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
                            <input 
                            type="text" 
                            value={registrationData.name}
                            onChange={e => setRegistrationData({...registrationData, name: e.target.value})}
                            placeholder="e.g. Rahul Sanghavi"
                            className="w-full bg-stone-50 border border-stone-100 rounded-2xl pl-12 pr-4 py-4 text-brand-dark focus:ring-2 focus:ring-brand-gold/50 outline-none transition-all font-medium"
                            required
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-stone-400 ml-1">Location Pincode</label>
                        <div className="relative">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
                            <input 
                            type="number" 
                            value={registrationData.pincode}
                            onChange={e => setRegistrationData({...registrationData, pincode: e.target.value})}
                            placeholder="e.g. 400050"
                            className="w-full bg-stone-50 border border-stone-100 rounded-2xl pl-12 pr-4 py-4 text-brand-dark focus:ring-2 focus:ring-brand-gold/50 outline-none transition-all font-medium"
                            required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-brand-red/10 text-brand-red text-xs rounded-xl flex items-start gap-2 border border-brand-red/20">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="flex gap-2">
                         <button type="button" onClick={() => { setIsNewUser(false); setRegistrationData({name: '', pincode: ''}); }} className="px-4 py-4 bg-stone-50 text-stone-400 font-bold rounded-2xl">Back</button>
                         <button 
                            type="submit" 
                            disabled={isLoading}
                            className="flex-1 bg-brand-gold text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-brand-gold/90 transition-all shadow-xl shadow-brand-gold/20 disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={20}/> : <ArrowRight size={20}/>}
                            Register & Verify
                        </button>
                    </div>
                </form>
            )}
          </>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
             {!isNewUser && existingUserName && (
                 <div className="text-center -mt-4 mb-4">
                     <span className="text-sm text-stone-400 font-serif italic">Welcome back,</span>
                     <h3 className="font-sans text-xl text-brand-dark font-bold">{existingUserName}</h3>
                 </div>
             )}

            <div className="flex justify-between gap-2">
              {otpValue.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => { otpRefs.current[idx] = el; }}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(idx, e.target.value)}
                  onKeyDown={e => handleKeyDown(idx, e)}
                  className="w-12 h-14 bg-stone-50 border border-stone-100 rounded-xl text-center text-xl font-bold text-brand-dark focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 outline-none transition-all"
                />
              ))}
            </div>

            {error && (
              <div className="p-3 bg-brand-red/10 text-brand-red text-xs rounded-xl flex items-start gap-2 border border-brand-red/20">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {isDemoMode && (
              <div className="p-5 bg-brand-gold/5 border border-brand-gold/20 rounded-2xl shadow-sm animate-in zoom-in-95 duration-500">
                <div className="flex items-center gap-2 text-brand-gold font-bold text-xs uppercase tracking-widest mb-2">
                   <Info size={16} /> Admin Debug Active
                </div>
                <p className="text-[11px] text-stone-500 font-medium leading-relaxed">
                  WhatsApp message failed.
                  <span className="block mt-2 font-bold text-brand-dark bg-white/50 p-2 rounded border border-brand-gold/20">
                    Use Code: {generatedOtp}
                  </span>
                </p>
              </div>
            )}

            <div className="text-center">
              <p className="text-stone-300 text-xs mb-2">Issue receiving the code?</p>
              <button 
                onClick={() => initiateOtp(normalizePhone(phone))}
                disabled={timer > 0 || isLoading}
                className={`text-xs font-bold uppercase tracking-widest ${timer > 0 ? 'text-stone-200' : 'text-brand-gold hover:text-brand-gold/80'}`}
              >
                {timer > 0 ? `Resend in ${timer}s` : 'Resend Access Code'}
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-stone-50 text-center space-y-4">
          <p className="text-[10px] uppercase font-bold tracking-widest text-stone-200">Sanghavi Biometric Standard</p>
          <div className="flex justify-center gap-2 text-stone-300">
            <CheckCircle2 size={16} className="text-brand-gold" />
            <span className="text-[10px] font-medium">Bespoke Authorization Encrypted</span>
          </div>
          <Link to="/staff" className="block text-stone-300 text-[10px] font-bold uppercase tracking-widest hover:text-brand-gold transition">Personnel Portal →</Link>
        </div>
      </div>
      
      {isLoading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-brand-gold mb-4" size={48} />
          <p className="font-serif italic text-lg text-brand-dark animate-pulse">Establishing Secure Session...</p>
        </div>
      )}
    </div>
  );
};

export default CustomerLogin;
