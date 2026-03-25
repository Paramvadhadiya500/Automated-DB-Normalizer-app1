// src/migrationUtils.js

export const compareSchemas = (oldNodes, newNodes) => {
  const diff = {
    tables_added: [], tables_removed: [],
    columns_added: [], columns_removed: [], columns_modified: [],
    is_destructive: false
  };

  const oldTables = (oldNodes || []).reduce((acc, node) => ({ ...acc, [node.data.label]: node.data.schema }), {});
  const newTables = (newNodes || []).reduce((acc, node) => ({ ...acc, [node.data.label]: node.data.schema }), {});

  // 1. Detect Added & Modified Tables
  Object.keys(newTables).forEach(tableName => {
    const newSchema = newTables[tableName];
    if (!oldTables[tableName]) {
      diff.tables_added.push(newSchema);
    } else {
      const oldSchema = oldTables[tableName];
      const oldCols = oldSchema.columns.reduce((acc, col) => ({ ...acc, [col.name]: col }), {});
      
      newSchema.columns.forEach(newCol => {
        if (!oldCols[newCol.name]) {
          diff.columns_added.push({ table: tableName, column: newCol });
        } else if (oldCols[newCol.name].data_type !== newCol.data_type) {
          diff.columns_modified.push({ table: tableName, column: newCol.name, old_type: oldCols[newCol.name].data_type, new_type: newCol.data_type });
        }
      });

      oldSchema.columns.forEach(oldCol => {
        if (!newSchema.columns.find(c => c.name === oldCol.name)) {
          diff.columns_removed.push({ table: tableName, column: oldCol.name });
          diff.is_destructive = true; 
        }
      });
    }
  });

  // 2. Detect Removed Tables
  Object.keys(oldTables).forEach(tableName => {
    if (!newTables[tableName]) {
      diff.tables_removed.push(tableName);
      diff.is_destructive = true;
    }
  });

  return diff;
};

export const generateMigrationSQL = (diffResult, engine) => {
  const forwardSql = [];
  const rollbackSql = [];
  let summary = [];

  diffResult.tables_added.forEach(table => {
    let colDefs = table.columns.map(c => `${c.name} ${c.data_type} ${c.is_primary_key ? 'PRIMARY KEY' : ''}`);
    forwardSql.push(`CREATE TABLE IF NOT EXISTS ${table.name} (\n  ${colDefs.join(',\n  ')}\n);`);
    rollbackSql.push(`DROP TABLE IF EXISTS ${table.name};`);
    summary.push(`Created table ${table.name}`);
  });

  diffResult.columns_added.forEach(item => {
    forwardSql.push(`ALTER TABLE ${item.table} ADD COLUMN ${item.column.name} ${item.column.data_type};`);
    rollbackSql.push(`ALTER TABLE ${item.table} DROP COLUMN ${item.column.name};`);
    summary.push(`Added ${item.column.name} to ${item.table}`);
  });

  diffResult.columns_removed.forEach(item => {
    forwardSql.push(`ALTER TABLE ${item.table} DROP COLUMN ${item.column};`);
    rollbackSql.push(`-- Manual recovery required for dropped column: ${item.column}`);
    summary.push(`Dropped column ${item.column} from ${item.table}`);
  });

  diffResult.tables_removed.forEach(tableName => {
    forwardSql.push(`DROP TABLE IF EXISTS ${tableName};`);
    rollbackSql.push(`-- Manual recovery required for dropped table: ${tableName}`);
    summary.push(`Dropped table ${tableName}`);
  });

  return {
    summary: summary.join(', ') || "No structural changes detected.",
    is_destructive: diffResult.is_destructive,
    forward_sql: forwardSql,
    rollback_sql: rollbackSql.reverse()
  };
};