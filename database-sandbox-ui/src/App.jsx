import { useState, useCallback, useEffect } from 'react';
import ReactFlow, { Background, Controls, useNodesState, useEdgesState, addEdge } from 'reactflow';
import 'reactflow/dist/style.css';
import TableNode from './TableNode';
import CloudDashboard from './CloudDashboard';
import { useVersionControl } from './useVersionControl';

const customNodeTypes = { customTable: TableNode };
const initialEdgeTypes = {}; 

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(() => JSON.parse(localStorage.getItem('app-nodes')) || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(() => JSON.parse(localStorage.getItem('app-edges')) || []);
  const [dbMode, setDbMode] = useState(() => localStorage.getItem('app-dbMode') || "sql"); 
  
  const [isSecOpsMode, setIsSecOpsMode] = useState(false);
  const [isUnderAttack, setIsUnderAttack] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState("INT");
  const [isPk, setIsPk] = useState(false);
  const [nosqlKeyType, setNosqlKeyType] = useState("attribute"); 

  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // 🕒 VERSION CONTROL HOOK
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const { versions, commitSchema, deleteVersion } = useVersionControl(nodes, edges, dbMode, 'mysql');

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  useEffect(() => { localStorage.setItem('app-nodes', JSON.stringify(nodes)); }, [nodes]);
  useEffect(() => { localStorage.setItem('app-edges', JSON.stringify(edges)); }, [edges]);
  useEffect(() => { localStorage.setItem('app-dbMode', dbMode); }, [dbMode]);

  // 💾 COMMIT LOGIC
  const handleCommit = () => {
    const commit = commitSchema();
    alert(`✅ Successfully committed ${commit.version_id}:\n${commit.change_summary}`);
  };

  const loadVersion = (version) => {
    if (window.confirm(`⚠️ Overwrite current canvas with ${version.version_id}? Make sure you have committed your current work.`)) {
      setNodes(version.nodes);
      setEdges(version.edges);
      setDbMode(version.database_type);
    }
  };

  const onNodeClick = useCallback((event, node) => {
    setSelectedNodeId(node.id);
    setIsPanelOpen(true);
    setAnalysisResult(null);
  }, []);

  const closePanel = () => { setIsPanelOpen(false); setSelectedNodeId(null); setAnalysisResult(null); };

  const updateTableName = (newName) => {
    setNodes((nds) => nds.map((node) => {
      if (node.id === selectedNodeId) return { ...node, data: { ...node.data, label: newName, schema: { ...node.data.schema, name: newName } } };
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
    setNewColName(""); setIsPk(false); 
  };

  const addNoSQLAttribute = () => {
    if (!newColName) return;
    setNodes((nds) => nds.map((node) => {
      if (node.id === selectedNodeId) {
        const updatedSchema = { 
          ...node.data.schema, 
          columns: [...node.data.schema.columns, { name: newColName, data_type: newColType, is_primary_key: nosqlKeyType === 'pk', is_sort_key: nosqlKeyType === 'sk' }] 
        };
        return { ...node, data: { ...node.data, schema: updatedSchema } };
      }
      return node;
    }));
    setNewColName(""); setNosqlKeyType("attribute");
  };

  const addNewTable = () => {
    const newId = Date.now().toString(); 
    const tableNumber = nodes.length + 1;
    const newNode = {
      id: newId, type: 'customTable', 
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 }, 
      data: { label: dbMode === 'sql' ? `New_Table_${tableNumber}` : `Dynamo_Table_${tableNumber}`, schema: { name: `Table_${tableNumber}`, columns: [], dependencies: [], db_mode: dbMode }, isUnderAttack: false }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const onConnect = useCallback((params) => {
    if (dbMode === 'dynamodb') { alert("NoSQL Databases like DynamoDB do not use Foreign Keys!"); return; }
    const styledEdge = { ...params, animated: true, label: 'Foreign Key', style: { stroke: '#8b5cf6', strokeWidth: 2 }, labelStyle: { fill: '#475569', fontWeight: 700, fontSize: 12 } };
    setEdges((eds) => addEdge(styledEdge, eds));
  }, [setEdges, dbMode]);

  const analyzeNormalization = async () => {
    if (!selectedNode) return;
    setIsAnalyzing(true); setAnalysisResult(null);
    try {
      const response = await fetch('http://localhost:8000/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tables: [selectedNode.data.schema], relationships: edges }) });
      const data = await response.json();
      setAnalysisResult(data.analysis || data.message || JSON.stringify(data));
    } catch (error) { setAnalysisResult("❌ Error connecting to Python Normalizer Backend."); }
    setIsAnalyzing(false);
  };

  const generateFromAI = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const response = await fetch('http://localhost:8000/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: aiPrompt }) });
      const data = await response.json();
      if (data.status === 'success' && data.tables) {
        const newNodes = data.tables.map((table, index) => ({
          id: `ai-${Date.now()}-${index}`, type: 'customTable', position: { x: 300 * index + 100, y: 150 }, 
          data: { label: table.name, schema: { name: table.name, columns: table.columns, dependencies: [], db_mode: dbMode }, isUnderAttack: false }
        }));
        setNodes((nds) => [...nds, ...newNodes]); setAiPrompt("");
      } else { alert(data.message || "❌ Failed to generate schema from AI."); }
    } catch (error) { alert("❌ Error connecting to AI Backend."); }
    setIsGenerating(false);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: isSecOpsMode ? '#0f172a' : '#f8fafc', position: 'relative', overflow: 'hidden', transition: 'background-color 0.5s ease' }}>
      
      <CloudDashboard 
        dbMode={dbMode} isSecOpsMode={isSecOpsMode} setIsSecOpsMode={setIsSecOpsMode} 
        isUnderAttack={isUnderAttack} setIsUnderAttack={setIsUnderAttack}
        nodes={nodes} setNodes={setNodes} setEdges={setEdges}
      />  
      
      {/* 🔝 TOP NAVIGATION BAR */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, display: 'flex', gap: '15px', backgroundColor: isSecOpsMode ? '#1e293b' : 'white', padding: '10px 20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', alignItems: 'center', transition: 'all 0.3s ease', flexWrap: 'wrap' }}>
        
        <div style={{ display: 'flex', backgroundColor: isSecOpsMode ? '#334155' : '#e2e8f0', borderRadius: '6px', padding: '4px' }}>
          <button onClick={() => setDbMode('sql')} style={{ padding: '6px 12px', backgroundColor: dbMode === 'sql' ? '#3b82f6' : 'transparent', color: dbMode === 'sql' ? 'white' : (isSecOpsMode ? '#94a3b8' : '#64748b'), border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>SQL</button>
          <button onClick={() => setDbMode('dynamodb')} style={{ padding: '6px 12px', backgroundColor: dbMode === 'dynamodb' ? '#8b5cf6' : 'transparent', color: dbMode === 'dynamodb' ? 'white' : (isSecOpsMode ? '#94a3b8' : '#64748b'), border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>DynamoDB</button>
        </div>
        
        <div style={{ width: '1px', height: '30px', backgroundColor: isSecOpsMode ? '#475569' : '#cbd5e1' }}></div>
        
        <div style={{ display: 'flex', backgroundColor: isSecOpsMode ? '#ef4444' : '#e2e8f0', borderRadius: '6px', padding: '4px', transition: '0.3s' }}>
           <button onClick={() => { setIsSecOpsMode(!isSecOpsMode); setIsUnderAttack(false); }} style={{ padding: '6px 12px', backgroundColor: 'transparent', color: isSecOpsMode ? 'white' : '#64748b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
             🛡️ {isSecOpsMode ? 'SecOps Mode: ON' : 'SecOps Mode: OFF'}
           </button>
        </div>
        
        <div style={{ width: '1px', height: '30px', backgroundColor: isSecOpsMode ? '#475569' : '#cbd5e1' }}></div>
        <button onClick={addNewTable} style={{ padding: '8px 16px', backgroundColor: dbMode === 'dynamodb' ? '#8b5cf6' : '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>+ Create {dbMode === 'dynamodb' ? 'Document' : 'Table'}</button>
        
        <div style={{ width: '1px', height: '30px', backgroundColor: isSecOpsMode ? '#475569' : '#cbd5e1' }}></div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: isSecOpsMode ? '#334155' : '#f1f5f9', padding: '4px 8px', borderRadius: '6px' }}>
          <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Describe app..." disabled={isGenerating} style={{ padding: '6px 10px', borderRadius: '4px', border: `1px solid ${isSecOpsMode ? '#475569' : '#cbd5e1'}`, width: '150px', fontSize: '13px', backgroundColor: isSecOpsMode ? '#1e293b' : 'white', color: isSecOpsMode ? 'white' : 'black', outline: 'none' }} />
          <button onClick={generateFromAI} disabled={isGenerating || !aiPrompt.trim()} style={{ padding: '6px 12px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: isGenerating || !aiPrompt.trim() ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
            {isGenerating ? "⏳..." : "✨ AI Generate"}
          </button>
        </div>

        {/* 🚀 NEW COMMIT AND HISTORY BUTTONS */}
        <div style={{ width: '1px', height: '30px', backgroundColor: isSecOpsMode ? '#475569' : '#cbd5e1' }}></div>
        <button onClick={handleCommit} style={{ padding: '8px 16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          💾 Commit Schema
        </button>
        <button onClick={() => setIsHistoryPanelOpen(!isHistoryPanelOpen)} style={{ padding: '8px 16px', backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          🕒 History ({versions.length})
        </button>

      </div>
      
      {/* 🕒 VERSION HISTORY SIDEBAR */}
      {isHistoryPanelOpen && (
        <div style={{ position: 'absolute', right: 20, top: 80, width: '320px', maxHeight: '70vh', backgroundColor: isSecOpsMode ? '#1e293b' : 'white', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 20, borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: `1px solid ${isSecOpsMode ? '#334155' : '#e2e8f0'}` }}>
          <div style={{ padding: '15px', borderBottom: `1px solid ${isSecOpsMode ? '#334155' : '#e2e8f0'}`, backgroundColor: isSecOpsMode ? '#0f172a' : '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: isSecOpsMode ? 'white' : '#0f172a' }}>Schema History</h3>
            <button onClick={() => setIsHistoryPanelOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>❌</button>
          </div>
          
          <div style={{ overflowY: 'auto', padding: '10px' }}>
            {versions.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#64748b', fontSize: '13px' }}>No commits yet. Save your first version!</p>
            ) : (
              versions.map((v) => (
                <div key={v.version_id} style={{ padding: '12px', borderBottom: `1px solid ${isSecOpsMode ? '#334155' : '#f1f5f9'}`, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: '#3b82f6', fontSize: '14px' }}>{v.version_id}</span>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: isSecOpsMode ? '#cbd5e1' : '#475569' }}>{v.change_summary}</div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button onClick={() => loadVersion(v)} style={{ flex: 1, padding: '4px', fontSize: '12px', backgroundColor: isSecOpsMode ? '#334155' : '#f1f5f9', border: `1px solid ${isSecOpsMode ? '#475569' : '#cbd5e1'}`, borderRadius: '4px', cursor: 'pointer', color: isSecOpsMode ? 'white' : '#0f172a' }}>Load</button>
                    <button onClick={() => deleteVersion(v.version_id)} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', color: '#ef4444' }}>🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 📊 TABLE CONFIGURATION RIGHT PANEL */}
      {isPanelOpen && selectedNode && (
        <div style={{ position: 'absolute', right: 0, top: 0, width: '400px', height: '100vh', backgroundColor: isSecOpsMode ? '#1e293b' : 'white', boxShadow: '-4px 0 15px rgba(0,0,0,0.1)', zIndex: 30, padding: '30px', display: 'flex', flexDirection: 'column', overflowY: 'auto', color: isSecOpsMode ? 'white' : 'black', transition: 'all 0.3s ease' }}>
          <input value={selectedNode.data.label} onChange={(e) => updateTableName(e.target.value)} style={{ fontSize: '24px', fontWeight: 'bold', border: 'none', borderBottom: `2px solid ${dbMode === 'dynamodb' ? '#8b5cf6' : '#3b82f6'}`, marginBottom: '20px', color: isSecOpsMode ? 'white' : '#0f172a', backgroundColor: 'transparent', padding: '5px', outline: 'none', width: '100%' }} />
          
          <div style={{ marginBottom: '20px', backgroundColor: isSecOpsMode ? '#0f172a' : '#f8fafc', padding: '15px', borderRadius: '8px', border: `1px solid ${isSecOpsMode ? '#334155' : '#e2e8f0'}` }}>
            <h4 style={{ margin: '0 0 10px 0', color: isSecOpsMode ? '#94a3b8' : '#475569' }}>Current Schema:</h4>
            {selectedNode.data.schema.columns.map(col => (
              <div key={col.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '4px 0', borderBottom: `1px solid ${isSecOpsMode ? '#334155' : '#f1f5f9'}` }}>
                <span>• {col.name} <span style={{ color: '#64748b' }}>({col.data_type})</span> {col.is_primary_key && <span style={{ color: dbMode === 'dynamodb' ? '#8b5cf6' : '#eab308', fontWeight: 'bold', marginLeft: '5px' }}>[PK]</span>}</span>
                <button onClick={() => deleteColumn(col.name)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>❌</button>
              </div>
            ))}
          </div>

          {dbMode === 'sql' && (
            <div style={{ marginBottom: '20px' }}>
              <button onClick={analyzeNormalization} disabled={isAnalyzing} style={{ width: '100%', padding: '10px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                {isAnalyzing ? "🧠 AI Analyzing..." : "🧠 AI Schema Analysis (1NF/2NF/3NF)"}
              </button>
              {analysisResult && (
                <div style={{ marginTop: '10px', padding: '12px', backgroundColor: isSecOpsMode ? '#422006' : '#fef3c7', color: isSecOpsMode ? '#fde68a' : '#92400e', borderRadius: '6px', border: `1px solid ${isSecOpsMode ? '#78350f' : '#fcd34d'}`, fontSize: '13px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                  {analysisResult}
                </div>
              )}
            </div>
          )}

          {dbMode === 'sql' ? (
            <div style={{ marginBottom: '20px', borderBottom: `1px solid ${isSecOpsMode ? '#334155' : '#e2e8f0'}`, paddingBottom: '15px' }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input value={newColName} onChange={(e) => setNewColName(e.target.value)} placeholder="Col Name" style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: isSecOpsMode ? '#334155' : 'white', color: isSecOpsMode ? 'white' : 'black' }} />
                <select value={newColType} onChange={(e) => setNewColType(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: isSecOpsMode ? '#334155' : 'white', color: isSecOpsMode ? 'white' : 'black' }}>
                  <option>INT</option><option>VARCHAR</option>
                </select>
              </div>
              <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px' }}><input type="checkbox" checked={isPk} onChange={(e) => setIsPk(e.target.checked)} /> Is Primary Key?</label>
              <button onClick={addColumn} style={{ width: '100%', padding: '8px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Add Column</button>
            </div>
          ) : (
             <div style={{ marginBottom: '20px', borderBottom: `1px solid ${isSecOpsMode ? '#334155' : '#e2e8f0'}`, paddingBottom: '15px' }}>
                <select value={nosqlKeyType} onChange={(e) => setNosqlKeyType(e.target.value)} style={{ width: '100%', padding: '6px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: isSecOpsMode ? '#334155' : 'white', color: isSecOpsMode ? 'white' : 'black' }}>
                  <option value="attribute">Standard Attribute</option><option value="pk">Partition Key (PK)</option>
                </select>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <input value={newColName} onChange={(e) => setNewColName(e.target.value)} placeholder="Attribute Name" style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: isSecOpsMode ? '#334155' : 'white', color: isSecOpsMode ? 'white' : 'black' }} />
                  <select value={newColType} onChange={(e) => setNewColType(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: isSecOpsMode ? '#334155' : 'white', color: isSecOpsMode ? 'white' : 'black' }}>
                    <option value="S">String (S)</option><option value="N">Number (N)</option>
                  </select>
                </div>
                <button onClick={addNoSQLAttribute} style={{ width: '100%', padding: '8px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Add Attribute</button>
              </div>
          )}

          <div style={{ marginTop: 'auto', display: 'flex', gap: '10px' }}>
            <button onClick={deleteTable} style={{ flex: 1, padding: '12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🗑️ Delete</button>
            <button onClick={closePanel} style={{ flex: 1, padding: '12px', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Close</button>
          </div>
        </div>
      )}

      <ReactFlow nodes={nodes} edges={edges} nodeTypes={customNodeTypes} edgeTypes={initialEdgeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={onNodeClick} onConnect={onConnect}>
        <Background variant="dots" gap={12} size={1} color={isSecOpsMode ? '#334155' : '#cbd5e1'} style={{ backgroundColor: isSecOpsMode ? '#0f172a' : '#f8fafc' }} />
        <Controls />
      </ReactFlow>
    </div>
  );
}