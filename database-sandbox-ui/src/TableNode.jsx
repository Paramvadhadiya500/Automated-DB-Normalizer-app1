import { Handle, Position } from 'reactflow';

export default function TableNode({ data }) {
  // Dynamic styling based on whether the system is under attack
  const isHacked = data.isUnderAttack;

  return (
    <div style={{
      background: isHacked ? '#fee2e2' : 'white', // Turns light red if attacked
      border: `2px solid ${isHacked ? '#ef4444' : (data.schema?.db_mode === 'dynamodb' ? '#8b5cf6' : '#3b82f6')}`,
      borderRadius: '8px',
      minWidth: '180px',
      boxShadow: isHacked ? '0 0 20px rgba(239, 68, 68, 0.8)' : '0 4px 6px rgba(0,0,0,0.1)',
      transition: 'all 0.3s ease'
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      
      {/* Header */}
      <div style={{ 
        background: isHacked ? '#ef4444' : (data.schema?.db_mode === 'dynamodb' ? '#8b5cf6' : '#3b82f6'), 
        color: 'white', padding: '8px', borderTopLeftRadius: '6px', borderTopRightRadius: '6px', fontWeight: 'bold', textAlign: 'center' 
      }}>
        {data.label}
      </div>
      
      {/* Columns */}
      <div style={{ padding: '10px' }}>
        {data.schema?.columns?.map(col => (
          <div key={col.name} style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
            <span style={{ color: isHacked ? '#991b1b' : '#0f172a', fontWeight: 'bold' }}>
              {col.name} 
              {col.is_primary_key && <span title="Primary/Partition Key"> 🔑</span>}
              {col.is_sort_key && <span title="Sort Key"> 🗂️</span>}
            </span>
            <span style={{ color: isHacked ? '#b91c1c' : '#64748b' }}>{col.data_type}</span>
          </div>
        ))}
        {(!data.schema?.columns || data.schema.columns.length === 0) && (
           <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', fontStyle: 'italic' }}>No attributes yet</div>
        )}
      </div>

      {/* 🚨 THE VULNERABILITY WARNING BOX 🚨 */}
      {isHacked && data.vulnerabilityWarning && (
        <div style={{ background: '#7f1d1d', color: 'white', fontSize: '11px', padding: '8px', borderBottomLeftRadius: '6px', borderBottomRightRadius: '6px', textAlign: 'center', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>
          ⚠️ {data.vulnerabilityWarning}
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />

      {/* CSS Animation for the pulse effect */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}