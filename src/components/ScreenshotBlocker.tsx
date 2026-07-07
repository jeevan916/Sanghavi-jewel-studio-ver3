import React from 'react';

export const ScreenshotBlocker: React.FC = () => {
    return (
        <input 
            type="password" 
            value="screenshot-protection"
            readOnly
            aria-hidden="true"
            tabIndex={-1}
            className="fixed inset-0 w-full h-full z-[9999] pointer-events-none opacity-[0.001]" 
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
        />
    );
};
