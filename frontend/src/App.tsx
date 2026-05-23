import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { ChatWindow } from './components/chat/ChatWindow'
import { DatabasePage } from './pages/DatabasePage'
import { SheetsPage } from './pages/SheetsPage'
import ResearchPage from './pages/ResearchPage'
import TicTacToePage from './pages/TicTacToePage'
import { SupportTicketPage } from './pages/SupportTicketPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import './index.css'

function App() {
  return (
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <ChatWindow />
                </ProtectedRoute>
              }
            />
            <Route
              path="/database"
              element={
                <ProtectedRoute>
                  <DatabasePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sheets"
              element={
                <ProtectedRoute>
                  <SheetsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/research"
              element={
                <ProtectedRoute>
                  <ResearchPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/game"
              element={
                <ProtectedRoute>
                  <TicTacToePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tickets"
              element={
                <ProtectedRoute>
                  <SupportTicketPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  )
}

export default App
