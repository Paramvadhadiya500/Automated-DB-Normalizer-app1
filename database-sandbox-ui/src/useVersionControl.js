import { useState, useEffect } from 'react';

const MAX_VERSIONS = 50;
const STORAGE_KEY = 'schema_version_history';

export const useVersionControl = (currentNodes, currentEdges, dbMode, dbEngine) => {
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : { project_id: "default_project", versions: [] };
    } catch {
      return { project_id: "default_project", versions: [] };
    }
  });

  // Persist to LocalStorage whenever history changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const generateChangeSummary = (oldNodes, newNodes, oldEdges, newEdges) => {
    if (!oldNodes) return "Initial schema commit";
    
    const tablesAdded = newNodes.length - oldNodes.length;
    const edgesChanged = newEdges.length - oldEdges.length;

    let summary = [];
    if (tablesAdded > 0) summary.push(`Added ${tablesAdded} table(s)`);
    if (tablesAdded < 0) summary.push(`Removed ${Math.abs(tablesAdded)} table(s)`);
    if (edgesChanged !== 0) summary.push(`${Math.abs(edgesChanged)} relationship(s) changed`);

    return summary.length > 0 ? summary.join(', ') : "Modified columns or schema properties";
  };

  const getNextVersion = (lastVersion, summary) => {
    if (!lastVersion) return "v1.0";
    const parts = lastVersion.replace('v', '').split('.');
    let major = parseInt(parts[0]);
    let minor = parseInt(parts[1]);

    // Major bump logic: If a lot of tables changed at once
    const tableChangeMatch = summary.match(/\d+/);
    if (tableChangeMatch && parseInt(tableChangeMatch[0]) >= 3) {
        return `v${major + 1}.0`;
    }
    
    return `v${major}.${minor + 1}`;
  };

  const commitSchema = () => {
    const versions = history.versions;
    const lastVersionData = versions.length > 0 ? versions[0] : null; // Top of array is newest

    const summary = generateChangeSummary(
      lastVersionData ? lastVersionData.nodes : null, currentNodes,
      lastVersionData ? lastVersionData.edges : null, currentEdges
    );

    const nextVersionId = getNextVersion(lastVersionData?.version_id, summary);

    const newCommit = {
      version_id: nextVersionId,
      timestamp: new Date().toISOString(),
      nodes: currentNodes,
      edges: currentEdges,
      database_type: dbMode,
      engine: dbEngine,
      change_summary: summary
    };

    setHistory(prev => {
      let updatedVersions = [newCommit, ...prev.versions]; // Add to front
      if (updatedVersions.length > MAX_VERSIONS) {
        updatedVersions = updatedVersions.slice(0, MAX_VERSIONS); // Enforce limit
      }
      return { ...prev, versions: updatedVersions };
    });

    return newCommit;
  };

  const deleteVersion = (versionId) => {
    setHistory(prev => ({
      ...prev,
      versions: prev.versions.filter(v => v.version_id !== versionId)
    }));
  };

  const clearHistory = () => {
    if (window.confirm("⚠️ Clear all version history?")) {
      setHistory({ project_id: "default_project", versions: [] });
    }
  };

  return {
    versions: history.versions,
    commitSchema,
    deleteVersion,
    clearHistory
  };
};