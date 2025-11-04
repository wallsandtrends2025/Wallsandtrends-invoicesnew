import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';

export default function ImportInvoices() {
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
    const importErrors = [];
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

        const services = [];
        for (let j = 1; j <= 10; j++) {
          const name = row[headers.indexOf(`service${j}_name_csv`)] || '';
          const description = row[headers.indexOf(`service${j}_description`)] || '';
          const amount = parseFloat(row[headers.indexOf(`service${j}_amount`)] || 0);
          if (name) {
            services.push({ name, description, amount });
          }
        }

        const invoiceData = {
          invoice_id: row[headers.indexOf('invoice_id')],
          client_id: row[headers.indexOf('client_id')],
          project_id: row[headers.indexOf('project_id')] || '',
          invoice_type: row[headers.indexOf('invoice_type')] || 'WT',
          invoice_title: row[headers.indexOf('invoice_title')] || '',
          invoice_date: row[headers.indexOf('invoice_date')] || new Date().toISOString().split('T')[0],
          currency: row[headers.indexOf('currency')] || 'INR',
          exchange_rate: 1,
          services: services,
          subtotal: parseFloat(row[headers.indexOf('subtotal')] || 0),
          cgst: parseFloat(row[headers.indexOf('cgst')] || 0),
          sgst: parseFloat(row[headers.indexOf('sgst')] || 0),
          igst: parseFloat(row[headers.indexOf('igst')] || 0),
          tax_amount: parseFloat(row[headers.indexOf('tax_amount')] || 0),
          total_amount: parseFloat(row[headers.indexOf('total_amount')] || 0),
          payment_status: row[headers.indexOf('payment_status')] || 'Pending',
          gst_payment_status: row[headers.indexOf('gst_payment_status')] || 'Pending',
          payment_date: null,
          pdf_url: '',
          tax_pdf_url: '',
          proforma_pdf_url: '',
          created_at: new Date(),
          live_rates_used: false,
          static_rates_used: true,
          rate_source: 'static_fallback'
        };

        if (!invoiceData.invoice_id || !invoiceData.client_id) {
          importErrors.push(`Invalid row ${i + 1}: Missing Invoice ID or Client ID`);
          continue;
        }

        const docRef = doc(db, 'invoices', invoiceData.invoice_id);
        batch.set(docRef, invoiceData);
        count++;

        if (count % batchSize === 0) {
          await batch.commit();
          batch = writeBatch(db);
        }
      }

      await batch.commit();
      setLoading(false);
      setErrors(importErrors);
      setImportedCount(count);
      alert(`Imported ${count} invoices. Errors: ${importErrors.length}`);
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Import Invoices from CSV</h2>
      <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleImport} disabled={loading} style={{ marginLeft: '10px' }}>
        {loading ? 'Importing...' : 'Import Invoices'}
      </button>
      {importedCount > 0 && <p>Imported: {importedCount} invoices</p>}
      {errors.length > 0 && (
        <div>
          <h3>Errors:</h3>
          <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
    </div>
  );
}