import { Routes, Route, Navigate } from "react-router-dom";

import Register from './views/user/Register';
import Home from './views/user/Home';
import Splash from './views/Splash';
import LoginView from './views/LoginView';
import Game from './views/Game';
import ShopView from './views/ShopView';
import Achievements from './views/Achievements';
import SettingsView from './views/SettingsView';

export default function App() {
    return (
        <Routes>
            {/* Redirección inicial */}
            <Route path="/" element={<Navigate to="/bienvenida" />} />
            
            {/* Rutas de Bienvenida y Autenticación */}
            <Route path="/bienvenida" element={<Splash />} />
            <Route path="/iniciar-sesion" element={<LoginView />} />
            <Route path="/crear-cuenta" element={<Register />} />
            
            {/* Rutas Principales (Gamificación) */}
            <Route path="/inicio" element={<Home />} />
            
            <Route path="/jugar/:nivel" element={<Game />} /> 
            <Route path="/jugar" element={<Game />} /> 
            
            <Route path="/tienda" element={<ShopView />} />
            <Route path="/trofeos" element={<Achievements />} />
            <Route path="/ajustes" element={<SettingsView />} />
        </Routes>
    )
}