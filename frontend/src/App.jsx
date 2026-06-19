import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import React, { Suspense, lazy } from 'react';
import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import Home from './components/Home';
import Login from './components/Login';
import Register from './components/Register';
import DocumentList from './components/DocumentList';
const Document = lazy(() => import('./components/Document'));
import PrivateRoute from './components/PrivateRoute';
import CommandPalette from './components/CommandPalette';

import { ThemeProvider } from './components/ThemeContext';

function App() {
  return (
    <GlobalErrorBoundary>
      <ThemeProvider>
        <Router>
          <CommandPalette />
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#fff',
                color: '#334155',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                borderRadius: '0.75rem',
                border: '1px solid #e2e8f0',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
          <AppRoutes />
        </Router>
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <h1 className="text-4xl font-bold text-gray-800 mb-4">404 - Page Not Found</h1>
      <p className="text-gray-600 mb-8 text-center">The page you are looking for does not exist.</p>
      <a href="/" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Go Home</a>
    </div>
  );
}

function AppRoutes() {
  const navigate = useNavigate();

  const handleDocumentSelect = (doc) => {
    navigate(`/documents/${doc.id}`, { state: { doc } });
  };

  const handleCreateDocument = (doc) => {
    navigate(`/documents/${doc.id}`, { state: { doc } });
  };

  const handleSaveDocument = (content) => {
    console.log('Saving document:', content);
  };

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/documents"
        element={
          <PrivateRoute>
            <DocumentList
              onDocumentSelect={handleDocumentSelect}
              onCreateDocument={handleCreateDocument}
            />
          </PrivateRoute>
        }
      />
      <Route
        path="/documents/:id"
        element={
          <PrivateRoute>
            <Suspense fallback={<div>Loading document...</div>}>
              <Document onSave={handleSaveDocument} />
            </Suspense>
          </PrivateRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;


