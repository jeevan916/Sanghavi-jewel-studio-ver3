
import React from 'react';
import ReactDOM from 'react-dom/client';
import { DesignStudio } from '../pages/DesignStudio';
import { Navigation } from '../components/Navigation';
import { storeService } from '../services/storeService';

const App = () => {
    const [user, setUser] = React.useState(storeService.getCurrentUser());
    if (!user || user.role === 'customer') {
        window.location.href = './login.html';
        return null;
    }

    return (
        <div className="bg-stone-50 min-h-screen">
            <main className="pb-24 pt-16">
                <DesignStudio />
            </main>
            <Navigation user={user} onLogout={() => storeService.logout()} />
        </div>
    );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
