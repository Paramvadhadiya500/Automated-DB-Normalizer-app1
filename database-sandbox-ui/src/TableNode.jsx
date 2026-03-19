import { Handle, Position } from 'reactflow';

export default function TableNode({ data }) {
  // We extract the schema from the data prop that React Flow passes down
  const schema = data.schema;

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
      border: '1px solid #cbd5e1',
      minWidth: '200px',
      fontFamily: 'sans-serif',
      overflow: 'hidden' // Keeps the blue header neatly inside the rounded corners
    }}>
      
      {/* Table Header */}
      <div style={{ backgroundColor: '#3b82f6', color: 'white', padding: '10px', fontWeight: 'bold', textAlign: 'center', fontSize: '14px' }}>
        {schema?.name || 'Table'}
      </div>

      {/* Columns List */}
      <div style={{ padding: '10px' }}>
        {schema?.columns?.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic', textAlign: 'center' }}>No columns yet</div>
        ) : (
          schema?.columns.map((col, index) => (
            <div key={index} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontSize: '12px', 
              padding: '6px 0', 
              borderBottom: index !== schema.columns.length - 1 ? '1px solid #f1f5f9' : 'none' 
            }}>
              <span style={{ fontWeight: col.is_primary_key ? 'bold' : 'normal', color: '#334155' }}>
                {col.name} {col.is_primary_key && <span style={{ color: '#eab308', marginLeft: '4px' }}>🔑</span>}
              </span>
              <span style={{ color: '#94a3b8', fontSize: '11px' }}>{col.data_type}</span>
            </div>
          ))
        )}
      </div>

      {/* Invisible Handles (We need these for Option 2 later!) */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}