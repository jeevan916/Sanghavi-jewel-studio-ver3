import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { storeService } from '@/services/storeService.ts';

export const SecurityBlackout: React.FC<{ user: any }> = ({ user }) => {
    const [isBlackout, setIsBlackout] = useState(false);
    const passwordRef = useRef<HTMLInputElement>(null);

    useLayoutEffect(() => {
        // Focus password field instantly before initial paint
        if (passwordRef.current) {
            try {
                passwordRef.current.focus({ preventScroll: true });
            } catch (e) {
                // Ignore focus errors on initial render
            }
        }
    }, []);

    useEffect(() => {
        const logCapture = async (action: string) => {
            if (user && storeService) {
                storeService.logEvent('screenshot', undefined, user, { 
                    meta: { method: action, url: window.location.href }
                });
            }
        };

        const handleBlur = () => {
            setIsBlackout(true);
        };
        const handleFocus = () => {
            setIsBlackout(false);
            maintainFocus();
        };
        const handleVisibilityChange = () => {
            const hidden = document.hidden;
            setIsBlackout(hidden);
            if (!hidden) {
                maintainFocus();
            }
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
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText('');
                }
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
        style.setAttribute('id', 'security-blackout-style');
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
            img, canvas, video {
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
            // Don't steal focus if user is typing in a real input/textarea/select
            if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) && active !== passwordRef.current) {
                return;
            }
            if (passwordRef.current) {
                try {
                    passwordRef.current.focus({ preventScroll: true });
                } catch (e) {
                    // Ignore focus errors
                }
            }
        };

        // Trigger focus immediately and staged over early load timeline
        maintainFocus();
        requestAnimationFrame(maintainFocus);
        [0, 10, 50, 100, 200, 500, 1000, 2000].forEach(delay => {
            setTimeout(maintainFocus, delay);
        });

        // Aggressively capture any gesture to lock password focus on mobile Chrome
        const gestureEvents = ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'click', 'scroll', 'focusin', 'pageshow', 'DOMContentLoaded', 'load'];
        const handleGesture = () => {
            maintainFocus();
        };

        gestureEvents.forEach(evt => {
            window.addEventListener(evt, handleGesture, { capture: true, passive: true });
        });

        const focusInterval = setInterval(maintainFocus, 250);

        return () => {
            clearInterval(focusInterval);
            gestureEvents.forEach(evt => {
                window.removeEventListener(evt, handleGesture, { capture: true });
            });
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('contextmenu', handleContextMenu);
            const existingStyle = document.getElementById('security-blackout-style');
            if (existingStyle && existingStyle.parentNode) {
                existingStyle.parentNode.removeChild(existingStyle);
            }
        };
    }, [user]);

    // Render a full-viewport transparent password field to trigger Android's native FLAG_SECURE screenshot blocking instantly on cold load
    return (
        <>
            <input 
                ref={passwordRef}
                type="password" 
                aria-hidden="true" 
                tabIndex={-1} 
                autoComplete="current-password"
                inputMode="none"
                autoFocus={true}
                onBlur={(e) => {
                    const target = e.currentTarget;
                    setTimeout(() => {
                        try {
                            target.focus({ preventScroll: true });
                        } catch (err) {}
                    }, 0);
                }}
                style={{ 
                    position: 'fixed', 
                    top: 0, 
                    left: 0, 
                    width: '100vw',
                    height: '100vh',
                    opacity: 0.0001, 
                    zIndex: 1,
                    pointerEvents: 'none',
                    border: 'none',
                    margin: 0,
                    padding: 0,
                    background: 'transparent',
                    color: 'transparent',
                    fontSize: '1px'
                }} 
                defaultValue="••••••••"
            />
            {/* Dynamic Security Watermark Overlay */}
            <div 
                aria-hidden="true"
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    pointerEvents: 'none',
                    zIndex: 99999,
                    overflow: 'hidden',
                    opacity: 0.035,
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-around',
                    alignContent: 'space-around',
                    userSelect: 'none',
                    transform: 'rotate(-25deg) scale(1.4)'
                }}
            >
                {Array.from({ length: 24 }).map((_, i) => (
                    <div 
                        key={i} 
                        style={{ 
                            fontSize: '13px', 
                            fontWeight: 700, 
                            letterSpacing: '2px', 
                            color: '#000',
                            padding: '30px 20px',
                            whiteSpace: 'nowrap',
                            fontFamily: 'serif'
                        }}
                    >
                        SANGHAVI JEWEL STUDIO • SECURE DESIGN
                    </div>
                ))}
            </div>

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
