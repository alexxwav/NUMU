import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { ROUTES } from '../../services/startRoute.js';
import logo from '../../assets/brand/mascot/logo-mascota-morado.png';
import imagenregistro from '../../assets/brand/numu-registro.jpg';

export default function Register() {
  const navigate = useNavigate();
  const { signUp, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [confirmar_email, setConfirmarEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError('');
    setNotice('');
    const { session, error: signUpError } = await signUp({ email, confirmEmail: confirmar_email, password });
    setSending(false);
    if (signUpError) {
      setError(signUpError);
      return;
    }
    if (!session) {
      // El proyecto pide confirmar el correo antes de la primera sesión.
      setNotice('Te enviamos un correo para confirmar tu cuenta. Después inicia sesión.');
      return;
    }
    // Cuenta nueva: siempre pasa por el cuestionario inicial (cold start).
    navigate(ROUTES.onboarding, { replace: true });
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

      {/* Formulario*/}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-6 md:p-12">
        <div className="bg-white w-full max-w-md p-8 md:p-10 rounded-card shadow-lg border-2 border-gray-100 flex flex-col items-center">
          
          <img src={logo} alt="Logo Numu" className="w-20 h-20 object-contain mb-6" />
          
          <h2 className="text-3xl font-fredoka font-extrabold text-numu-deep-indigo tracking-tight mb-8">
            Crear cuenta
          </h2>
          
          <form onSubmit={handleRegister} className="w-full space-y-5">

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-btn px-5 py-3.5 text-sm text-text-dark font-medium focus:outline-none focus:border-numu-purple focus:bg-white transition-colors"
              placeholder="correo electrónico"
              required
            />

            <input
              type="email"
              value={confirmar_email}
              onChange={(e) => setConfirmarEmail(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-btn px-5 py-3.5 text-sm text-text-dark font-medium focus:outline-none focus:border-numu-purple focus:bg-white transition-colors"
              placeholder="confirmar correo electrónico"
              required
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-btn px-5 py-3.5 text-sm text-text-dark font-medium focus:outline-none focus:border-numu-purple focus:bg-white transition-colors"
              placeholder="contraseña (mínimo 6 caracteres)"
              autoComplete="new-password"
              required
            />

            {!configured && (
              <p role="alert" className="text-sm font-medium text-coral-alert">
                Falta configurar Supabase (.env.local) para crear cuentas.
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm font-medium text-coral-alert">{error}</p>
            )}
            {notice && (
              <p role="status" className="text-sm font-medium text-numu-purple">{notice}</p>
            )}

            <div className="pt-4 flex items-center justify-between gap-4">
            <Link to={ROUTES.signIn} className="text-sm font-semibold text-numu-purple hover:underline">
                ¿Ya tienes cuenta? Inicia sesión
            </Link>
            <button
                type="submit"
                disabled={sending || !configured}
                className="bg-sunshine-yellow text-text-dark font-fredoka font-bold text-lg py-2.5 px-8 rounded-btn shadow-3d-yellow hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-60 disabled:pointer-events-none">
                {sending ? 'creando…' : 'siguiente >'}
            </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}