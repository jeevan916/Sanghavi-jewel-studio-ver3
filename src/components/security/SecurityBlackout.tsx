import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { storeService } from '@/services/storeService.ts';

export const SecurityBlackout: React.FC<{ user: any }> = ({ user }) => {
    const [isBlackout, setIsBlackout] = useState(false);
    const [isBooting, setIsBooting] = useState(true);
    const passwordRef = useRef<HTMLInputElement>(null);
    const location = useLocation();

    // Show blackout overlay for 2 seconds on initial app startup / page reload
    useEffect(() => {
        const bootTimer = setTimeout(() => {
            setIsBooting(false);
            maintainFocus();
        }, 2000);

        return () => clearTimeout(bootTimer);
    }, []);

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

    useLayoutEffect(() => {
        // Focus password field instantly before initial paint on mount
        maintainFocus();
    }, []);

    // Re-trigger security focus cycle on every route navigation or URL change
    useEffect(() => {
        maintainFocus();
        requestAnimationFrame(maintainFocus);
        [0, 50, 150, 300, 600, 1000, 2000].forEach(delay => {
            setTimeout(maintainFocus, delay);
        });
    }, [location.pathname, location.search]);

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

        // Trigger focus immediately and staged over early load timeline
        maintainFocus();
        requestAnimationFrame(maintainFocus);
        [0, 10, 50, 100, 200, 500, 1000, 2000].forEach(delay => {
            setTimeout(maintainFocus, delay);
        });

        // Aggressively capture any gesture to lock password focus on mobile Chrome across all user interactions
        const gestureEvents = ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'click', 'scroll', 'focusin', 'pageshow', 'popstate', 'DOMContentLoaded', 'load'];
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

    // Render hidden input for OS password field detection + security blackout overlay on blur/visibilitychange
    return (
        <>
            <input 
                ref={passwordRef}
                type="password" 
                aria-hidden="true" 
                tabIndex={-1} 
                autoComplete="current-password"
                inputMode="none"
                style={{ 
                    position: 'fixed', 
                    top: 0, 
                    left: 0, 
                    width: '1px',
                    height: '1px',
                    opacity: 0.001, 
                    zIndex: -1,
                    pointerEvents: 'none',
                    border: 'none',
                    margin: 0,
                    padding: 0,
                    background: 'transparent',
                    color: 'transparent'
                }} 
                defaultValue="••••••••"
            />
            {(isBlackout || isBooting) && (
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
