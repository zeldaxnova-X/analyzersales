import React, { useState } from 'react';
import UploadPhase from './components/UploadPhase';
import Dashboard from './components/Dashboard';

function App() {
  const [sessionData, setSessionData] = useState(null);

  const handleUploadComplete = (data) => {
    // data contains: session_id, filters, validation_warnings
    setSessionData({
      sessionId: data.session_id,
      availableFilters: data.filters,
      warnings: data.validation_warnings
    });
  };

  const handleReset = () => {
    setSessionData(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight">Sales Data Analyzer</h1>
          </div>
          {sessionData && (
            <button 
              onClick={handleReset}
              className="text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              Start Over
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!sessionData ? (
          <UploadPhase onUploadComplete={handleUploadComplete} />
        ) : (
          <Dashboard 
            sessionId={sessionData.sessionId} 
            availableFilters={sessionData.availableFilters} 
            warnings={sessionData.warnings}
          />
        )}
      </main>
    </div>
  );
}

export default App;
