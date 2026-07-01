import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import Splash from './components/Splash';
import Today from './pages/Today';
import Log from './pages/Log';
import Progress from './pages/Progress';
import Coach from './pages/Coach';

const BOOT_SPLASH_MS = 2000;

export default function App() {
  // Guaranteed brand splash on every launch / restart / first login —
  // held for a minimum 2s so it's actually seen, even when data is cached.
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setBooting(false), BOOT_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  if (booting) return <Splash />;

  return (
    <BrowserRouter>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '72px' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<Today />} />
          <Route path="/log" element={<Log />} />
          <Route path="/progress" element={<Progress />} />
          {/* legacy routes — merged into Progress */}
          <Route path="/goals" element={<Navigate to="/progress" replace />} />
          <Route path="/analytics" element={<Navigate to="/progress" replace />} />
          <Route path="/coach" element={<Coach />} />
        </Routes>
      </div>
      <BottomNav />
    </BrowserRouter>
  );
}
