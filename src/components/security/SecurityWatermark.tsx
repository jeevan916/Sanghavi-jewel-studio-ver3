import React, { useEffect, useState } from 'react';

export const SecurityWatermark: React.FC<{ user: any }> = ({ user }) => {
    const [traceId, setTraceId] = useState<string | null>(null);

    useEffect(() => {
        if (!user || !['admin', 'contributor', 'staff'].includes(user.role)) return;

        let active = true;
        const fetchTrace = async () => {
            try {
                const response = await fetch('/api/security/trace', {
                    headers: {
                        'Authorization': `Bearer ${user.token}`,
                        'x-auth-token': user.token
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    if (active) setTraceId(data.traceId);
                }
            } catch (e) {
                console.error('Failed to fetch security trace');
            }
        };

        fetchTrace();
        return () => { active = false; };
    }, [user]);

    if (!traceId) return null;

    // Create a repeating pattern of the watermark
    const watermarks = Array.from({ length: 40 }).map((_, i) => (
        <div key={i} className="whitespace-nowrap transform -rotate-45 p-8 font-mono text-sm" style={{ color: 'currentColor' }}>
            SJ • {traceId} • {new Date().toISOString().split('T')[0]}
        </div>
    ));

    return (
        <div 
            style={{ 
                position: 'fixed', 
                top: '-50%', left: '-50%', right: '-50%', bottom: '-50%', 
                zIndex: 9999, 
                pointerEvents: 'none', 
                opacity: 0.04,
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden'
            }}
            aria-hidden="true"
        >
            {watermarks}
        </div>
    );
};
