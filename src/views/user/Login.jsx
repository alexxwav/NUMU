import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { resolveStartRoute, ROUTES } from '../../services/startRoute.js';
import logo from '../../assets/brand/mascot/logo-mascota-morado.png';
import imagenregistro from '../../assets/brand/numu-registro.jpg';

const INPUT_CLASS = 'w-full bg-gray-50 border-2 border-gray-200 rounded-btn px-5 py-3.5 text-sm text-text-dark font-medium focus:outline-none focus:border-numu-purple focus:bg-white transition-colors';

export default function Login() {
  const navigate = useNavigate();
  const { signIn, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError('');
    const { session, profile, error: loginError } = await signIn({ email, password });
    setSending(false);
    if (loginError) {
      setError(loginError === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : loginError);
      return;
    }
    // Si ya hizo el cuestionario inicial va directo al inicio; si no, lo termina primero.
    navigate(resolveStartRoute({ session, profile }), { replace: true });
  };

  return (
    <div className="min-h-screen w-full flex font-poppins bg-soft-lavender">

      <div className="hidden md:block md:w-1/2 relative z-10 shadow-2xl">
        <img
          src={imagenregistro}
          alt="Mascota Numu"
          className="w-full h-full object-cover absolute inset-0"
        />
      </div>

      {/* Formulario */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-6 md:p-12">
        <div className="bg-white w-full max-w-md p-8 md:p-10 rounded-card shadow-lg border-2 border-gray-100 flex flex-col items-center">

          <img src={logo} alt="Logo Numu" className="w-20 h-20 object-contain mb-6" />

          <h2 className="text-3xl font-fredoka font-extrabold text-numu-deep-indigo tracking-tight mb-8">
            Iniciar sesión
          </h2>

          <form onSubmit={handleLogin} className="w-full space-y-5">

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT_CLASS}
              placeholder="correo electrónico"
              autoComplete="email"
              required
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT_CLASS}
              placeholder="contraseña"
              autoComplete="current-password"
              required
            />

            {!configured && (
              <p role="alert" className="text-sm font-medium text-coral-alert">
                Falta configurar Supabase (.env.local) para iniciar sesión.
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm font-medium text-coral-alert">{error}</p>
            )}

            <div className="pt-4 flex items-center justify-between gap-4">
              <Link to={ROUTES.signUp} className="text-sm font-semibold text-numu-purple hover:underline">
                ¿No tienes cuenta? Crear cuenta
              </Link>
              <button
                type="submit"
                disabled={sending || !configured}
                className="bg-sunshine-yellow text-text-dark font-fredoka font-bold text-lg py-2.5 px-8 rounded-btn shadow-3d-yellow hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-60 disabled:pointer-events-none">
                {sending ? 'entrando…' : 'entrar >'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
