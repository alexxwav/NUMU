import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Menu, X, Smile, Star, Rocket, 
  Calculator, Plus, Shapes, 
  Home as HomeIcon, User, Trophy, Settings, LogOut 
} from 'lucide-react';

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="min-h-screen bg-soft-lavender font-poppins text-text-dark p-6 md:p-10 relative">
      
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-40 z-40 transition-opacity"
          onClick={toggleSidebar}
        ></div>
      )}

      {/* --- Menú lateral --- */}
      <aside 
        className={`fixed top-0 left-0 w-72 h-full bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-in-out rounded-r-3xl flex flex-col ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-4xl font-fredoka font-extrabold text-numu-purple">Numu</h2>
          <button 
            onClick={toggleSidebar}
            className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-xl hover:bg-coral-alert hover:text-white transition-colors"
          >
            <X className="w-6 h-6" /> 
          </button>
        </div>

        {/* Enlaces del menú*/}
        <nav className="flex-1 p-6 space-y-2">
          <Link to="/inicio" className="flex items-center gap-4 p-4 rounded-2xl hover:bg-soft-lavender text-text-dark font-fredoka font-bold text-xl transition-colors">
            <HomeIcon className="w-6 h-6 text-numu-purple" /> Inicio
          </Link>
          <Link to="/perfil" className="flex items-center gap-4 p-4 rounded-2xl hover:bg-soft-lavender text-text-dark font-fredoka font-bold text-xl transition-colors">
            <User className="w-6 h-6 text-cyan-ocean" /> Mi Perfil
          </Link>
          <Link to="/trofeos" className="flex items-center gap-4 p-4 rounded-2xl hover:bg-soft-lavender text-text-dark font-fredoka font-bold text-xl transition-colors">
            <Trophy className="w-6 h-6 text-sunshine-yellow" /> Mis Trofeos
          </Link>
          <Link to="/ajustes" className="flex items-center gap-4 p-4 rounded-2xl hover:bg-soft-lavender text-text-dark font-fredoka font-bold text-xl transition-colors">
            <Settings className="w-6 h-6 text-gray-500" /> Ajustes
          </Link>
        </nav>

        {/* Botón de salir */}
        <div className="p-6 border-t border-gray-100">
          <button className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gray-100 hover:bg-coral-alert hover:text-white text-text-dark font-fredoka font-bold text-xl transition-colors group">
            <LogOut className="w-6 h-6 text-coral-alert group-hover:text-white" /> Salir
          </button>
        </div>
      </aside>

      {/* --- Encabezado --- */}
      <header className="flex justify-between items-center mb-10 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 md:gap-4">
          
          {/* Botón barras */}
          <button 
            onClick={toggleSidebar}
            className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center hover:scale-105 transition-transform border-2 border-gray-100 mr-2 text-numu-deep-indigo"
          >
            <Menu className="w-7 h-7" />
          </button>

          {/* Avatar del usuario */}
          <div className="w-14 h-14 md:w-16 md:h-16 bg-cyan-ocean rounded-full border-4 border-white shadow-md flex items-center justify-center text-white">
            <Smile className="w-8 h-8" strokeWidth={2.5} />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-2xl md:text-3xl font-fredoka font-bold text-numu-deep-indigo">
              ¡Hola, Explorador!
            </h1>
            <p className="text-sm md:text-base font-medium text-gray-500">
              ¿Listo para jugar y aprender?
            </p>
          </div>
        </div>
        
        {/* Contador de estrellas */}
        <div className="bg-white px-4 md:px-5 py-2 rounded-full shadow-sm border-2 border-gray-100 flex items-center gap-2">
          <Star className="w-6 h-6 text-sunshine-yellow fill-sunshine-yellow" />
          <span className="font-fredoka font-bold text-lg md:text-xl text-text-dark">120</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto space-y-12">
        
        {/* --- Misión diaria --- */}
        <section className="bg-numu-purple rounded-card p-8 md:p-10 text-white flex flex-col md:flex-row items-center justify-between shadow-3d-primary relative overflow-hidden">
          <div className="relative z-10 space-y-4 text-center md:text-left">
            <h2 className="text-3xl md:text-4xl font-fredoka font-bold">Misión del día</h2>
            <p className="text-soft-lavender text-lg max-w-md">
              Completa 3 ejercicios de sumas para ganar una medalla espacial secreta
            </p>
            <button className="mt-6 bg-sunshine-yellow text-text-dark font-fredoka font-bold text-xl py-3 px-8 rounded-btn shadow-3d-yellow hover:translate-y-1 hover:shadow-none transition-all">
              ¡Empezar Misión!
            </button>
          </div>
          {/* Cohete animado */}
          <div className="mt-6 md:mt-0 relative z-10 animate-bounce text-white">
            <Rocket className="w-24 h-24 md:w-32 md:h-32" strokeWidth={1.5} />
          </div>
          {/* Círculo decorativo de fondo */}
          <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-numu-deep-indigo rounded-full opacity-30"></div>
        </section>

        {/* --- Cursos de aprendizaje --- */}
        <section>
          <h3 className="text-2xl font-fredoka font-bold text-text-dark mb-6">
            Tus Aventuras
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* Tarjeta 1: Conteo */}
            <Link to="/jugar/conteo" className="bg-white rounded-card p-6 border-2 border-transparent hover:border-cyan-ocean shadow-sm hover:shadow-lg transition-all flex flex-col items-center text-center group cursor-pointer">
              <div className="w-24 h-24 bg-cyan-ocean text-white rounded-full mb-4 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                <Calculator className="w-10 h-10" strokeWidth={2.5} />
              </div>
              <h4 className="text-xl font-fredoka font-bold text-text-dark mb-2">Conteo Mágico</h4>
              <p className="text-gray-500 text-sm">Aprende a contar con animales.</p>
              <div className="mt-6 w-full bg-gray-100 rounded-full h-4 overflow-hidden border border-gray-200">
                <div className="bg-mint-success h-full rounded-full" style={{ width: '80%' }}></div>
              </div>
            </Link>

            {/* Tarjeta 2: Sumas */}
            <Link to="/jugar/sumas" className="bg-white rounded-card p-6 border-2 border-transparent hover:border-orange-energy shadow-sm hover:shadow-lg transition-all flex flex-col items-center text-center group cursor-pointer">
              <div className="w-24 h-24 bg-orange-energy text-white rounded-full mb-4 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                <Plus className="w-12 h-12" strokeWidth={3} />
              </div>
              <h4 className="text-xl font-fredoka font-bold text-text-dark mb-2">Sumas y Restas</h4>
              <p className="text-gray-500 text-sm">Resuelve problemas y rescata los objetos perdidos.</p>
              <div className="mt-6 w-full bg-gray-100 rounded-full h-4 overflow-hidden border border-gray-200">
                <div className="bg-mint-success h-full rounded-full" style={{ width: '30%' }}></div>
              </div>
            </Link>

            {/* Tarjeta 3: Formas */}
            <Link to="/jugar/formas" className="bg-white rounded-card p-6 border-2 border-transparent hover:border-coral-alert shadow-sm hover:shadow-lg transition-all flex flex-col items-center text-center group cursor-pointer">
              <div className="w-24 h-24 bg-coral-alert text-white rounded-full mb-4 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                <Shapes className="w-10 h-10" strokeWidth={2.5} />
              </div>
              <h4 className="text-xl font-fredoka font-bold text-text-dark mb-2">Formas Ocultas</h4>
              <p className="text-gray-500 text-sm">Descubre las formas geométricas ocultas en el espacio.</p>
              <div className="mt-6 w-full bg-gray-100 rounded-full h-4 overflow-hidden border border-gray-200">
                <div className="bg-gray-300 h-full rounded-full" style={{ width: '0%' }}></div>
              </div>
            </Link>

          </div>
        </section>
      </main>
    </div>
  );
}