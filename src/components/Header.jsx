import React from 'react';

const Header = ({ dbStatus, onFileUpload, onNewTopic, onNewCentralTopic }) => {
  return (
    <nav className="fixed top-0 left-0 right-0 bg-gray-800 text-white py-2 px-4 z-50">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-3">
          <h1 className="text-xl font-bold">Workspace App</h1>
          <div className="flex items-center gap-2">
            <span className="text-gray-300">DB Status:</span>
            <span className={`px-2 py-1 rounded text-sm ${
              dbStatus === 'connected' ? 'bg-green-500' :
              dbStatus === 'error' ? 'bg-red-500' :
              'bg-yellow-500'
            }`}>
              {dbStatus}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <label className="bg-blue-500 hover:bg-blue-600 px-3 py-1.5 rounded cursor-pointer transition-colors">
            <span>Select PDF</span>
            <input
              type="file"
              accept=".pdf"
              onChange={onFileUpload}
              className="hidden"
            />
          </label>
          <button
            onClick={onNewTopic}
            className="bg-green-600 px-3 py-1.5 rounded hover:bg-green-700 transition-colors"
          >
            New Topic
          </button>
          <button
            onClick={onNewCentralTopic}
            className="bg-orange-500 px-3 py-1.5 rounded hover:bg-orange-600 transition-colors"
          >
            New Central Topic
          </button>
          <button
            className="px-4 py-1.5 bg-pink-500 hover:bg-pink-400 text-white font-bold rounded-lg
                       transform transition-all duration-300 ease-in-out hover:-translate-y-0.5
                       border border-pink-400 hover:border-pink-300 hover:shadow-lg"
            onClick={() => alert('Menu clicked!')}
          >
            Menu ▾
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Header;