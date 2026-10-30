export const useAuth = () => {
  
  const signUp = async (email, confirmar_email, password) => {
    // Simulamos una espera de 1.5 segundos como si nos conectáramos a la base de datos
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        console.log("Simulando registro en base de datos para:", email);
        // Si todo sale bien, resolvemos la promesa
        resolve({ user: { email } });
      }, 1500);
    });
  };

  return { signUp };
};