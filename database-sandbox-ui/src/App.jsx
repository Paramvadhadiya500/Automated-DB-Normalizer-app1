import { useState, useCallback } from 'react';
import ReactFlow, { Background, Controls, useNodesState, useEdgesState, addEdge } from 'reactflow';
import { toPng } from 'html-to-image';
import 'reactflow/dist/style.css';
import TableNode from './TableNode';
import CloudDashboard from './CloudDashboard';

// ✅ React Flow Warning Fix
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
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [sandboxResult, setSandboxResult] = useState(null); 

  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState("INT");
  const [isPk, setIsPk] = useState(false);
  const [detInput, setDetInput] = useState("");
  const [depInput, setDepInput] = useState("");

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

  // --- TEMPLATE & EXPORT LOGIC ---
  const loadCafeTemplate = () => {
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

  // --- DYNAMIC FUNCTIONS ---
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
  };

  const addNewTable = () => {
    const newId = Date.now().toString(); 
    const tableNumber = nodes.length + 1;
    const newNode = {
      id: newId, type: 'customTable', 
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 }, 
      data: { label: `New_Table_${tableNumber}`, schema: { name: `New_Table_${tableNumber}`, columns: [], dependencies: [] } }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const onConnect = useCallback((params) => {
    const styledEdge = { ...params, animated: true, label: 'Foreign Key', style: { stroke: '#8b5cf6', strokeWidth: 2 }, labelStyle: { fill: '#475569', fontWeight: 700, fontSize: 12 } };
    setEdges((eds) => addEdge(styledEdge, eds));
  }, [setEdges]);

  // --- API CALLS ---
  const analyzeTable = async () => {
    if (!selectedNode) return;
    setAnalysisResult({ status: "analyzing", message: "Analyzing..." });
    setSandboxResult(null); 
    try {
      const response = await fetch("http://127.0.0.1:8000/api/normalize/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selectedNode.data.schema)
      });
      const data = await response.json();
      setAnalysisResult(data);
    } catch (error) { setAnalysisResult({ status: "error", message: "Failed to connect to API." }); }
  };

  const deployToSandbox = async () => {
    setSandboxResult({ status: "deploying", message: "Spinning up database..." });
    try {
      const response = await fetch("http://127.0.0.1:8000/api/sandbox/deploy", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selectedNode.data.schema)
      });
      const data = await response.json();
      setSandboxResult(data);
    } catch (error) { setSandboxResult({ status: "error", message: "Sandbox deployment failed." }); }
  };

  const downloadSQL = () => {
    if (!sandboxResult || !sandboxResult.sql) return;
    const blob = new Blob([sandboxResult.sql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${selectedNode.data.schema.name}_schema.sql`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#f8fafc', position: 'relative', overflow: 'hidden' }}>
      <CloudDashboard />  
      
      {/* Floating Top Menu (UPGRADED) */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, display: 'flex', gap: '10px', backgroundColor: 'white', padding: '10px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <button onClick={addNewTable} style={{ padding: '8px 16px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          + Create New Table
        </button>
        <button onClick={loadCafeTemplate} style={{ padding: '8px 16px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          ☕ Load Cafe Template
        </button>
        <button onClick={exportImage} style={{ padding: '8px 16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          📸 Export Architecture Diagram
        </button>
      </div>
      
      {/* Side Panel */}
      {isPanelOpen && selectedNode && (
        <div style={{ position: 'absolute', right: 0, top: 0, width: '400px', height: '100vh', backgroundColor: 'white', boxShadow: '-4px 0 15px rgba(0,0,0,0.1)', zIndex: 20, padding: '30px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <h2 style={{ marginTop: 0, color: '#0f172a' }}>{selectedNode.data.label}</h2>
          
          <div style={{ marginBottom: '20px', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#475569' }}>Current Schema:</h4>
            {selectedNode.data.schema.columns.map(col => (
              <div key={col.name} style={{ fontSize: '13px', padding: '2px 0' }}>
                • {col.name} ({col.data_type}) {col.is_primary_key && <span style={{ color: '#eab308', fontWeight: 'bold' }}>[PK]</span>}
              </div>
            ))}
            {selectedNode.data.schema.dependencies.map((dep, i) => (
               <div key={i} style={{ fontSize: '13px', padding: '2px 0', color: '#64748b' }}>↳ {dep.determinants[0]} ➔ {dep.dependents[0]}</div>
            ))}
          </div>

          <div style={{ marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Add New Column</h4>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input value={newColName} onChange={(e) => setNewColName(e.target.value)} placeholder="Col Name" style={{ flex: 1, padding: '6px' }} />
              <select value={newColType} onChange={(e) => setNewColType(e.target.value)} style={{ padding: '6px' }}>
                <option>INT</option><option>VARCHAR</option><option>LIST</option>
              </select>
            </div>
            <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px' }}>
              <input type="checkbox" checked={isPk} onChange={(e) => setIsPk(e.target.checked)} /> Is Primary Key?
            </label>
            <button onClick={addColumn} style={{ width: '100%', padding: '8px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+ Add Column</button>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Add Dependency</h4>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input value={detInput} onChange={(e) => setDetInput(e.target.value)} placeholder="Determinant (e.g., id)" style={{ flex: 1, padding: '6px' }} />
              <input value={depInput} onChange={(e) => setDepInput(e.target.value)} placeholder="Dependent (e.g., name)" style={{ flex: 1, padding: '6px' }} />
            </div>
            <button onClick={addDependency} style={{ width: '100%', padding: '8px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+ Add Dependency</button>
          </div>

          <button onClick={analyzeTable} style={{ width: '100%', padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '20px' }}>Run Validation</button>

          {analysisResult && (
           <div style={{ padding: '15px', borderRadius: '8px', backgroundColor: analysisResult.status === 'passed' ? '#dcfce7' : (analysisResult.status === 'analyzing' ? '#f1f5f9' : '#fee2e2'), color: analysisResult.status === 'passed' ? '#166534' : (analysisResult.status === 'analyzing' ? '#475569' : '#991b1b'), marginBottom: '20px' }}>
              <p style={{ fontWeight: 'bold', margin: '0 0 10px 0' }}>Status: {analysisResult.status.toUpperCase()}</p>
              {analysisResult.status === 'passed' && <p style={{ margin: 0 }}>{analysisResult.message}</p>}
              {analysisResult.status === 'failed' && analysisResult.violations?.map((err, i) => <p key={i} style={{ margin: '5px 0', fontSize: '14px' }}>⚠️ {err}</p>)}
            </div>
          )}

          {analysisResult?.status === 'passed' && (
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

          <button onClick={closePanel} style={{ marginTop: 'auto', padding: '12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Close Panel</button>
        </div>
      )}

      {/* Canvas */}
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={onNodeClick} onConnect={onConnect}>
        <Background variant="dots" gap={12} size={1} />
        <Controls />
      </ReactFlow>
      
    </div>
  );
}