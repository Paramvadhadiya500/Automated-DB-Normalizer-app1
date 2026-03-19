import React, { useState } from 'react';

const CloudDashboard = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dbInfo, setDbInfo] = useState(null);


  const deleteDatabase = async () => {
  if (!window.confirm("⚠️ Are you sure? This will PERMANENTLY delete your AWS database!")) return;
  
  setLoading(true);
  try {
    const response = await fetch('http://localhost:8000/delete-aws-db', {
      method: 'DELETE',
    });
    const data = await response.json();
    setStatus(data.message);
    setDbInfo(null); // Clear the status info
  } catch (error) {
    setStatus("Error connecting to backend");
  }
  setLoading(false);
};

  const deployToAWS = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/deploy-to-aws', {
        method: 'POST',
      });
      const data = await response.json();
      setStatus(data.message);
    } catch (error) {
      setStatus("Error connecting to backend");
    }
    setLoading(false);
  };

  const checkStatus = async () => {
    try {
      const response = await fetch('http://localhost:8000/check-aws-status');
      const data = await response.json();
      setDbInfo(data);
    } catch (error) {
      console.error("Error checking status", error);
    }
  };

const deploySchemaToCloud = async (currentTableSchema) => {
  if (!dbInfo || !dbInfo.endpoint || dbInfo.endpoint === 'Not ready yet') {
    alert("AWS Database is not ready yet!");
    return;
  }

  try {
    const response = await fetch('http://localhost:8000/api/cloud/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: dbInfo.endpoint,
        table_schema: currentTableSchema // Pass the schema from your state
      }),
    });
    const data = await response.json();
    alert(data.message);
  } catch (error) {
    console.error("Cloud deployment failed", error);
  }
};

  return (
    <div style={{ padding: '20px', border: '2px solid #ff9900', borderRadius: '10px', marginTop: '20px', backgroundColor: '#fffaf0' }}>
      <h2 style={{ color: '#ff9900' }}>☁️ AWS RDS Control Center</h2>
      <p>Target: <strong>nensiera-cafe-db</strong></p>
      
      <div style={{ display: 'flex', gap: '10px' }}>
        <button 
          onClick={deployToAWS} 
          disabled={loading}
          style={{ padding: '10px', backgroundColor: '#ff9900', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
        >
          {loading ? "🚀 Provisioning..." : "🚀 Deploy to AWS RDS"}
        </button>

        <button 
          onClick={checkStatus}
          style={{ padding: '10px', backgroundColor: '#232f3e', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
        >
          🔄 Refresh Status
        </button>
      </div>

      {status && <p style={{ marginTop: '15px', color: 'green' }}>{status}</p>}

      {dbInfo && (
        <div style={{ marginTop: '15px', fontSize: '14px', textAlign: 'left' }}>
          <p><strong>AWS Status:</strong> {dbInfo.status}</p>
          <p><strong>Endpoint:</strong> {dbInfo.endpoint}</p>
          {dbInfo.status === 'creating' && <p>⏳ <em>Note: AWS takes about 5-10 minutes to finish creating a database.</em></p>}
        </div>
      )}
    </div>
  );
};

export default CloudDashboard;