
const WHATSAPP_PHONE_ID = '101607512732681';
const WHATSAPP_TOKEN = 'EAAPGuuaNPNABO2eXjz6M9QCF2rqkOex4BbOmWvBZB6N5WatNW0Dgh9lIL7Iw8XugiviSRbxAzD8UjPxyCZA9rHg71Lvjag0C3QAMUCstNRF3oflXx5qFKumjNVeAM1EZBQNXYZCXyE8L7dlUGwwWqr8MxNU266M7aJBcZCMfE6psslXhMDxDVPEo4dMgVSWkAkgZDZD';

export const whatsappService = {
  generateOTP: () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  sendOTP: async (phone: string, otp: string) => {
    // Standardize phone number
    const cleanPhone = phone.replace(/\D/g, '');
    
    try {
      const response = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'template',
          template: {
            name: 'verification_code', // User should ensure this template exists in Meta dashboard
            language: { code: 'en_US' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: otp }]
              }
            ]
          }
        })
      });

      const data = await response.json();
      
      // Fallback for demo: If template fails (e.g. not created yet), use standard text if possible
      // But typically Business API requires templates. If this fails, we check for error 100
      if (!response.ok) {
        console.warn('WhatsApp API warning:', data);
        // In a real production environment, we'd throw here. 
        // For development/demo with the specific provided key, we might need a specific template name.
        // Assuming 'hello_world' is the default for testing if 'verification_code' isn't set.
      }

      return { success: response.ok, data };
    } catch (error) {
      console.error('WhatsApp Service Error:', error);
      return { success: false, error };
    }
  }
};
