import React, { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { fetchSales, createSale, Sale, SaleItem } from '../api';
import colors from '../theme/colors';

const SalesPage: React.FC = () => {
  const { token } = useContext(AuthContext);
  const { commerceId } = useParams<{ commerceId: string }>();
  const [sales, setSales] = useState<Sale[]>([]);
  const [lastKey, setLastKey] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState('');
  // Form state for new sale
  const [items, setItems] = useState<SaleItem[]>([]);
  const [newItem, setNewItem] = useState<SaleItem>({
    code: '',
    name: '',
    qty: 1,
    priceBuy: undefined,
    priceSale: 0,
  });
  const [notes, setNotes] = useState('');

  const load = async (reset = false) => {
    if (!token || !commerceId) return;
    setLoading(true);
    try {
      const res = await fetchSales(commerceId, token, {
        day: dayFilter || undefined,
        lastKey: reset ? undefined : lastKey,
      });
      if (reset) {
        setSales(res.items);
      } else {
        setSales((prev) => [...prev, ...res.items]);
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
    setSales([]);
    setLastKey(undefined);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commerceId, dayFilter]);

  const addItem = () => {
    if (!newItem.code || !newItem.name || !newItem.qty || !newItem.priceSale) return;
    setItems((prev) => [...prev, { ...newItem }]);
    setNewItem({ code: '', name: '', qty: 1, priceBuy: undefined, priceSale: 0 });
  };

  const handleCreateSale = async () => {
    if (!token || !commerceId) return;
    if (items.length === 0) {
      alert('Agregue al menos un ítem');
      return;
    }
    try {
      await createSale(commerceId, token, { items, notes });
      alert('Venta registrada');
      // Reset form y refrescar lista
      setItems([]);
      setNotes('');
      setSales([]);
      setLastKey(undefined);
      load(true);
    } catch (err: any) {
      alert('Error al crear venta: ' + err.message);
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h2 style={{ color: colors.primary }}>Ventas</h2>
      {/* Filtro por día */}
      <div style={{ margin: '1rem 0' }}>
        <label>
          Día (YYYY-MM-DD):{' '}
          <input
            type="date"
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
          />
        </label>
      </div>
      {/* Tabla de ventas */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginBottom: '1rem',
          backgroundColor: colors.surface,
        }}
      >
        <thead>
          <tr>
            <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem' }}>ID</th>
            <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem' }}>Fecha</th>
            <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem' }}>Total</th>
            <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem' }}>Items</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => (
            <tr key={s.saleId}>
              <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{s.saleId}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{s.createdAt}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{s.total}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{s.items.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {loading && <p>Cargando...</p>}
      {lastKey && !loading && (
        <button
          onClick={() => load()}
          style={{
            marginBottom: '1rem',
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
      {error && <p style={{ color: colors.danger }}>Error: {error}</p>}
      {/* Formulario para nueva venta */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ color: colors.primary }}>Registrar nueva venta / devolución</h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label>Código</label>
            <input
              type="text"
              value={newItem.code}
              onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
            />
          </div>
          <div>
            <label>Nombre</label>
            <input
              type="text"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            />
          </div>
          <div>
            <label>Cantidad</label>
            <input
              type="number"
              value={newItem.qty}
              onChange={(e) =>
                setNewItem({ ...newItem, qty: parseInt(e.target.value, 10) || 0 })
              }
            />
          </div>
          <div>
            <label>Precio compra</label>
            <input
              type="number"
              value={newItem.priceBuy ?? ''}
              onChange={(e) =>
                setNewItem({
                  ...newItem,
                  priceBuy: e.target.value === '' ? undefined : parseFloat(e.target.value),
                })
              }
            />
          </div>
          <div>
            <label>Precio venta</label>
            <input
              type="number"
              value={newItem.priceSale}
              onChange={(e) =>
                setNewItem({ ...newItem, priceSale: parseFloat(e.target.value) || 0 })
              }
            />
          </div>
          <button
            type="button"
            onClick={addItem}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: colors.secondary,
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              height: '2.5rem',
              marginTop: '1.5rem',
            }}
          >
            Añadir ítem
          </button>
        </div>
        {items.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <h4>Items agregados</h4>
            <ul>
              {items.map((it, idx) => (
                <li key={idx}>{`${it.qty} x ${it.name} (${it.code})`}</li>
              ))}
            </ul>
          </div>
        )}
        <div style={{ marginTop: '1rem' }}>
          <label>Notas</label>
          <br />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{ width: '100%' }}
          />
        </div>
        <button
          type="button"
          onClick={handleCreateSale}
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
          Registrar venta
        </button>
      </div>
    </div>
  );
};

export default SalesPage;