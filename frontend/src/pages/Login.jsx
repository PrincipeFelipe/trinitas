import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const loggedUser = await login(username, password);
            navigate(loggedUser.role === 'ADMIN' ? '/' : '/repartidor');
        } catch (err) {
            setError('Credenciales inválidas');
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <div className="logo-placeholder"></div>
                    <h2>TRINITAS <br /> <span>SERVICIOS INTEGRALES</span></h2>
                </div>
                <form onSubmit={handleSubmit} className="login-form">
                    {error && <div className="error-message">{error}</div>}
                    <div className="input-group">
                        <label>Usuario</label>
                        <input 
                            type="text" 
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)} 
                            required 
                        />
                    </div>
                    <div className="input-group">
                        <label>Contraseña</label>
                        <input 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                        />
                    </div>
                    <button type="submit" className="btn-primary">Login</button>
                    <a href="#" className="forgot-link">¿Contraseña olvidada?</a>
                </form>
            </div>
        </div>
    );
}
