import { Routes, Route, Navigate } from "react-router-dom";

import Register from './views/user/Register';
import Login from './views/user/Login';
import Home from './views/user/Home';
import Splash from './views/Splash';
import LoginView from './views/LoginView';
import Game from './views/Game';
import ShopView from './views/ShopView';
import Achievements from './views/Achievements';
import SettingsView from './views/SettingsView';
import CoursesView from './views/CoursesView';
import CourseView from './views/CourseView';
import LessonView from './views/LessonView';
import { useAuth } from './hooks/useAuth.jsx';
import { ROUTES } from './services/startRoute.js';

// Protege las pantallas que necesitan cuenta.
// onboarding = true: solo para quien aún no hace el cuestionario inicial; el resto lo exige terminado.
function RequireAccount({ children, onboarding = false }) {
    const { configured, session, profile, loading } = useAuth();
    if (!configured) return children; // sin Supabase configurado, la app sigue funcionando en local
    if (loading) {
        return <main className="min-h-screen bg-numu-purple grid place-items-center font-fredoka text-2xl text-white">Cargando…</main>;
    }
    if (!session) return <Navigate to={ROUTES.signIn} replace />;
    const done = Boolean(profile?.onboarding_completed);
    if (onboarding && done) return <Navigate to={ROUTES.home} replace />;
    if (!onboarding && !done) return <Navigate to={ROUTES.onboarding} replace />;
    return children;
}

export default function App() {
    return (
        <Routes>
            {/* Redirección inicial */}
            <Route path="/" element={<Navigate to={ROUTES.welcome} />} />

            {/* Rutas de Bienvenida y Autenticación */}
            <Route path={ROUTES.welcome} element={<Splash />} />
            <Route path={ROUTES.signIn} element={<Login />} />
            <Route path={ROUTES.signUp} element={<Register />} />

            {/* Cuestionario inicial (cold start): solo una vez, después del registro */}
            <Route path={ROUTES.onboarding} element={<RequireAccount onboarding><LoginView /></RequireAccount>} />

            {/* Rutas Principales (Gamificación) */}
            <Route path={ROUTES.home} element={<RequireAccount><Home /></RequireAccount>} />

            {/* Cursos y lecciones */}
            <Route path="/cursos" element={<RequireAccount><CoursesView /></RequireAccount>} />
            <Route path="/cursos/:courseId" element={<RequireAccount><CourseView /></RequireAccount>} />
            <Route path="/lecciones/:lessonId" element={<RequireAccount><LessonView /></RequireAccount>} />
            <Route path="/lecciones/:lessonId/jugar" element={<RequireAccount><Game /></RequireAccount>} />

            <Route path="/jugar/:nivel" element={<RequireAccount><Game /></RequireAccount>} />
            <Route path="/jugar" element={<RequireAccount><Game /></RequireAccount>} />

            <Route path="/tienda" element={<RequireAccount><ShopView /></RequireAccount>} />
            <Route path="/trofeos" element={<RequireAccount><Achievements /></RequireAccount>} />
            <Route path="/ajustes" element={<SettingsView />} />
        </Routes>
    )
}
