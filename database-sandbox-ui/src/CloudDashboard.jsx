import React, { useState, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { compareSchemas, generateMigrationSQL } from './migrationUtils';

const CloudDashboard = ({ dbMode, isSecOpsMode, setIsSecOpsMode, isUnderAttack, setIsUnderAttack, nodes, setNodes, setEdges }) => {
  // 💰 FinOps & CRUD State
  const [finopsData, setFinopsData] = useState(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [crudFramework, setCrudFramework] = useState("express");
  const [isGeneratingCrud, setIsGeneratingCrud] = useState(false);
  
  // ☁️ Cloud State
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dbName, setDbName] = useState(() => localStorage.getItem('cloud-dbName') || "youshouuld");
  const [dbEngine, setDbEngine] = useState(() => localStorage.getItem('cloud-dbEngine') || "mysql");
  const [vpcId, setVpcId] = useState(() => localStorage.getItem('cloud-vpcId') || "");
  const [dbInfo, setDbInfo] = useState(() => JSON.parse(localStorage.getItem('cloud-dbInfo')) || null);

  // 💉 Data Injector State
  const [showInjector, setShowInjector] = useState(false);
  const [jsonData, setJsonData] = useState('{\n  "id": "test_user_01",\n  "name": "Nensi"\n}');
  const [insertStatus, setInsertStatus] = useState(null);
  
  // 🛡️ SecOps State
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [iamAuth, setIamAuth] = useState(false);
  const [hasBackups, setHasBackups] = useState(false);
  const [deletionLock, setDeletionLock] = useState(false);
  const [securityReport, setSecurityReport] = useState(null);
  
  // 📡 Observability State
  const [isObserving, setIsObserving] = useState(false);
  const [metricsHistory, setMetricsHistory] = useState([]);
  const [currentMetrics, setCurrentMetrics] = useState(null);

  // 🔄 Migration Engine State
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [lastDeployedNodes, setLastDeployedNodes] = useState(() => JSON.parse(localStorage.getItem('cloud-lastDeployedNodes')) || []);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [migrationData, setMigrationData] = useState(null);

  const actualEngine = dbMode === 'dynamodb' ? 'dynamodb' : dbEngine;

  // 💾 Local Storage Sync
  useEffect(() => { localStorage.setItem('cloud-dbName', dbName); }, [dbName]);
  useEffect(() => { localStorage.setItem('cloud-dbEngine', dbEngine); }, [dbEngine]);
  useEffect(() => { localStorage.setItem('cloud-vpcId', vpcId); }, [vpcId]);
  useEffect(() => { localStorage.setItem('cloud-dbInfo', JSON.stringify(dbInfo)); }, [dbInfo]);
  useEffect(() => { localStorage.setItem('cloud-lastDeployedNodes', JSON.stringify(lastDeployedNodes)); }, [lastDeployedNodes]);

  // 🛡️ SecOps Logic
  const calculateScore = () => {
    if (!nodes || nodes.length === 0) return 0;
    let score = 10;
    if (vpcId.trim() !== "") score += 20;
    if (isEncrypted) score += 20;
    if (iamAuth) score += 15;
    if (hasBackups) score += 20;
    if (deletionLock) score += 15;
    return score;
  };

  const currentScore = calculateScore();
  const isSecured = currentScore === 100;

  useEffect(() => {
    if (isSecured && isSecOpsMode) {
      setIsUnderAttack(false);
      setNodes(nds => nds.map(node => ({ ...node, data: { ...node.data, isUnderAttack: false, vulnerabilityWarning: null }, style: { ...node.style, border: '2px solid #10b981', boxShadow: '0 0 20px rgba(16, 185, 129, 0.6)' } })));
      setEdges(eds => eds.map(edge => ({ ...edge, animated: true, style: { stroke: '#10b981', strokeWidth: 3 } })));
    }
  }, [isSecured, isSecOpsMode, setNodes, setEdges, setIsUnderAttack]);

  // 📡 Observability Polling
  useEffect(() => {
    let interval;
    if (isObserving && dbInfo && dbInfo.endpoint) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`http://localhost:8000/api/observability/metrics?endpoint=${dbInfo.endpoint}&engine=${actualEngine}`);
          const result = await res.json();
          if (result.status === 'success') {
            setCurrentMetrics(result.data);
            setMetricsHistory(prev => {
              const newHistory = [...prev, result.data];
              return newHistory.length > 15 ? newHistory.slice(newHistory.length - 15) : newHistory;
            });
          }
        } catch (e) { console.error("Observability connection failed"); }
      }, 3000); 
    }
    return () => clearInterval(interval);
  }, [isObserving, dbInfo, actualEngine]);

  // 💰 FinOps Engine
  const runFinOpsEstimate = async () => {
    setIsEstimating(true); setFinopsData(null);
    try {
      const payload = { database_type: dbMode === 'sql' ? 'relational' : 'nosql', engine: dbMode === 'sql' ? dbEngine : 'dynamodb', multi_az: hasBackups, backup_enabled: hasBackups };
      const response = await fetch('http://localhost:8000/api/finops/estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (data.status === 'success') { setFinopsData(data.data); } else { alert("FinOps Error: " + data.message); }
    } catch (error) { alert("Could not connect to FinOps Engine."); }
    setIsEstimating(false);
  };

  // ⚡ CRUD Generator
  const downloadCrudApi = async () => {
    if (!nodes || nodes.length === 0) { alert("Please add some tables to the canvas first!"); return; }
    setIsGeneratingCrud(true); setStatus(`Generating ${crudFramework === 'express' ? 'Node.js' : 'FastAPI'} backend...`);
    try {
      const response = await fetch('http://localhost:8000/api/generate-crud', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ framework: crudFramework, nodes: nodes }) });
      const data = await response.json();
      if (data.status === 'success') {
        const blob = new Blob([data.code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = data.filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        setStatus(`✅ ${data.filename} generated successfully!`);
      } else { alert("Generator Error: " + data.message); setStatus("Generation failed."); }
    } catch (error) { alert("Could not connect to API Generator."); setStatus("Generation failed."); }
    setIsGeneratingCrud(false);
  };

  // ☁️ Cloud Deployer
  const deployToAWS = async () => {
    setLoading(true); setStatus("Deploying...");
    const payload = { db_name: dbName, db_engine: actualEngine, vpc_sg_id: vpcId, is_encrypted: isEncrypted, iam_auth: iamAuth, has_backups: hasBackups, deletion_lock: deletionLock };
    try {
      const response = await fetch('http://localhost:8000/deploy-to-aws', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      setStatus(data.message || "Command sent to AWS!");
    } catch (error) { setStatus("Error connecting to backend for deploy."); }
    setLoading(false);
  };

  const checkStatus = async () => {
    setStatus("Checking AWS Status...");
    try {
      const response = await fetch(`http://localhost:8000/check-aws-status?db_name=${dbName}&db_engine=${actualEngine}`);
      if (!response.ok) { setStatus(`Error: Backend returned ${response.status}`); return; }
      const data = await response.json(); setDbInfo(data); setStatus(`Status Updated for ${dbName}`);
    } catch (error) { setStatus("Error: Cannot reach Python backend."); }
  };

  const downloadTerraform = async () => {
    setStatus("Generating Terraform...");
    try {
      const response = await fetch('http://localhost:8000/api/cloud/terraform', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db_name: dbName, db_engine: actualEngine }) });
      if (!response.ok) { setStatus("Terraform generation failed on backend."); return; }
      const data = await response.json();
      const blob = new Blob([data.terraform_code], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${dbName}_infra.tf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      setStatus("Terraform exported successfully!");
    } catch (error) { setStatus("Error downloading Terraform"); }
  };

  const deleteDatabase = async () => {
    if (!window.confirm(`⚠️ PERMANENTLY delete ${dbName}?`)) return;
    setLoading(true); setStatus("Deleting...");
    try {
      const response = await fetch(`http://localhost:8000/delete-aws-db?db_name=${dbName}&db_engine=${actualEngine}`, { method: 'DELETE' });
      const data = await response.json(); setStatus(data.message); setDbInfo(null); setIsObserving(false);
    } catch (error) { setStatus("Error deleting database."); }
    setLoading(false);
  };

  // 🔄 Initial Schema Push
  const pushSchemaToAWS = async () => {
    if (!dbInfo || !dbInfo.endpoint) { alert("Wait for the database to become 'Available' first!"); return; }
    setMigrationStatus("Migrating Schema...");
    try {
      const response = await fetch('http://localhost:8000/api/cloud/migrate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: dbInfo.endpoint, db_engine: actualEngine, nodes: nodes })
      });
      const data = await response.json();
      if (data.status === 'success') {
        setMigrationStatus(`✅ ${data.message}`);
        setLastDeployedNodes(nodes); // Baseline established
      } else {
        setMigrationStatus(`❌ ${data.message}`);
      }
    } catch (error) { setMigrationStatus("❌ Cannot reach Python backend to migrate."); }
  };

  // 🔄 Open Migration Engine Modal
  const openMigrationCenter = () => {
    const diff = compareSchemas(lastDeployedNodes, nodes);
    const sqlData = generateMigrationSQL(diff, actualEngine);
    setMigrationData(sqlData);
    setIsMigrationModalOpen(true);
  };

  // 🔄 Execute Migration to Live DB
  const applyLiveMigration = async () => {
    setMigrationStatus("Applying Live Migration...");
    setIsMigrationModalOpen(false);
    try {
      const response = await fetch('http://localhost:8000/api/cloud/execute-migration', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: dbInfo.endpoint, db_engine: actualEngine, sql_statements: migrationData.forward_sql })
      });
      const data = await response.json();
      if (data.status === 'success') {
        setMigrationStatus(data.message);
        setLastDeployedNodes(nodes); // Update Baseline
      } else {
        alert(data.message);
        setMigrationStatus("❌ Migration Failed & Rolled Back.");
      }
    } catch (error) { setMigrationStatus("❌ Cannot reach Python Migration Engine."); }
  };

  // 💉 DynamoDB Injector
  const injectData = async () => {
    setInsertStatus("Injecting...");
    try {
      const parsedPayload = JSON.parse(jsonData);
      const response = await fetch('http://localhost:8000/api/cloud/insert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db_name: dbName, db_engine: actualEngine, payload: parsedPayload }) });
      const data = await response.json(); setInsertStatus(data.status === 'success' ? `✅ ${data.message}` : `❌ ${data.message}`);
    } catch (error) { setInsertStatus("❌ Invalid JSON format! Check your syntax."); }
  };

  // 🛡️ SecOps Triggers
  const triggerAttack = async () => { 
     if (!nodes || nodes.length === 0) { alert("Add a table!"); return; }
     setLoading(true);
     try {
       const payload = { db_name: dbName, db_engine: actualEngine, vpc_sg_id: vpcId, is_encrypted: isEncrypted, iam_auth: iamAuth, has_backups: hasBackups, deletion_lock: deletionLock };
       const response = await fetch('http://localhost:8000/api/security/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
       const data = await response.json();
       setSecurityReport(data); setIsUnderAttack(true);
       if (data.score === 100) { alert("Simulation Failed: Architecture is secured!"); } 
       else {
         setNodes(nds => nds.map(node => ({ ...node, data: { ...node.data, isUnderAttack: true, vulnerabilityWarning: data.warnings[0] }, style: { ...node.style, border: '2px solid #ef4444', boxShadow: '0 0 20px rgba(239, 68, 68, 0.8)' } })));
         setEdges(eds => eds.map(edge => ({ ...edge, animated: true, style: { stroke: '#ef4444', strokeWidth: 3 } })));
       }
     } catch (error) { alert("Error connecting to Python Security Engine."); }
     setLoading(false);
  };

  const triggerAutoSecure = () => {
    setVpcId("sg-secure-0x9a8b7c"); setIsEncrypted(true); setIamAuth(true); setHasBackups(true); setDeletionLock(true);
    setSecurityReport({ score: 100, status: "secured", warnings: [], message: "✅ Security Applied" });
  };

  if (isSecOpsMode) {
    return (
      <div style={{ padding: '20px', border: `2px solid ${isSecured ? '#10b981' : '#ef4444'}`, borderRadius: '10px', marginTop: '20px', backgroundColor: '#1e293b', position: 'relative', color: 'white', zIndex: 50, transition: 'all 0.4s ease' }}>
        <button onClick={() => { setIsSecOpsMode(false); setIsUnderAttack(false); setSecurityReport(null); }} style={{ position: 'absolute', top: '20px', right: '20px', padding: '8px 12px', backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>❌ Exit SecOps Mode</button>
        <h2 style={{ color: isSecured ? '#10b981' : '#ef4444', marginTop: 0 }}>{isSecured ? '🛡️ Architecture Secured' : '🛡️ DevSecOps Threat Modeler'}</h2>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', marginTop: '20px' }}>
          <div style={{ flex: 1, backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#94a3b8' }}>AWS Well-Architected Security Score</h4>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: currentScore >= 80 ? '#10b981' : (currentScore > 30 ? '#f59e0b' : '#ef4444') }}>{currentScore}/100</div>
            {securityReport && securityReport.warnings.length > 0 && !isSecured && (
               <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#450a0a', borderRadius: '5px', border: '1px solid #7f1d1d' }}>
                 {securityReport.warnings.map((warn, i) => <p key={i} style={{ fontSize: '11px', color: '#fca5a5', margin: '2px 0' }}>{warn}</p>)}
               </div>
            )}
            <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: vpcId !== "" ? '#10b981' : '#94a3b8' }}><input type="checkbox" checked={vpcId !== ""} onChange={() => setVpcId(vpcId === "" ? "sg-manual-vpc" : "")} /> Private Subnet (VPC)</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isEncrypted ? '#10b981' : '#94a3b8' }}><input type="checkbox" checked={isEncrypted} onChange={(e) => setIsEncrypted(e.target.checked)} /> KMS Data Encryption</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: iamAuth ? '#10b981' : '#94a3b8' }}><input type="checkbox" checked={iamAuth} onChange={(e) => setIamAuth(e.target.checked)} /> IAM Auth (No Passwords)</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasBackups ? '#10b981' : '#94a3b8' }}><input type="checkbox" checked={hasBackups} onChange={(e) => setHasBackups(e.target.checked)} /> Point-in-Time Recovery</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: deletionLock ? '#10b981' : '#94a3b8' }}><input type="checkbox" checked={deletionLock} onChange={(e) => setDeletionLock(e.target.checked)} /> Deletion Protection Lock</label>
            </div>
          </div>
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
            <button onClick={triggerAttack} disabled={loading || isSecured} style={{ padding: '15px', backgroundColor: (isSecured) ? '#334155' : '#ef4444', color: (isSecured) ? '#64748b' : 'white', border: 'none', borderRadius: '5px', cursor: (isSecured) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px', textTransform: 'uppercase' }}>{loading ? 'Scanning...' : '👾 1. Scan & Simulate Attack'}</button>
            <button onClick={triggerAutoSecure} disabled={isSecured} style={{ padding: '15px', backgroundColor: isSecured ? '#10b981' : '#334155', color: isSecured ? 'white' : '#64748b', border: 'none', borderRadius: '5px', cursor: isSecured ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px' }}>{isSecured ? '✅ Architecture Hardened' : '🛡️ 2. Auto-Secure Architecture'}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', border: `2px solid ${dbMode === 'dynamodb' ? '#8b5cf6' : '#3b82f6'}`, borderRadius: '10px', marginTop: '20px', backgroundColor: dbMode === 'dynamodb' ? '#f3e8ff' : '#eff6ff', position: 'relative' }}>
      
      {/* 🔄 MIGRATION MODAL UI */}
      {isMigrationModalOpen && migrationData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '800px', maxWidth: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0, color: '#0f172a' }}>🔄 Schema Migration Review</h2>
              <button onClick={() => setIsMigrationModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>❌</button>
            </div>
            {migrationData.is_destructive && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #f87171', color: '#b91c1c', padding: '15px', borderRadius: '8px', marginBottom: '20px', fontWeight: 'bold' }}>
                ⚠️ WARNING: This migration contains DROP statements. Existing data in those tables/columns will be permanently deleted.
              </div>
            )}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#475569' }}>Detected Changes:</h4>
              <p style={{ margin: 0, fontSize: '14px', color: '#3b82f6', fontWeight: 'bold', backgroundColor: '#eff6ff', padding: '10px', borderRadius: '6px' }}>{migrationData.summary}</p>
            </div>
            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#10b981' }}>Forward Migration SQL</h4>
                <textarea readOnly value={migrationData.forward_sql.join('\n\n')} style={{ width: '100%', height: '200px', backgroundColor: '#0f172a', color: '#38bdf8', padding: '15px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '13px', border: 'none' }} />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#f59e0b' }}>Auto-Rollback SQL</h4>
                <textarea readOnly value={migrationData.rollback_sql.join('\n\n')} style={{ width: '100%', height: '200px', backgroundColor: '#0f172a', color: '#fca5a5', padding: '15px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '13px', border: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
              <button onClick={() => setIsMigrationModalOpen(false)} style={{ padding: '10px 20px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
              <button onClick={applyLiveMigration} disabled={migrationData.forward_sql.length === 0} style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: migrationData.forward_sql.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)' }}>
                {migrationData.forward_sql.length === 0 ? 'No Changes Detected' : '🚀 Apply Migration to Live DB'}
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 style={{ color: dbMode === 'dynamodb' ? '#4c1d95' : '#1e3a8a', marginTop: 0 }}>☁️ Enterprise Cloud Architect Center</h2>
      
      {/* 🟢 TOP ROW: DB SETTINGS */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div><label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', color: '#475569' }}>Database Name:</label><input type="text" value={dbName} onChange={(e) => setDbName(e.target.value)} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #cbd5e1', width: '200px', fontSize: '13px' }} /></div>
        {dbMode === 'sql' ? (
          <>
            <div><label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', color: '#475569' }}>Engine:</label><select value={dbEngine} onChange={(e) => setDbEngine(e.target.value)} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: 'white', color: 'black' }}><option value="postgres">PostgreSQL</option><option value="mysql">MySQL</option><option value="mariadb">MariaDB</option></select></div>
            <div><label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', color: '#475569' }}>VPC Security Group:</label><input type="text" placeholder="sg-..." value={vpcId} onChange={(e) => setVpcId(e.target.value)} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #cbd5e1', width: '200px', fontSize: '13px' }} /></div>
          </>
        ) : (<div style={{ padding: '8px 12px', backgroundColor: '#8b5cf6', color: 'white', borderRadius: '5px', fontSize: '13px', fontWeight: 'bold' }}>⚡ NoSQL Active</div>)}
      </div>
      
      {/* 🟢 BUTTON ROW 1: CORE DEPLOYMENT & FINOPS */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
        <button onClick={deployToAWS} disabled={loading} style={{ padding: '10px 15px', backgroundColor: dbMode === 'dynamodb' ? '#8b5cf6' : '#f59e0b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>🚀 Deploy {dbMode === 'dynamodb' ? 'DYNAMODB' : dbEngine.toUpperCase()}</button>
        <button onClick={checkStatus} style={{ padding: '10px 15px', backgroundColor: '#1e293b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>🔄 Refresh Status</button>
        <button onClick={runFinOpsEstimate} disabled={isEstimating} style={{ padding: '10px 15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>{isEstimating ? "🧮 Calculating..." : "💰 Estimate AWS Cost"}</button>
        <button onClick={downloadTerraform} style={{ padding: '10px 15px', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>🏗️ Export Terraform</button>
      </div>

      {/* 🟢 BUTTON ROW 2: API GENERATOR & DESTROY */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        {dbMode === 'sql' && (
          <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '5px', overflow: 'hidden' }}>
            <select value={crudFramework} onChange={(e) => setCrudFramework(e.target.value)} style={{ padding: '10px', border: 'none', borderRight: '1px solid #cbd5e1', outline: 'none', backgroundColor: 'white', cursor: 'pointer', fontWeight: 'bold', color: '#475569' }}>
              <option value="express">Node.js (Express)</option>
              <option value="fastapi">Python (FastAPI)</option>
            </select>
            <button onClick={downloadCrudApi} disabled={isGeneratingCrud} style={{ padding: '10px 15px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
              {isGeneratingCrud ? "⏳ Writing Code..." : "⚡ Generate API File"}
            </button>
          </div>
        )}
        <button onClick={deleteDatabase} disabled={loading} style={{ padding: '10px 15px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', marginLeft: 'auto' }}>🗑️ Destroy Infra</button>
      </div>

      {/* 💰 FINOPS WIDGET UI */}
      {finopsData && (
        <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#ecfdf5', border: '2px solid #10b981', borderRadius: '8px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#047857', display: 'flex', alignItems: 'center', gap: '8px' }}>
              AWS FinOps Estimate <span style={{ fontSize: '12px', padding: '2px 6px', backgroundColor: '#d1fae5', borderRadius: '12px' }}>{finopsData.region}</span>
            </h3>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#065f46', marginBottom: '10px' }}>
              ${finopsData.estimated_monthly_cost_usd} <span style={{ fontSize: '14px', fontWeight: 'normal' }}>/ month</span>
            </div>
            {finopsData.free_tier_analysis?.eligible && (
               <div style={{ padding: '8px 12px', backgroundColor: '#d1fae5', color: '#047857', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', display: 'inline-block' }}>
                 🎉 Free Tier Eligible ({finopsData.free_tier_analysis.free_tier_coverage_percentage}% Covered)
                 <div style={{ fontSize: '11px', fontWeight: 'normal', marginTop: '4px' }}>Est. Cost after Free Tier: ${finopsData.free_tier_analysis.estimated_cost_after_free_tier}</div>
               </div>
            )}
          </div>
          <div style={{ flex: '2 1 400px', backgroundColor: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#047857' }}>Optimization Recommendations</h4>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: finopsData.cost_efficiency_score > 70 ? '#10b981' : '#f59e0b' }}>Efficiency Score: {finopsData.cost_efficiency_score}/100</div>
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#064e3b', lineHeight: '1.6' }}>
              {finopsData.optimization_recommendations?.map((tip, i) => <li key={i}>{tip}</li>)}
            </ul>
            <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b' }}>
              <strong>Scalability Projection:</strong> If usage doubles, expect costs around ${finopsData.scalability_cost_projection?.expected_cost_if_usage_doubles}.
            </div>
          </div>
        </div>
      )}

      {status && <p style={{ marginTop: '15px', color: status.includes('Error') ? '#ef4444' : '#166534', fontWeight: 'bold' }}>{status}</p>}

      {/* 🟢 DB STATUS & MIGRATION / OBSERVABILITY BAR */}
      {dbInfo && (
        <div style={{ marginTop: '15px', fontSize: '14px', backgroundColor: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          {dbInfo.error ? (<p style={{ margin: 0, color: '#ef4444', fontWeight: 'bold' }}>Error: {dbInfo.error}</p>) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: '0 0 5px 0' }}><strong>AWS Status:</strong> <span style={{ color: dbInfo.status?.toLowerCase() === 'available' || dbInfo.status?.toLowerCase() === 'active' ? '#10b981' : '#f59e0b' }}>{dbInfo.status?.toUpperCase() || 'UNKNOWN'}</span></p>
                <p style={{ margin: '0 0 5px 0' }}><strong>Endpoint:</strong> {dbInfo.endpoint || 'Not ready yet'}</p>
              </div>

              {dbMode === 'sql' && dbInfo.status?.toLowerCase() === 'available' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: migrationStatus?.includes('❌') ? '#ef4444' : '#10b981' }}>{migrationStatus}</span>
                  
                  {/* 🔄 MIGRATION LOGIC BUTTONS */}
                  {lastDeployedNodes.length === 0 ? (
                    <button onClick={pushSchemaToAWS} style={{ padding: '10px 15px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>🏗️ Push Initial Schema</button>
                  ) : (
                    <button onClick={openMigrationCenter} style={{ padding: '10px 15px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>🔄 Review & Migrate Changes</button>
                  )}
                </div>
              )}
              
              {dbMode === 'dynamodb' && dbInfo.status?.toLowerCase() === 'active' && (
                <button onClick={() => setShowInjector(!showInjector)} style={{ padding: '8px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                  {showInjector ? "Close Injector" : "💉 Inject Test Data"}
                </button>
              )}
              
              {(dbInfo.status?.toLowerCase() === 'available' || dbInfo.status?.toLowerCase() === 'active') && (
                <button onClick={() => setIsObserving(!isObserving)} style={{ padding: '10px 20px', backgroundColor: isObserving ? '#ef4444' : '#0ea5e9', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                  {isObserving ? "⏹️ Stop Telemetry" : "📡 Start Live Observability"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 💉 DYNAMODB INJECTOR UI */}
      {showInjector && (
        <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#10b981' }}>Live AWS Data Injector</h4>
          <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#94a3b8' }}>Write standard JSON. The "id" field is required as the Partition Key.</p>
          <textarea value={jsonData} onChange={(e) => setJsonData(e.target.value)} style={{ width: '100%', height: '120px', padding: '10px', borderRadius: '5px', backgroundColor: '#0f172a', color: '#38bdf8', fontFamily: 'monospace', border: '1px solid #475569', fontSize: '13px', resize: 'vertical' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: insertStatus?.includes('❌') ? '#ef4444' : '#10b981' }}>{insertStatus}</span>
            <button onClick={injectData} style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Send to AWS</button>
          </div>
        </div>
      )}

      {/* 📡 LIVE OBSERVABILITY DASHBOARD UI */}
      {isObserving && (
        <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', color: 'white', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '15px', marginBottom: '20px' }}>
            <h3 style={{ margin: '0', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '10px', height: '10px', backgroundColor: currentMetrics?.status === 'Healthy' ? '#10b981' : '#ef4444', borderRadius: '50%', boxShadow: `0 0 10px ${currentMetrics?.status === 'Healthy' ? '#10b981' : '#ef4444'}` }}></div>
              Live AWS Telemetry
            </h3>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Live connection to {dbInfo?.endpoint?.split('.')[0]}</span>
          </div>
          
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div style={{ flex: 1, backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Network Latency</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: currentMetrics?.latency_ms > 200 ? '#f59e0b' : '#10b981', margin: '10px 0' }}>{currentMetrics?.latency_ms || 0} <span style={{ fontSize: '16px' }}>ms</span></div>
            </div>
            <div style={{ flex: 1, backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Active DB Threads</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#3b82f6', margin: '10px 0' }}>{currentMetrics?.active_connections || 0}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', height: '200px' }}>
            <div style={{ flex: 1, backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#cbd5e1' }}>Live Query Latency (ms)</h4>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricsHistory}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="timestamp" stroke="#94a3b8" fontSize={10} /><YAxis stroke="#94a3b8" fontSize={10} /><Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} /><Line type="monotone" dataKey="latency_ms" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} animationDuration={300} /></LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1, backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#cbd5e1' }}>Live Active Connections</h4>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metricsHistory}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="timestamp" stroke="#94a3b8" fontSize={10} /><YAxis stroke="#94a3b8" fontSize={10} /><Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} /><Area type="monotone" dataKey="active_connections" stroke="#3b82f6" fill="#1e3a8a" animationDuration={300} /></AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CloudDashboard;