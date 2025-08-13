import React, { useState, useEffect, createContext, ReactNode } from 'react';

interface AuthState {
  token: string | null;
  setToken: (token: string | null) => void;
}

export const AuthContext = createContext<AuthState>({
  token: null,
  setToken: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setTokenState] = useState<string | null>(() => {
    return localStorage.getItem('authToken');
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }, [token]);

  const setToken = (t: string | null) => {
    setTokenState(t);
  };

  return (
    <AuthContext.Provider value={{ token, setToken }}>
      {children}
    </AuthContext.Provider>
  );
};