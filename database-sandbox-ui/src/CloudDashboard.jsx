import React, { useState } from 'react';

const CloudDashboard = ({ dbMode }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dbInfo, setDbInfo] = useState(null);
  
  const [dbName, setDbName] = useState("nensiera-cafe-db");
  const [vpcId, setVpcId] = useState(""); 
  const [dbEngine, setDbEngine] = useState("postgres");

  const [showInjector, setShowInjector] = useState(false);
  const [jsonData, setJsonData] = useState('{\n  "id": "test_user_01",\n  "name": "Nensi",\n  "role": "Admin",\n  "favorite_coffee": "Espresso"\n}');
  const [insertStatus, setInsertStatus] = useState(null);

  const actualEngine = dbMode === 'dynamodb' ? 'dynamodb' : dbEngine;

  const deployToAWS = async () => { 
    setLoading(true); setStatus(null); 
    const payload = { db_name: dbName, db_engine: actualEngine };
    if (dbMode === 'sql' && vpcId.trim() !== "") payload.vpc_sg_id = vpcId.trim();

    try {
      const response = await fetch('http://localhost:8000/deploy-to-aws', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      setStatus(data.message || "Command sent to AWS!");
    } catch (error) { setStatus("Error connecting to backend."); }
    setLoading(false);
  };

  const checkStatus = async () => { 
    try {
      const response = await fetch(`http://localhost:8000/check-aws-status?db_name=${dbName}&db_engine=${actualEngine}`);
      const data = await response.json();
      setDbInfo(data);
    } catch (error) { console.error("Error checking status", error); }
  };

  const deleteDatabase = async () => { 
    if (!window.confirm(`⚠️ Are you sure? This will PERMANENTLY delete ${dbName}!`)) return;
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/delete-aws-db?db_name=${dbName}&db_engine=${actualEngine}`, { method: 'DELETE' });
      const data = await response.json();
      setStatus(data.message);
      setDbInfo(null); setShowInjector(false);
    } catch (error) { setStatus("Error connecting to backend"); }
    setLoading(false);
  };

  const downloadTerraform = async () => { 
    try {
      const response = await fetch('http://localhost:8000/api/cloud/terraform', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db_name: dbName, db_engine: actualEngine }) });
      const data = await response.json();
      const blob = new Blob([data.terraform_code], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${dbName}_infra.tf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (error) { console.error("Error downloading Terraform", error); }
  };

  const injectData = async () => {
    setInsertStatus("Injecting...");
    try {
      const parsedPayload = JSON.parse(jsonData);
      const response = await fetch('http://localhost:8000/api/cloud/insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          db_name: dbName,
          db_engine: actualEngine,
          payload: parsedPayload
        })
      });
      const data = await response.json();
      setInsertStatus(data.status === 'success' ? `✅ ${data.message}` : `❌ ${data.message}`);
    } catch (error) {
      setInsertStatus("❌ Invalid JSON format! Check your syntax.");
    }
  };

  return (
    <div style={{ padding: '20px', border: `2px solid ${dbMode === 'dynamodb' ? '#8b5cf6' : '#3b82f6'}`, borderRadius: '10px', marginTop: '20px', backgroundColor: dbMode === 'dynamodb' ? '#f3e8ff' : '#eff6ff', position: 'relative' }}>
      <h2 style={{ color: dbMode === 'dynamodb' ? '#4c1d95' : '#1e3a8a', marginTop: 0 }}>☁️ Enterprise Cloud Architect Center</h2>
      
      <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', color: '#475569' }}>Database Name:</label>
          <input type="text" value={dbName} onChange={(e) => setDbName(e.target.value)} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #cbd5e1', width: '200px', fontSize: '13px' }} />
        </div>

        {dbMode === 'sql' ? (
          <>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', color: '#475569' }}>Engine:</label>
              <select value={dbEngine} onChange={(e) => setDbEngine(e.target.value)} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: 'white', color: 'black' }}>
                <option value="postgres">PostgreSQL</option><option value="mysql">MySQL</option><option value="mariadb">MariaDB</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', color: '#475569' }}>VPC Security Group (Optional):</label>
              <input type="text" placeholder="sg-..." value={vpcId} onChange={(e) => setVpcId(e.target.value)} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #cbd5e1', width: '200px', fontSize: '13px' }} />
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', backgroundColor: '#8b5cf6', color: 'white', borderRadius: '5px', fontSize: '13px', fontWeight: 'bold' }}>
            ⚡ Serverless NoSQL Mode Active
          </div>
        )}
      </div>
      
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={deployToAWS} disabled={loading} style={{ padding: '10px 15px', backgroundColor: dbMode === 'dynamodb' ? '#8b5cf6' : '#f59e0b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
          {loading ? "🚀 Provisioning..." : `🚀 Deploy ${dbMode === 'dynamodb' ? 'DYNAMODB' : dbEngine.toUpperCase()}`}
        </button>
        <button onClick={checkStatus} style={{ padding: '10px 15px', backgroundColor: '#1e293b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>🔄 Refresh Status</button>
        <button onClick={downloadTerraform} style={{ padding: '10px 15px', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>🏗️ Export Terraform (.tf)</button>
        <button onClick={deleteDatabase} disabled={loading} style={{ padding: '10px 15px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', marginLeft: 'auto' }}>🗑️ Destroy Infra</button>
      </div>

      {status && <p style={{ marginTop: '15px', color: status.includes('Error') ? '#ef4444' : '#166534', fontWeight: 'bold' }}>{status}</p>}

      {dbInfo && (
        <div style={{ marginTop: '15px', fontSize: '14px', textAlign: 'left', backgroundColor: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          {dbInfo.error ? (
            <p style={{ margin: 0, color: '#ef4444', fontWeight: 'bold' }}>Error: {dbInfo.error}</p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: '0 0 5px 0' }}><strong>AWS Status:</strong> <span style={{ color: dbInfo.status?.toLowerCase() === 'available' || dbInfo.status?.toLowerCase() === 'active' ? '#10b981' : '#f59e0b' }}>{dbInfo.status ? dbInfo.status.toUpperCase() : 'UNKNOWN'}</span></p>
                  <p style={{ margin: '0 0 5px 0' }}><strong>Endpoint/ARN:</strong> {dbInfo.endpoint || 'Not ready yet'}</p>
                </div>
                
                {/* 🆕 THE DATA INJECTOR TOGGLE BUTTON */}
                {dbMode === 'dynamodb' && dbInfo.status?.toLowerCase() === 'active' && (
                  <button onClick={() => setShowInjector(!showInjector)} style={{ padding: '8px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {showInjector ? "Close Injector" : "💉 Inject Test Data"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* 🆕 THE DATA INJECTION UI PANEL */}
      {showInjector && (
        <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#10b981' }}>Live AWS Data Injector</h4>
          <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#94a3b8' }}>Write standard JSON. The "id" field is required as the Partition Key.</p>
          
          <textarea 
            value={jsonData} 
            onChange={(e) => setJsonData(e.target.value)}
            style={{ width: '100%', height: '120px', padding: '10px', borderRadius: '5px', backgroundColor: '#0f172a', color: '#38bdf8', fontFamily: 'monospace', border: '1px solid #475569', fontSize: '13px', resize: 'vertical' }}
          />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: insertStatus?.includes('❌') ? '#ef4444' : '#10b981' }}>
              {insertStatus}
            </span>
            <button onClick={injectData} style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
              Send to AWS
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CloudDashboard;