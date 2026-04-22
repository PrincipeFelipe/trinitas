import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import UploadNotifications from './pages/UploadNotifications';
import RepartidorApp from './pages/RepartidorApp';
import ReceiptsHistory from './pages/ReceiptsHistory';
import StreetsManagement from './pages/StreetsManagement';
import DemarcationsManagement from './pages/DemarcationsManagement';
import UsersManagement from './pages/UsersManagement';
import NotificationsList from './pages/NotificationsList';
import './index.css';

const ProtectedRoute = ({ children, adminOnly = false }) => {
    const { user } = React.useContext(AuthContext);
    if (!user) return <Navigate to="/login" replace />;
    if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/" replace />;
    return children;
};

// ...
function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route 
                        path="/" 
                        element={
                            <ProtectedRoute adminOnly={true}>
                                <AdminDashboard />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/upload" 
                        element={
                            <ProtectedRoute adminOnly={true}>
                                <UploadNotifications />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/notifications" 
                        element={
                            <ProtectedRoute adminOnly={true}>
                                <NotificationsList />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/receipts" 
                        element={
                            <ProtectedRoute adminOnly={true}>
                                <ReceiptsHistory />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/streets" 
                        element={
                            <ProtectedRoute adminOnly={true}>
                                <StreetsManagement />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/demarcations" 
                        element={
                            <ProtectedRoute adminOnly={true}>
                                <DemarcationsManagement />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/users" 
                        element={
                            <ProtectedRoute adminOnly={true}>
                                <UsersManagement />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/repartidor"  
                        element={
                            <ProtectedRoute>
                                <RepartidorApp />
                            </ProtectedRoute>
                        } 
                    />
                </Routes>
            </Router>
        </AuthProvider>
    );
}

export default App;
