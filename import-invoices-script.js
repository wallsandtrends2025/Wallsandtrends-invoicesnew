import admin from 'firebase-admin';
import csv from 'csv-parser';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'invoice-new-6a045'
});

const db = admin.firestore();

async function importInvoices() {
  const invoices = [];
  let batch = admin.firestore().batch();
  let count = 0;
  const batchSize = 500;

  fs.createReadStream('allinvoicess.csv')
    .pipe(csv({ skipEmptyLines: true }))
    .on('headers', (headers) => {
      // Remove BOM from headers
      headers[0] = headers[0].replace(/^\uFEFF/, '');
    })
    .on('data', (row) => {
      // Trim all values
      Object.keys(row).forEach(key => {
        row[key] = row[key].trim();
      });

      const services = [];
      for (let i = 1; i <= 10; i++) {
        const name = row[`service${i}_name_csv`] || '';
        const description = row[`service${i}_description`] || '';
        const amount = parseFloat(row[`service${i}_amount`] || 0);
        if (name) {
          services.push({ name, description, amount });
        }
      }

      const invoiceData = {
        invoice_id: row.invoice_id,
        client_id: row.client_id,
        project_id: row.project_id || '',
        invoice_type: row.invoice_type || 'WT',
        invoice_title: row.invoice_title || '',
        invoice_date: row.invoice_date || new Date().toISOString().split('T')[0],
        currency: 'INR',
        exchange_rate: 1,
        services: services,
        subtotal: parseFloat(row.subtotal || 0),
        cgst: parseFloat(row.cgst || 0),
        sgst: parseFloat(row.sgst || 0),
        igst: parseFloat(row.igst || 0),
        tax_amount: parseFloat(row.tax_amount || 0),
        total_amount: parseFloat(row.total_amount || 0),
        payment_status: row.payment_status || 'Pending',
        gst_payment_status: row.gst_payment_status || 'Pending',
        payment_date: null,
        pdf_url: '',
        tax_pdf_url: '',
        proforma_pdf_url: '',
        created_at: admin.firestore.Timestamp.now(),
        live_rates_used: false,
        static_rates_used: true,
        rate_source: 'static_fallback'
      };

      if (!row.invoice_id || !row.client_id) {
        console.log(`Skipping row: Missing invoice_id or client_id`);
        return;
      }

      invoices.push(invoiceData);
      const docRef = db.collection('invoices').doc(row.invoice_id);
      batch.set(docRef, invoiceData);
      count++;

      if (count % batchSize === 0) {
        batch.commit();
        batch = admin.firestore().batch();
      }
    })
    .on('end', async () => {
      await batch.commit();
      console.log(`Imported ${invoices.length} invoices successfully!`);
    });
}

importInvoices();