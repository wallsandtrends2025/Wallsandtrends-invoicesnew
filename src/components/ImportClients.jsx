import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';

export default function ImportClients() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [importedCount, setImportedCount] = useState(0);

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setErrors([]);
    setImportedCount(0);
    let batch = writeBatch(db);
    const errors = [];
    let count = 0;
    const batchSize = 500;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const csv = e.target.result;
      const lines = csv.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(r => r.trim());
        if (row.length < headers.length) continue;

        const clientData = {
          id: row[headers.indexOf('client_id')],
          client_name: row[headers.indexOf('client_name')],
          company_group: row[headers.indexOf('company_group')],
          company_name: row[headers.indexOf('company_name')],
          poc: row[headers.indexOf('poc')] || 'N/A',
          phone: row[headers.indexOf('phone')] || 'N/A',
          email: row[headers.indexOf('email')] || 'N/A',
          country: row[headers.indexOf('country')],
          state: row[headers.indexOf('state')],
          address: row[headers.indexOf('address')] || 'N/A',
          pan_number: row[headers.indexOf('pan_number')] || 'N/A',
          gst_number: row[headers.indexOf('gst_number')] || 'N/A',
          created_at: row[headers.indexOf('created_at')] ? (isNaN(new Date(row[headers.indexOf('created_at')]).getTime()) ? new Date() : new Date(row[headers.indexOf('created_at')])) : new Date()
        };

        if (!clientData.id || !clientData.client_name) {
          errors.push(`Invalid row ${i}: Missing ID or Name`);
          continue;
        }

        const docRef = doc(db, 'clients', clientData.id);
        batch.set(docRef, clientData);
        count++;

        if (count % batchSize === 0) {
          await batch.commit();
          batch = writeBatch(db);
        }
      }

      await batch.commit();
      setLoading(false);
      setErrors(errors);
      setImportedCount(count);
      alert(`Imported ${count} clients. Errors: ${errors.length}`);
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Import Clients from CSV</h2>
      <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleImport} disabled={loading} style={{ marginLeft: '10px' }}>
        {loading ? 'Importing...' : 'Import Clients'}
      </button>
      {importedCount > 0 && <p>Imported: {importedCount} clients</p>}
      {errors.length > 0 && (
        <div>
          <h3>Errors:</h3>
          <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
    </div>
  );
}