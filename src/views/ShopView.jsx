import { useState, useEffect } from 'react';
import { Gem } from 'lucide-react';
import { store } from '../state/store.js';
import { sfx } from '../utils/audio.js';
import { FRAMES } from '../components/Avatar.js'; // Asumiendo que FRAMES se exporta aquí

export default function ShopView() {
  // Estado local sincronizado con el store de tu compañero
  const [state, setState] = useState(() => store.get());

  // Suscribirse a los cambios del store para actualizar la UI automáticamente
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setState(store.get());
    });
    return () => unsubscribe(); // Limpieza al salir de la vista
  }, []);

  // --- Handlers de acciones ---
  const handleBuy = (item) => {
    const before = store.get().owned.length;
    store.purchase(item.id, item.price);
    
    if (store.get().owned.length > before) {
      store.set({ profile: { frame: item.id } });
      if (sfx && sfx.win) sfx.win();
    } else {
      if (sfx && sfx.wrong) sfx.wrong();
    }
  };

  const handleEquip = (item) => {
    store.set({ profile: { frame: item.id } });
    if (sfx && sfx.tap) sfx.tap();
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 font-poppins min-h-screen">
      
      {/* --- Encabezado --- */}
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-fredoka font-bold text-3xl md:text-4xl text-text-dark">
            Premios y Tienda
          </h1>
          <p className="text-gray-500 mt-2 text-sm md:text-base">
            Canjea las gemas que ganas jugando por marcos de perfil.
          </p>
        </div>
        
        {/* Contador de Gemas */}
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border-2 border-gray-100 shadow-sm font-fredoka font-bold text-2xl text-cyan-ocean tabular-nums">
          <Gem className="w-6 h-6 fill-cyan-ocean" />
          <span>{state.gems}</span>
        </div>
      </header>

      {/* --- Cuadrícula de Marcos (Frames) --- */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
        {FRAMES.map((item) => {
          const isOwned = state.owned.includes(item.id);
          const isEquipped = state.profile.frame === item.id;
          const canAfford = state.gems >= item.price;

          return (
            <article 
              key={item.id} 
              className="bg-white rounded-card p-6 flex flex-col items-center text-center gap-4 border-2 border-gray-100 shadow-sm hover:shadow-lg transition-shadow"
            >
              {/* Círculo de previsualización */}
              <div className="p-4 rounded-full bg-soft-lavender border-4 border-white shadow-inner flex items-center justify-center w-24 h-24">
                {/* Si tienes un componente Avatar en React, podrías usarlo aquí. 
                    Por ahora, dejamos un placeholder visual estilizado */}
                <div className="w-full h-full rounded-full border-4 border-numu-purple border-dashed opacity-50"></div>
              </div>
              
              <div className="flex-1">
                <h3 className="font-fredoka font-bold text-xl text-text-dark mb-1">
                  {item.name}
                </h3>
                <p className="text-sm font-medium text-gray-400 flex items-center justify-center gap-1.5">
                  <Gem className="w-4 h-4 text-cyan-ocean" />
                  <span className="tabular-nums">{item.price} gemas</span>
                </p>
              </div>

              {/* Botones de acción dinámicos */}
              <div className="w-full mt-2">
                {isEquipped ? (
                  <button className="w-full bg-mint-success text-white font-fredoka font-bold py-3 px-4 rounded-btn opacity-80 cursor-default">
                    Equipado
                  </button>
                ) : isOwned ? (
                  <button 
                    onClick={() => handleEquip(item)}
                    className="w-full bg-cyan-ocean text-white font-fredoka font-bold py-3 px-4 rounded-btn shadow-3d-primary hover:translate-y-1 hover:shadow-none transition-all"
                  >
                    Equipar
                  </button>
                ) : canAfford ? (
                  <button 
                    onClick={() => handleBuy(item)}
                    className="w-full bg-sunshine-yellow text-text-dark font-fredoka font-bold py-3 px-4 rounded-btn shadow-3d-yellow hover:translate-y-1 hover:shadow-none transition-all"
                  >
                    Canjear
                  </button>
                ) : (
                  <button 
                    disabled 
                    className="w-full bg-gray-100 text-gray-400 font-fredoka font-bold py-3 px-4 rounded-btn cursor-not-allowed"
                  >
                    Sin gemas
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

    </div>
  );
}