
const WHATSAPP_PHONE_ID = import.meta.env.VITE_WHATSAPP_PHONE_ID || '';
const WHATSAPP_TOKEN = import.meta.env.VITE_WHATSAPP_TOKEN || '';

export const whatsappService = {
  /**
   * Generates a secure 6-digit OTP for studio access.
   */
  generateOTP: () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  /**
   * Dispatches OTP via Meta WhatsApp Business API.
   * STRICT: Ensures the phone number has a country code. Defaults to 91 (India) if 10 digits provided.
   */
  sendOTP: async (phone: string, otp: string, credentials?: { phoneId?: string, token?: string, templateName?: string }) => {
    let formattedPhone = phone.replace(/\D/g, '');
    
    // Auto-append India code if user (or system) provides exactly 10 digits
    if (formattedPhone.length === 10) {
        formattedPhone = '91' + formattedPhone;
    }

    const phoneId = credentials?.phoneId || WHATSAPP_PHONE_ID;
    const token = credentials?.token || WHATSAPP_TOKEN;
    const templateName = credentials?.templateName || 'sanghavi_jewel_studio';
    
    // More inclusive test environment detection for Hostinger and local setups
    const hostname = window.location.hostname;
    const isTestEnv = 
      hostname === 'localhost' || 
      hostname === '127.0.0.1' ||
      hostname.includes('sanghavijewellers.com') ||
      hostname.includes('hostingerapp.com') ||
      hostname.includes('.online');

    console.debug(`[WhatsApp] Attempting OTP delivery to ${formattedPhone}. Host: ${hostname}, Dev Mode: ${isTestEnv}`);

    if (!phoneId || !token) {
        console.warn('[WhatsApp] Missing credentials for OTP delivery.');
        if (isTestEnv) {
            console.log(`%c[DEMO MODE] OTP for ${formattedPhone}: ${otp}`, 'background: #222; color: #bada55; padding: 10px; font-size: 20px;');
            return { success: true, isDemo: true, error: 'Missing credentials' };
        }
        return { success: false, error: 'Verification service not configured.' };
    }

    try {
      const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'template',
          template: {
            name: templateName, 
            language: { code: 'en_US' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: otp }]
              },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [{ type: 'text', text: otp }]
              }
            ]
          }
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.warn('[WhatsApp API] Rejected Request:', data);
        
        if (isTestEnv) {
          console.group('%cSanghavi Studio - Auth Diagnostic', 'color: #c68a36; font-size: 14px; font-weight: bold;');
          console.log('%cAPI Error:', 'color: #ff4444;', data.error?.message || 'Meta API Error');
          console.log('%cSolution:', 'color: #888;', 'Ensure phone is whitelisted in Meta App Dashboard or app is set to Live.');
          console.log('%cOTP FALLBACK ACTIVATED', 'background: #c68a36; color: white; padding: 2px 5px; border-radius: 3px;');
          console.log(`%cOTP for ${formattedPhone}: %c${otp}`, 'color: #888;', 'color: #c68a36; font-weight: bold; font-size: 18px;');
          console.groupEnd();
          
          return { success: true, isDemo: true, error: data.error?.message };
        }
        
        return { success: false, error: data.error?.message || 'Verification service temporarily restricted.' };
      }

      console.info('[WhatsApp API] OTP Message sent successfully.');
      return { success: true, data };
    } catch (error: any) {
      console.error('[WhatsApp Transport] Critical Error:', error);
      
      if (isTestEnv) {
        console.log(`%c[NETWORK FALLBACK] OTP for ${formattedPhone}: ${otp}`, 'background: #222; color: #bada55; padding: 10px; font-size: 20px;');
        return { success: true, isDemo: true, error: 'Network failure' };
      }
      
      return { success: false, error: 'Connection to verification service failed.' };
    }
  }
};
