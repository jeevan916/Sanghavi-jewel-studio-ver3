import React, { useEffect, useState, useRef } from 'react';
import { storeService } from '@/services/storeService.ts';

export const SecurityBlackout: React.FC<{ user: any }> = ({ user }) => {
    const [isBlackout, setIsBlackout] = useState(false);
    const passwordRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!user || !['admin', 'contributor', 'staff'].includes(user.role)) return;

        const logCapture = async (action: string) => {
            storeService.logEvent('screenshot', undefined, user, { 
                meta: { method: action, url: window.location.href }
            });
        };

        const handleBlur = () => {
            setIsBlackout(true);
        };
        const handleFocus = () => setIsBlackout(false);
        const handleVisibilityChange = () => {
            setIsBlackout(document.hidden);
        };
        
        const handleKeyDown = (e: KeyboardEvent) => {
            // Block PrintScreen key
            if (e.key === 'PrintScreen') {
                logCapture('print_screen_key');
                triggerBlackout();
            }
            // Block Mac/Windows screen snip shortcuts (Cmd/Ctrl + Shift + 3,4,5,S)
            if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
                if (['3', '4', '5', 's', 'S'].includes(e.key)) {
                    logCapture('shortcut_key_' + e.key);
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

        // Add print media styles to hide content when printing and block long-press saves
        const style = document.createElement('style');
        style.innerHTML = `
            @media print {
                body {
                    display: none !important;
                }
            }
            body {
                -webkit-touch-callout: none !important;
                -webkit-user-select: none !important;
                user-select: none !important;
            }
            img {
                -webkit-user-drag: none !important;
                pointer-events: none !important;
            }
        `;
        document.head.appendChild(style);

        // Block right click
        const handleContextMenu = (e: MouseEvent) => {
            logCapture('context_menu_right_click');
            e.preventDefault();
        };
        document.addEventListener('contextmenu', handleContextMenu);

        // Keep password field focused to trigger OS-level screen capture blocking
        const maintainFocus = () => {
            const active = document.activeElement;
            // Don't steal focus if user is typing in a real input
            if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) && active !== passwordRef.current) {
                return;
            }
            if (passwordRef.current) {
                passwordRef.current.focus({ preventScroll: true });
            }
        };

        const focusInterval = setInterval(maintainFocus, 500);
        window.addEventListener('touchstart', maintainFocus);
        window.addEventListener('click', maintainFocus);

        maintainFocus();

        return () => {
            clearInterval(focusInterval);
            window.removeEventListener('touchstart', maintainFocus);
            window.removeEventListener('click', maintainFocus);
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('contextmenu', handleContextMenu);
            document.head.removeChild(style);
        };
    }, [user]);

    // Render a hidden password field to trigger Android's native FLAG_SECURE screenshot blocking
    return (
        <>
            <input 
                ref={passwordRef}
                type="password" 
                aria-hidden="true" 
                tabIndex={-1} 
                autoComplete="off"
                inputMode="none"
                style={{ 
                    position: 'fixed', 
                    top: 0, 
                    left: 0, 
                    opacity: 0.01, 
                    pointerEvents: 'none', 
                    zIndex: -1,
                    width: '1px',
                    height: '1px',
                    border: 'none',
                    background: 'transparent',
                    color: 'transparent'
                }} 
                defaultValue="secure"
            />
            {isBlackout && (
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
            )}
        </>
    );
};
