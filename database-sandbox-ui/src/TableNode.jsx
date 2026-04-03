import React from 'react';
// 1. IMPORT `useReactFlow` from reactflow
import { Handle, Position, useReactFlow } from 'reactflow'; 

const TableNode = ({ id, data }) => {
  // 2. GRAB THE `setNodes` FUNCTION
  const { setNodes } = useReactFlow(); 

  // 3. THE MAGIC UPDATE FUNCTION
  const handleAuthToggle = (e) => {
    const isChecked = e.target.checked;
    
    // This safely reaches up to the main dashboard and updates this specific node
    setNodes((nds) => 
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              requireAuth: isChecked // <-- Saves the checkmark!
            }
          };
        }
        return node;
      })
    );
  };

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #3b82f6', overflow: 'hidden', minWidth: '150px' }}>
      
      {/* --- YOUR EXISTING TABLE HEADER --- */}
      <div style={{ backgroundColor: '#3b82f6', color: 'white', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>
        {data.label || data.schema?.name || 'Table'}
      </div>

      {/* --- THE NEW BULLETPROOF CHECKBOX --- */}
      <div className="nodrag" style={{ padding: '8px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
        <input 
          type="checkbox" 
          id={`auth-${id}`}
          checked={data.requireAuth || false} 
          onChange={handleAuthToggle} // <-- Uses our new magic function
          style={{ cursor: 'pointer', width: '14px', height: '14px' }}
        />
        <label htmlFor={`auth-${id}`} style={{ fontWeight: 'bold', cursor: 'pointer', userSelect: 'none', margin: 0 }}>
          🔒 Require JWT Auth
        </label>
      </div>

      {/* --- YOUR EXISTING COLUMNS / ROWS GO HERE --- */}
      <div style={{ padding: '10px' }}>
         {/* (Keep whatever code you already have here that renders the columns) */}
      </div>

      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default TableNode;