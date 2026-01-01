
import React from 'react';
import ReactDOM from 'react-dom/client';
import { AdminDashboard } from '../pages/AdminDashboard';
import { Navigation } from '../components/Navigation';
import { storeService } from '../services/storeService';
import { UploadProvider } from '../contexts/UploadContext';

const App = () => {
    const [user, setUser] = React.useState(storeService.getCurrentUser());
    if (!user || (user.role !== 'admin' && user.role !== 'contributor')) {
        window.location.href = './staff.html';
        return null;
    }

    return (
        <UploadProvider>
            <div className="bg-slate-950 text-slate-100 min-h-screen">
                <main className="pb-24">
                    <AdminDashboard onNavigate={(tab) => {
                        if (tab === 'settings') window.location.href = '/admin/settings';
                    }} />
                </main>
                <Navigation user={user} onLogout={() => storeService.logout()} />
            </div>
        </UploadProvider>
    );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
