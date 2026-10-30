import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Menu, X, Star, Rocket, 
  Home as HomeIcon, Trophy, Settings, LogOut, Store, Lock, BookOpen
} from 'lucide-react';
import { store, MODULES } from '../../state/store.js';
import { sfx } from '../../utils/audio.js';
import { useAuth } from '../../hooks/useAuth.jsx';
import { normalizeModuleId } from '../../data/subjects.js';
import catalog from '../../data/lessonContent.json';
import { COURSE_STYLE } from '../CoursesView.jsx';
import mascotUrl from '../../assets/brand/mascot/numu-morado.png';

const TOTAL_LEVELS = 10;

export default function Home() {
  const navigate = useNavigate();
  const { configured, signOut } = useAuth();

  const handleSignOut = async () => {
    sfx.tap();
    if (configured) await signOut();
    navigate('/bienvenida', { replace: true });
  };
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [state, setState] = useState(() => store.get());

  useEffect(() => {
    const unsubscribe = store.subscribe(() => setState(store.get()));
    return () => unsubscribe();
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // Datos dinámicos del usuario
  const displayName = state.profile?.nickname || state.profile?.name || 'Explorador';
  const selectedModule = MODULES.find((m) => m.id === normalizeModuleId(state.module)) ?? MODULES[0];
  const courses = [...catalog.courses].sort((a, b) => a.position - b.position);

  // Manejador para jugar un nivel
  const handlePlayLevel = (moduleId, levelNumber) => {
    sfx.tap();
    store.set({ module: moduleId });
    navigate(`/jugar/${moduleId}`);
  };

  return (
    <div className="min-h-screen bg-soft-lavender font-poppins text-text-dark p-6 md:p-10 relative pb-24">
      
      {/* Overlay del Menú */}
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

        <nav className="flex-1 p-6 space-y-2">
          <Link to="/inicio" className="flex items-center gap-4 p-4 rounded-2xl bg-soft-lavender text-numu-purple font-fredoka font-bold text-xl transition-colors">
            <HomeIcon className="w-6 h-6" /> Inicio
          </Link>
          <Link to="/cursos" className="flex items-center gap-4 p-4 rounded-2xl hover:bg-soft-lavender text-text-dark font-fredoka font-bold text-xl transition-colors">
            <BookOpen className="w-6 h-6 text-orange-energy" /> Cursos
          </Link>
          <Link to="/tienda" className="flex items-center gap-4 p-4 rounded-2xl hover:bg-soft-lavender text-text-dark font-fredoka font-bold text-xl transition-colors">
            <Store className="w-6 h-6 text-cyan-ocean" /> Tienda
          </Link>
          <Link to="/trofeos" className="flex items-center gap-4 p-4 rounded-2xl hover:bg-soft-lavender text-text-dark font-fredoka font-bold text-xl transition-colors">
            <Trophy className="w-6 h-6 text-sunshine-yellow" /> Mis Trofeos
          </Link>
          <Link to="/ajustes" className="flex items-center gap-4 p-4 rounded-2xl hover:bg-soft-lavender text-text-dark font-fredoka font-bold text-xl transition-colors">
            <Settings className="w-6 h-6 text-gray-500" /> Perfil y Ajustes
          </Link>
        </nav>

        <div className="p-6 border-t border-gray-100">
          <button type="button" onClick={handleSignOut} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gray-100 hover:bg-coral-alert hover:text-white text-text-dark font-fredoka font-bold text-xl transition-colors group">
            <LogOut className="w-6 h-6 text-coral-alert group-hover:text-white" /> Salir
          </button>
        </div>
      </aside>

      {/* --- Encabezado Dinámico --- */}
      <header className="flex justify-between items-center mb-10 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 md:gap-4">
          <button 
            onClick={toggleSidebar}
            className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center hover:scale-105 transition-transform border-2 border-gray-100 mr-2 text-numu-deep-indigo"
          >
            <Menu className="w-7 h-7" />
          </button>

          {/* Avatar (Aquí podrías integrar su componente Avatar luego, por ahora usamos un placeholder) */}
          <div className="w-14 h-14 md:w-16 md:h-16 bg-cyan-ocean rounded-full border-4 border-white shadow-md flex items-center justify-center text-white text-2xl">
            {['👾', '🐱', '🐶', '🦊', '🚀', '⭐'][state.profile?.avatar || 0]}
          </div>
          <div className="hidden sm:block">
            <h1 className="text-2xl md:text-3xl font-fredoka font-bold text-numu-deep-indigo">
              ¡Hola, {displayName}!
            </h1>
            <p className="text-sm md:text-base font-medium text-gray-500">
              Nivel {state.level} · {state.xp} XP
            </p>
          </div>
        </div>
        
        <div className="bg-white px-4 md:px-5 py-2 rounded-full shadow-sm border-2 border-gray-100 flex items-center gap-2">
          <Star className="w-6 h-6 text-sunshine-yellow fill-sunshine-yellow" />
          <span className="font-fredoka font-bold text-lg md:text-xl text-text-dark tabular-nums">{state.stars}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto space-y-12">
        
        {/* --- Misión diaria (Tu diseño) --- */}
        <section className="bg-numu-purple rounded-card p-8 md:p-10 text-white flex flex-col md:flex-row items-center justify-between shadow-3d-primary relative overflow-hidden">
          <div className="relative z-10 space-y-4 text-center md:text-left">
            <h2 className="text-3xl md:text-4xl font-fredoka font-bold">Misión del día</h2>
            <p className="text-soft-lavender text-lg max-w-md">
              Avanza en tu ruta de aprendizaje para ganar gemas.
            </p>
            <button 
              onClick={() => handlePlayLevel(selectedModule.id, state.level)}
              className="mt-6 bg-sunshine-yellow text-text-dark font-fredoka font-bold text-xl py-3 px-8 rounded-btn shadow-3d-yellow hover:translate-y-1 hover:shadow-none transition-all"
            >
              ¡Continuar Aventura!
            </button>
          </div>
          <div className="mt-6 md:mt-0 relative z-10 animate-bounce text-white">
            <Rocket className="w-24 h-24 md:w-32 md:h-32" strokeWidth={1.5} />
          </div>
          <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-numu-deep-indigo rounded-full opacity-30"></div>
        </section>

        {/* --- Cursos (catálogo de lecciones de Viviana) --- */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-fredoka font-bold text-text-dark">Tus cursos</h3>
            <Link to="/cursos" onClick={() => sfx.tap()} className="font-fredoka font-bold text-numu-purple hover:underline">Ver todos</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {courses.map((course) => {
              const style = COURSE_STYLE[course.id] ?? COURSE_STYLE.aritmetica;
              return (
                <Link key={course.id} to={`/cursos/${course.id}`} onClick={() => sfx.tap()}
                  className="bg-white rounded-card p-6 border-2 border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all flex items-center gap-5 group">
                  <div className={`w-20 h-20 shrink-0 ${style.bg} text-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <style.Icon className="w-10 h-10" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="text-xl font-fredoka font-bold text-text-dark mb-1">{course.title}</h4>
                    <p className="text-gray-500 text-sm">{course.lessons.map((l) => l.title).join(' · ')}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* --- Mapa de Niveles (El diseño de tu compañero traducido a React) --- */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-fredoka font-bold text-text-dark">Tu ruta: {selectedModule.name}</h2>
          </div>
          
          <div className="relative flex flex-col items-center gap-12 py-10 px-4 rounded-card bg-white border-2 border-gray-100 shadow-sm overflow-hidden">
            {/* Línea vertical del camino */}
            <div className="absolute inset-x-0 top-10 bottom-10 w-2 -translate-x-1/2 left-1/2 bg-gray-200 rounded-full" aria-hidden="true"></div>
            
            {Array.from({ length: TOTAL_LEVELS }).map((_, i) => {
              const level = i + 1;
              const isDone = level < state.level;
              const isCurrent = level === state.level;
              const isLocked = level > state.level;

              return (
                <div key={level} className="relative z-10">
                  {isDone && (
                    <button onClick={() => handlePlayLevel(selectedModule.id, level)} className="w-20 h-20 rounded-full bg-mint-success text-white shadow-3d-success font-fredoka font-bold text-3xl grid place-items-center active:translate-y-1 transition-transform relative">
                      {level}
                      <div className="absolute -top-3 flex gap-0.5 text-sunshine-yellow">
                        <Star className="w-5 h-5 fill-current" /><Star className="w-5 h-5 fill-current" /><Star className="w-5 h-5 fill-current" />
                      </div>
                    </button>
                  )}

                  {isCurrent && (
                    <button onClick={() => handlePlayLevel(selectedModule.id, level)} className="w-24 h-24 rounded-full bg-numu-purple text-white shadow-3d-primary font-fredoka font-bold text-4xl grid place-items-center animate-pulse active:translate-y-1 transition-transform relative">
                      {level}
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-white grid place-items-center shadow-lg border-2 border-gray-100 p-1.5">
                        <img src={mascotUrl} alt="NUMU" className="w-full h-full object-contain" />
                      </div>
                      <span className="absolute -bottom-8 whitespace-nowrap font-poppins font-bold text-sm text-numu-purple bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100">
                        ¡Vamos!
                      </span>
                    </button>
                  )}

                  {isLocked && (
                    <button disabled className="w-20 h-20 rounded-full bg-gray-200 text-gray-400 shadow-none font-fredoka font-bold text-3xl grid place-items-center cursor-not-allowed border-2 border-gray-300">
                      <Lock className="w-8 h-8" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </main>
    </div>
  );
}