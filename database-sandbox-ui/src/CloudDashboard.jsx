import React, { useState } from 'react';

const CloudDashboard = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dbInfo, setDbInfo] = useState(null);
  
  const [dbName, setDbName] = useState("nensiera-cafe-db");
  const [vpcId, setVpcId] = useState(""); 
  const [dbEngine, setDbEngine] = useState("postgres");

  const deployToAWS = async () => {
    setLoading(true);
    setStatus(null); // Clear old status
    
    // THE 422 FIX: We build the payload dynamically.
    // If VPC is empty, we completely remove it from the package so Python doesn't complain!
    const payload = {
      db_name: dbName,
      db_engine: dbEngine
    };
    if (vpcId.trim() !== "") {
      payload.vpc_sg_id = vpcId.trim();
    }

    try {
      const response = await fetch('http://localhost:8000/deploy-to-aws', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) // Send the clean package
      });
      
      // If the backend still throws a 422, let's catch it gracefully without crashing
      if (!response.ok) {
        setStatus(`Server Error: ${response.status}`);
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      setStatus(data.message || "Command sent to AWS!");
    } catch (error) {
      setStatus("Error connecting to backend.");
    }
    setLoading(false);
  };

  const checkStatus = async () => {
    try {
      // THE FIX: We add ?db_name=${dbName} to the end of the URL
      const response = await fetch(`http://localhost:8000/check-aws-status?db_name=${dbName}`);
      const data = await response.json();
      setDbInfo(data);
    } catch (error) {
      console.error("Error checking status", error);
    }
  };

  const deleteDatabase = async () => {
    if (!window.confirm(`⚠️ Are you sure? This will PERMANENTLY delete ${dbName}!`)) return;
    setLoading(true);
    try {
      // THE FIX: We add ?db_name=${dbName} here too!
      const response = await fetch(`http://localhost:8000/delete-aws-db?db_name=${dbName}`, { method: 'DELETE' });
      const data = await response.json();
      setStatus(data.message);
      setDbInfo(null); 
    } catch (error) {
      setStatus("Error connecting to backend");
    }
    setLoading(false);
  };

  const downloadTerraform = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/cloud/terraform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ db_name: dbName, db_engine: dbEngine })
      });
      const data = await response.json();
      
      const blob = new Blob([data.terraform_code], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dbName}_infra.tf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading Terraform", error);
    }
  };

  return (
    <div style={{ padding: '20px', border: '2px solid #3b82f6', borderRadius: '10px', marginTop: '20px', backgroundColor: '#eff6ff', position: 'relative' }}>
      <h2 style={{ color: '#1e3a8a', marginTop: 0 }}>☁️ Enterprise Cloud Architect Center</h2>
      
      <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        
        <div>
          <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', color: '#475569' }}>Database Name:</label>
          <input type="text" value={dbName} onChange={(e) => setDbName(e.target.value)} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #cbd5e1', width: '200px', fontSize: '13px' }} />
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', color: '#475569' }}>Engine:</label>
          <select value={dbEngine} onChange={(e) => setDbEngine(e.target.value)} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: 'white', color: 'black' }}>
            <option value="postgres">PostgreSQL</option>
            <option value="mysql">MySQL</option>
            <option value="mariadb">MariaDB</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', color: '#475569' }}>VPC Security Group (Optional):</label>
          <input type="text" placeholder="sg-..." value={vpcId} onChange={(e) => setVpcId(e.target.value)} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #cbd5e1', width: '200px', fontSize: '13px' }} />
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={deployToAWS} disabled={loading} style={{ padding: '10px 15px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
          {loading ? "🚀 Provisioning..." : `🚀 Deploy ${dbEngine.toUpperCase()}`}
        </button>

        <button onClick={checkStatus} style={{ padding: '10px 15px', backgroundColor: '#1e293b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
          🔄 Refresh Status
        </button>

        <button onClick={downloadTerraform} style={{ padding: '10px 15px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
          🏗️ Export Terraform (.tf)
        </button>

        <button onClick={deleteDatabase} disabled={loading} style={{ padding: '10px 15px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', marginLeft: 'auto' }}>
          🗑️ Destroy Infra
        </button>
      </div>

      {status && <p style={{ marginTop: '15px', color: status.includes('Error') ? '#ef4444' : '#166534', fontWeight: 'bold' }}>{status}</p>}

      {/* THE REACT CRASH FIX: Safely check if dbInfo.status exists before uppercasing it */}
      {dbInfo && (
        <div style={{ marginTop: '15px', fontSize: '14px', textAlign: 'left', backgroundColor: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          {dbInfo.error ? (
            <p style={{ margin: 0, color: '#ef4444', fontWeight: 'bold' }}>Error: {dbInfo.error}</p>
          ) : (
            <>
              <p style={{ margin: '0 0 5px 0' }}><strong>AWS Status:</strong> <span style={{ color: dbInfo.status === 'available' ? '#10b981' : '#f59e0b' }}>{dbInfo.status ? dbInfo.status.toUpperCase() : 'UNKNOWN'}</span></p>
              <p style={{ margin: '0 0 5px 0' }}><strong>Endpoint:</strong> {dbInfo.endpoint || 'Not ready yet'}</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>🔒 Password generated and encrypted via AWS Systems Manager.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CloudDashboard;