import React, { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { fetchProducts, Product } from '../api';
import colors from '../theme/colors';

const ProductsPage: React.FC = () => {
  const { token } = useContext(AuthContext);
  const { commerceId } = useParams<{ commerceId: string }>();
  const [items, setItems] = useState<Product[]>([]);
  const [lastKey, setLastKey] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (reset = false) => {
    // if (!token || !commerceId) return;
    setLoading(true);
    try {
      const res = await fetchProducts(commerceId!, token!, {
        lastKey: reset ? undefined : lastKey,
      });
      if (reset) {
        setItems(res.items);
      } else {
        setItems((prev) => [...prev, ...res.items]);
      }
      setLastKey(res.lastKey);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reset when commerceId changes
    setItems([]);
    setLastKey(undefined);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commerceId]);

  return (
    <div style={{ padding: '1rem' }}>
      <h2 style={{ color: colors.primary }}>Productos</h2>
      {error && <p style={{ color: colors.danger }}>Error: {error}</p>}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginTop: '1rem',
          backgroundColor: colors.surface,
        }}
      >
        <thead>
          <tr>
            <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem' }}>Código</th>
            <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem' }}>Nombre</th>
            <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem' }}>Precio venta</th>
            <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem' }}>Stock</th>
            <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem' }}>Vendidos</th>
            <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem' }}>Facturación</th>
            {/* Mostrar precio de compra y margen si existen en los datos */}
            {items.some((p) => p.priceBuy !== undefined) && (
              <>
                <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem' }}>Precio compra</th>
                <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem' }}>Margen</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.code}>
              <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{p.code}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{p.name}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{p.priceSale}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{p.stock}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{p.unitsSold}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{p.revenue}</td>
              {p.priceBuy !== undefined && (
                <>
                  <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{p.priceBuy}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{p.profit}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {loading && <p>Cargando...</p>}
      {lastKey && !loading && (
        <button
          onClick={() => load()}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: colors.primary,
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Cargar más
        </button>
      )}
    </div>
  );
};

export default ProductsPage;