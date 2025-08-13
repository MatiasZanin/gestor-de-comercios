import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

interface Props {
  children: JSX.Element;
}

const RequireAuth: React.FC<Props> = ({ children }) => {
  const { token } = useContext(AuthContext);
  const location = useLocation();
  // if (!token) {
  //   return <Navigate to="/login" state={{ from: location }} replace />;
  // }
  return children;
};

export default RequireAuth;