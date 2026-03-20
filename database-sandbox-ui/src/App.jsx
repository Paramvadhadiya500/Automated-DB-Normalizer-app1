import { useState, useCallback } from 'react';
import ReactFlow, { Background, Controls, useNodesState, useEdgesState, addEdge } from 'reactflow';
import { toPng } from 'html-to-image';
import 'reactflow/dist/style.css';
import TableNode from './TableNode';
import CloudDashboard from './CloudDashboard';

const nodeTypes = { customTable: TableNode };

// --- NENSIERA CAFE STARTUP TEMPLATE ---
const cafeTemplateNodes = [
  { id: 't1', type: 'customTable', position: { x: 100, y: 100 }, data: { label: 'Staff', schema: { name: 'Staff', columns: [{name: 'staff_id', data_type: 'INT', is_primary_key: true}, {name: 'name', data_type: 'VARCHAR', is_primary_key: false}, {name: 'role', data_type: 'VARCHAR', is_primary_key: false}], dependencies: [] } } },
  { id: 't2', type: 'customTable', position: { x: 500, y: 100 }, data: { label: 'Menu', schema: { name: 'Menu', columns: [{name: 'item_id', data_type: 'INT', is_primary_key: true}, {name: 'item_name', data_type: 'VARCHAR', is_primary_key: false}, {name: 'price', data_type: 'INT', is_primary_key: false}], dependencies: [] } } },
  { id: 't3', type: 'customTable', position: { x: 300, y: 350 }, data: { label: 'Orders', schema: { name: 'Orders', columns: [{name: 'order_id', data_type: 'INT', is_primary_key: true}, {name: 'staff_id', data_type: 'INT', is_primary_key: false}, {name: 'item_id', data_type: 'INT', is_primary_key: false}], dependencies: [] } } }
];

const cafeTemplateEdges = [
  { id: 'e1', source: 't1', target: 't3', animated: true, label: 'Handled By', style: { stroke: '#8b5cf6', strokeWidth: 2 }, labelStyle: { fill: '#475569', fontWeight: 700 } },
  { id: 'e2', source: 't2', target: 't3', animated: true, label: 'Contains', style: { stroke: '#8b5cf6', strokeWidth: 2 }, labelStyle: { fill: '#475569', fontWeight: 700 } }
];

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // 🆕 THE MASTER TOGGLE STATE
  const [dbMode, setDbMode] = useState("sql"); // 'sql' or 'dynamodb'

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [sandboxResult, setSandboxResult] = useState(null); 

  // SQL Inputs
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState("INT");
  const [isPk, setIsPk] = useState(false);
  const [detInput, setDetInput] = useState("");
  const [depInput, setDepInput] = useState("");

  // 🆕 DynamoDB Inputs
  const [nosqlKeyType, setNosqlKeyType] = useState("attribute"); // 'pk', 'sk', or 'attribute'

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  const onNodeClick = useCallback((event, node) => {
    setSelectedNodeId(node.id);
    setIsPanelOpen(true);
    setAnalysisResult(null);
    setSandboxResult(null); 
  }, []);

  const closePanel = () => {
    setIsPanelOpen(false);
    setSelectedNodeId(null);
  };

  const loadCafeTemplate = () => {
    setDbMode("sql"); // Force SQL mode for the template
    setNodes(cafeTemplateNodes);
    setEdges(cafeTemplateEdges);
    setIsPanelOpen(false);
  };

  const exportImage = () => {
    const element = document.querySelector('.react-flow');
    toPng(element, { backgroundColor: '#f8fafc' }).then((dataUrl) => {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'database_architecture.png';
      a.click();
    });
  };

  const updateTableName = (newName) => {
    setNodes((nds) => nds.map((node) => {
      if (node.id === selectedNodeId) {
        return { ...node, data: { ...node.data, label: newName, schema: { ...node.data.schema, name: newName } } };
      }
      return node;
    }));
  };

  const deleteColumn = (colNameToRemove) => {
    setNodes((nds) => nds.map((node) => {
      if (node.id === selectedNodeId) {
        const updatedColumns = node.data.schema.columns.filter(col => col.name !== colNameToRemove);
        return { ...node, data: { ...node.data, schema: { ...node.data.schema, columns: updatedColumns } } };
      }
      return node;
    }));
  };

  const deleteTable = () => {
    if (!window.confirm(`⚠️ Are you sure you want to delete '${selectedNode.data.label}'?`)) return;
    setNodes((nds) => nds.filter((node) => node.id !== selectedNodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
    closePanel();
  };

  const addColumn = () => {
    if (!newColName) return;
    setNodes((nds) => nds.map((node) => {
      if (node.id === selectedNodeId) {
        const updatedSchema = { ...node.data.schema, columns: [...node.data.schema.columns, { name: newColName, data_type: newColType, is_primary_key: isPk }] };
        return { ...node, data: { ...node.data, schema: updatedSchema } };
      }
      return node;
    }));
    setNewColName(""); 
    setIsPk(false); 
  };

  // 🆕 DYNAMODB ADD ATTRIBUTE LOGIC
  const addNoSQLAttribute = () => {
    if (!newColName) return;
    setNodes((nds) => nds.map((node) => {
      if (node.id === selectedNodeId) {
        const updatedSchema = { 
          ...node.data.schema, 
          columns: [...node.data.schema.columns, { 
            name: newColName, 
            data_type: newColType, 
            is_primary_key: nosqlKeyType === 'pk',
            is_sort_key: nosqlKeyType === 'sk' 
          }] 
        };
        return { ...node, data: { ...node.data, schema: updatedSchema } };
      }
      return node;
    }));
    setNewColName(""); 
    setNosqlKeyType("attribute");
  };

  const addDependency = () => {
    if (!detInput || !depInput) return;
    setNodes((nds) => nds.map((node) => {
      if (node.id === selectedNodeId) {
        const updatedSchema = { ...node.data.schema, dependencies: [...node.data.schema.dependencies, { determinants: [detInput], dependents: [depInput] }] };
        return { ...node, data: { ...node.data, schema: updatedSchema } };
      }
      return node;
    }));
    setDetInput(""); setDepInput("");
  };

  const addNewTable = () => {
    const newId = Date.now().toString(); 
    const tableNumber = nodes.length + 1;
    const newNode = {
      id: newId, type: 'customTable', 
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 }, 
      data: { label: dbMode === 'sql' ? `New_Table_${tableNumber}` : `Dynamo_Table_${tableNumber}`, schema: { name: `Table_${tableNumber}`, columns: [], dependencies: [] } }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const onConnect = useCallback((params) => {
    if (dbMode === 'dynamodb') {
      alert("NoSQL Databases like DynamoDB do not use Foreign Keys! Design your access patterns inside a single table.");
      return;
    }
    const styledEdge = { ...params, animated: true, label: 'Foreign Key', style: { stroke: '#8b5cf6', strokeWidth: 2 }, labelStyle: { fill: '#475569', fontWeight: 700, fontSize: 12 } };
    setEdges((eds) => addEdge(styledEdge, eds));
  }, [setEdges, dbMode]);

// --- API CALLS ---
  const analyzeTable = async () => {
    if (!selectedNode) return;
    setAnalysisResult({ status: "analyzing", message: "Analyzing..." });
    setSandboxResult(null); 
    
    // 🆕 THE FIX: We package the current dbMode into the data so Python knows which rules to use!
    const payload = {
      ...selectedNode.data.schema,
      db_mode: dbMode 
    };

    try {
      const response = await fetch("http://127.0.0.1:8000/api/normalize/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const data = await response.json();
      setAnalysisResult(data);
    } catch (error) { setAnalysisResult({ status: "error", message: "Failed to connect to API." }); }
  };
  const deployToSandbox = async () => { /* ... unchanged ... */ };
  const downloadSQL = () => { /* ... unchanged ... */ };

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#f8fafc', position: 'relative', overflow: 'hidden' }}>
     {/* Pass the dbMode down to the Dashboard! */}
      <CloudDashboard dbMode={dbMode} />
      
      {/* Floating Top Menu with 🆕 TOGGLE SWITCH */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, display: 'flex', gap: '15px', backgroundColor: 'white', padding: '10px 20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', alignItems: 'center' }}>
        
        {/* The Master Architecture Toggle */}
        <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '6px', padding: '4px' }}>
          <button onClick={() => setDbMode('sql')} style={{ padding: '6px 12px', backgroundColor: dbMode === 'sql' ? '#3b82f6' : 'transparent', color: dbMode === 'sql' ? 'white' : '#64748b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}>
            SQL (Relational)
          </button>
          <button onClick={() => setDbMode('dynamodb')} style={{ padding: '6px 12px', backgroundColor: dbMode === 'dynamodb' ? '#8b5cf6' : 'transparent', color: dbMode === 'dynamodb' ? 'white' : '#64748b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}>
            DynamoDB (NoSQL)
          </button>
        </div>

        <div style={{ width: '1px', height: '30px', backgroundColor: '#cbd5e1' }}></div>

        <button onClick={addNewTable} style={{ padding: '8px 16px', backgroundColor: dbMode === 'dynamodb' ? '#8b5cf6' : '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          + Create {dbMode === 'dynamodb' ? 'Document' : 'Table'}
        </button>
        {dbMode === 'sql' && (
          <button onClick={loadCafeTemplate} style={{ padding: '8px 16px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            ☕ Load Cafe Template
          </button>
        )}
      </div>
      
      {/* Side Panel */}
      {isPanelOpen && selectedNode && (
        <div style={{ position: 'absolute', right: 0, top: 0, width: '400px', height: '100vh', backgroundColor: 'white', boxShadow: '-4px 0 15px rgba(0,0,0,0.1)', zIndex: 20, padding: '30px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          
          <input 
            value={selectedNode.data.label} 
            onChange={(e) => updateTableName(e.target.value)}
            style={{ fontSize: '24px', fontWeight: 'bold', border: 'none', borderBottom: `2px solid ${dbMode === 'dynamodb' ? '#8b5cf6' : '#3b82f6'}`, marginBottom: '20px', color: '#0f172a', padding: '5px', outline: 'none', width: '100%' }}
          />
          
          <div style={{ marginBottom: '20px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#475569' }}>Current Schema:</h4>
            
            {selectedNode.data.schema.columns.map(col => (
              <div key={col.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span>
                  • {col.name} <span style={{ color: '#64748b' }}>({col.data_type})</span> 
                  {col.is_primary_key && <span style={{ color: dbMode === 'dynamodb' ? '#8b5cf6' : '#eab308', fontWeight: 'bold', marginLeft: '5px' }}>{dbMode === 'dynamodb' ? '[PK]' : '[PK]'}</span>}
                  {col.is_sort_key && <span style={{ color: '#ec4899', fontWeight: 'bold', marginLeft: '5px' }}>[SK]</span>}
                </span>
                <button onClick={() => deleteColumn(col.name)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', padding: '0 5px' }}>❌</button>
              </div>
            ))}
          </div>

          {/* 🆕 CONDITIONAL UI: SQL vs DynamoDB */}
          {dbMode === 'sql' ? (
            <>
              {/* SQL Standard Panel */}
              <div style={{ marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Add New Column</h4>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <input value={newColName} onChange={(e) => setNewColName(e.target.value)} placeholder="Col Name" style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                  <select value={newColType} onChange={(e) => setNewColType(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                    <option>INT</option><option>VARCHAR</option>
                  </select>
                </div>
                <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px' }}>
                  <input type="checkbox" checked={isPk} onChange={(e) => setIsPk(e.target.checked)} /> Is Primary Key?
                </label>
                <button onClick={addColumn} style={{ width: '100%', padding: '8px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Add Column</button>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Add Dependency</h4>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <input value={detInput} onChange={(e) => setDetInput(e.target.value)} placeholder="Determinant" style={{ flex: 1, padding: '6px' }} />
                  <input value={depInput} onChange={(e) => setDepInput(e.target.value)} placeholder="Dependent" style={{ flex: 1, padding: '6px' }} />
                </div>
                <button onClick={addDependency} style={{ width: '100%', padding: '8px', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+ Add Dependency</button>
              </div>
            </>
          ) : (
            <>
              {/* DynamoDB NoSQL Panel */}
              <div style={{ marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#8b5cf6' }}>Add DynamoDB Attribute</h4>
                
                <select value={nosqlKeyType} onChange={(e) => setNosqlKeyType(e.target.value)} style={{ width: '100%', padding: '6px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                  <option value="attribute">Standard Attribute</option>
                  <option value="pk">Partition Key (PK) - Required</option>
                  <option value="sk">Sort Key (SK) - Optional</option>
                </select>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <input value={newColName} onChange={(e) => setNewColName(e.target.value)} placeholder="Attribute Name" style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                  <select value={newColType} onChange={(e) => setNewColType(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                    <option value="S">String (S)</option>
                    <option value="N">Number (N)</option>
                    <option value="BOOL">Boolean (BOOL)</option>
                  </select>
                </div>
                
                <button onClick={addNoSQLAttribute} style={{ width: '100%', padding: '8px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Add Attribute</button>
              </div>
            </>
          )}


{/* --- RESTORED VALIDATION BUTTON & RESULTS --- */}
          <button onClick={analyzeTable} style={{ width: '100%', padding: '12px', backgroundColor: dbMode === 'dynamodb' ? '#8b5cf6' : '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '20px' }}>
            Run Validation
          </button>

          {analysisResult && (
           <div style={{ padding: '15px', borderRadius: '8px', backgroundColor: analysisResult.status === 'passed' ? '#dcfce7' : (analysisResult.status === 'analyzing' ? '#f1f5f9' : '#fee2e2'), color: analysisResult.status === 'passed' ? '#166534' : (analysisResult.status === 'analyzing' ? '#475569' : '#991b1b'), marginBottom: '20px' }}>
              <p style={{ fontWeight: 'bold', margin: '0 0 10px 0' }}>Status: {analysisResult.status.toUpperCase()}</p>
              {analysisResult.status === 'passed' && <p style={{ margin: 0 }}>{analysisResult.message}</p>}
              {analysisResult.status === 'failed' && analysisResult.violations?.map((err, i) => <p key={i} style={{ margin: '5px 0', fontSize: '14px' }}>⚠️ {err}</p>)}
            </div>
          )}

          {/* Only show SQLite Sandbox for SQL Mode! */}
          {analysisResult?.status === 'passed' && dbMode === 'sql' && (
            <div style={{ marginTop: '10px', borderTop: '2px dashed #e2e8f0', paddingTop: '20px', marginBottom: '20px' }}>
              <button onClick={deployToSandbox} style={{ width: '100%', padding: '12px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🚀 Deploy to Local SQLite</button>
              {sandboxResult && (
                <>
                  <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#1e293b', color: '#10b981', borderRadius: '8px', fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'pre-wrap' }}>{sandboxResult.sql || sandboxResult.message}</div>
                  {sandboxResult.sql && (
                    <button onClick={downloadSQL} style={{ width: '100%', marginTop: '10px', padding: '10px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>📥 Download .sql File</button>
                  )}
                </>
              )}
            </div>
          )}

          <div style={{ marginTop: 'auto', display: 'flex', gap: '10px' }}>
            <button onClick={deleteTable} style={{ flex: 1, padding: '12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🗑️ Delete</button>
            <button onClick={closePanel} style={{ flex: 1, padding: '12px', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Close</button>
          </div>

        </div>
      )}

      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={onNodeClick} onConnect={onConnect}>
        <Background variant="dots" gap={12} size={1} />
        <Controls />
      </ReactFlow>
      
    </div>
  );
}