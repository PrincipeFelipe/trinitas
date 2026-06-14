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
import NotificationsReport from './pages/NotificationsReport';
import './index.css';

const ProtectedRoute = ({ children, requiredPermission = null }) => {
    const { user } = React.useContext(AuthContext);
    if (!user) return <Navigate to="/login" replace />;

    // Empleados (couriers) are only allowed to see /repartidor
    if (user.role === 'EMPLEADO' || user.role === 'REPARTIDOR') {
        if (requiredPermission) {
            return <Navigate to="/repartidor" replace />;
        }
        return children;
    }

    // Gerentes and Admins can access the dashboard.
    // Other pages check for their specific permission.
    if (requiredPermission) {
        if (user.role === 'ADMINISTRADOR' || user.role === 'ADMIN') {
            return children;
        }
        if (requiredPermission === 'dashboard' && user.role === 'GERENTE') {
            return children;
        }
        if (user.permissions && user.permissions.includes(requiredPermission)) {
            return children;
        }
        return <Navigate to="/" replace />;
    }

    return children;
};

function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route 
                        path="/" 
                        element={
                            <ProtectedRoute requiredPermission="dashboard">
                                <AdminDashboard />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/upload" 
                        element={
                            <ProtectedRoute requiredPermission="upload">
                                <UploadNotifications />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/notifications" 
                        element={
                            <ProtectedRoute requiredPermission="notifications">
                                <NotificationsList />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/receipts" 
                        element={
                            <ProtectedRoute requiredPermission="receipts">
                                <ReceiptsHistory />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/streets" 
                        element={
                            <ProtectedRoute requiredPermission="streets">
                                <StreetsManagement />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/demarcations" 
                        element={
                            <ProtectedRoute requiredPermission="demarcations">
                                <DemarcationsManagement />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/users" 
                        element={
                            <ProtectedRoute requiredPermission="users">
                                <UsersManagement />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/reports" 
                        element={
                            <ProtectedRoute requiredPermission="reports">
                                <NotificationsReport />
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
