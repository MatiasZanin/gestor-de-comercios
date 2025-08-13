import React, { useContext, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { getDailyReport } from '../api';
import colors from '../theme/colors';

interface ReportEntry {
  code: string;
  name: string;
  units: number;
  revenue: number;
  profit?: number;
}

const DailyReportPage: React.FC = () => {
  const { token } = useContext(AuthContext);
  const { commerceId } = useParams<{ commerceId: string }>();
  const [day, setDay] = useState('');
  const [orderBy, setOrderBy] = useState<'units' | 'revenue' | 'profit'>('units');
  const [data, setData] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    if (!token || !commerceId || !day) return;
    setLoading(true);
    try {
      const res = await getDailyReport(commerceId, token, day, orderBy);
      setData(res.results);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h2 style={{ color: colors.primary }}>Reporte diario</h2>
      <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div>
          <label>Día: </label>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
        <div>
          <label>Ordenar por: </label>
          <select value={orderBy} onChange={(e) => setOrderBy(e.target.value as any)}>
            <option value="units">Unidades</option>
            <option value="revenue">Facturación</option>
            <option value="profit">Margen</option>
          </select>
        </div>
        <button
          onClick={loadReport}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: colors.primary,
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Consultar
        </button>
      </div>
      {loading && <p>Cargando...</p>}
      {error && <p style={{ color: colors.danger }}>Error: {error}</p>}
      {data.length > 0 && (
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
              <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem' }}>Unidades</th>
              <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem' }}>Facturación</th>
              {data.some((d) => d.profit !== undefined) && (
                <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem' }}>Margen</th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((entry) => (
              <tr key={entry.code}>
                <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{entry.code}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{entry.name}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{entry.units}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{entry.revenue}</td>
                {entry.profit !== undefined && (
                  <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{entry.profit}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default DailyReportPage;