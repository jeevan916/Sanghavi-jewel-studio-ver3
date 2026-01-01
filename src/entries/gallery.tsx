
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Gallery } from '../pages/Gallery';
import { Navigation } from '../components/Navigation';
import { storeService } from '../services/storeService';

const App = () => {
    const [user, setUser] = React.useState(storeService.getCurrentUser());
    const handleLogout = () => { storeService.logout(); setUser(null); };

    return (
        <div className="bg-stone-50 min-h-screen">
            <main className="pb-24">
                <Gallery />
            </main>
            <Navigation user={user} onLogout={handleLogout} />
        </div>
    );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
