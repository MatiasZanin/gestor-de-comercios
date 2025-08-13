import React, { useContext, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import colors from '../theme/colors';

const LoginPage: React.FC = () => {
  const { token, setToken } = useContext(AuthContext);
  const [value, setValue] = useState<string>(token ?? '');
  const navigate = useNavigate();
  const location = useLocation() as any;
  const from = location.state?.from?.pathname || '/';
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value) {
      setToken(value);
      navigate(from);
    }
  };
  return (
    <div
      style={{
        backgroundColor: colors.background,
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: colors.surface,
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          width: '400px',
        }}
      >
        <h1 style={{ marginBottom: '1rem', color: colors.primary }}>Iniciar sesión</h1>
        <label htmlFor="token" style={{ display: 'block', marginBottom: '0.5rem' }}>
          Token JWT
        </label>
        <textarea
          id="token"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          style={{ width: '100%', marginBottom: '1rem' }}
        />
        <button
          type="submit"
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: colors.primary,
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Guardar
        </button>
      </form>
    </div>
  );
};

export default LoginPage;