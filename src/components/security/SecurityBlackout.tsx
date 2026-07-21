import React, { useEffect, useState } from 'react';

export const SecurityBlackout: React.FC<{ user: any }> = ({ user }) => {
    const [isBlackout, setIsBlackout] = useState(false);

    useEffect(() => {
        if (!user || !['admin', 'contributor', 'staff'].includes(user.role)) return;

        const handleBlur = () => setIsBlackout(true);
        const handleFocus = () => setIsBlackout(false);
        const handleVisibilityChange = () => setIsBlackout(document.hidden);
        
        const handleKeyDown = (e: KeyboardEvent) => {
            // Block PrintScreen key
            if (e.key === 'PrintScreen') {
                triggerBlackout();
            }
            // Block Mac/Windows screen snip shortcuts (Cmd/Ctrl + Shift + 3,4,5,S)
            if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
                if (['3', '4', '5', 's', 'S'].includes(e.key)) {
                    triggerBlackout();
                }
            }
        };
        
        const triggerBlackout = () => {
            setIsBlackout(true);
            try {
                navigator.clipboard.writeText('');
            } catch (e) {
                // Ignore clipboard errors
            }
            setTimeout(() => {
                if (document.hasFocus()) {
                    setIsBlackout(false);
                }
            }, 3000);
        };

        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('keydown', handleKeyDown);

        // Add print media styles to hide content when printing
        const style = document.createElement('style');
        style.innerHTML = `
            @media print {
                body {
                    display: none !important;
                }
            }
        `;
        document.head.appendChild(style);

        return () => {
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('keydown', handleKeyDown);
            document.head.removeChild(style);
        };
    }, [user]);

    if (!isBlackout) return null;

    return (
        <div 
            style={{ 
                position: 'fixed', 
                top: 0, left: 0, right: 0, bottom: 0, 
                backgroundColor: '#000', 
                zIndex: 99999999, 
                display: 'flex', 
                flexDirection: 'column',
                justifyContent: 'center', 
                alignItems: 'center',
                color: '#fff',
                fontFamily: 'sans-serif'
            }}
            aria-hidden="true"
        >
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔒</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>Security Policy</div>
            <div style={{ fontSize: '16px', marginTop: '10px', color: '#ccc' }}>Screenshots and screen sharing are disabled.</div>
        </div>
    );
};
