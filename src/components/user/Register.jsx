import { useState } from 'react';
// import { useAuth } from '../hooks/useAuth'; 
import logo from '../../assets/brand/mascot/logo-mascota-morado.png';
import imagenregistro from '../../assets/brand/numu-registro.jpg';

export default function Register() {
  const [email, setEmail] = useState('');
  const [confirmar_email, setConfirmarEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = (e) => {
    e.preventDefault(); 
    console.log("Registrando el correo:", email);
  };

  return (
    <div className="min-h-screen w-full flex bg-white font-poppins">
      
     <div className="hidden md:block md:w-1/2 relative">
        <img 
        src={imagenregistro} 
        alt="Mascota Numu" 
        className="w-full h-full object-cover absolute inset-0" 
    />
    </div>

      <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-8">
        
        {<img src={logo} alt="Logo Numu" className="w-16 h-16 object-contain mb-4" />}
        <h2 className="text-3xl font-fredoka font-extrabold text-black tracking-tight mb-8">
          Crear cuenta
        </h2>
        
        <form onSubmit={handleRegister} className="w-full max-w-sm space-y-4">

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-700 focus:outline-none focus:border-numu-purple"
            placeholder="correo electrónico"
            required
          />

          <input
            type="email"
            value={confirmar_email}
            onChange={(e) => setConfirmarEmail(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-700 focus:outline-none focus:border-numu-purple"
            placeholder="confirmar correo electrónico"
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-700 focus:outline-none focus:border-numu-purple"
            placeholder="contraseña"
            required
          />

          <div className="pt-4">
            <button type="submit" className="bg-sunshine-yellow text-text-dark font-bold py-2.5 px-6 rounded-lg float-right hover:opacity-80 transition-opacity">
                siguiente &gt;
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}