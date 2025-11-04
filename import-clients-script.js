import admin from 'firebase-admin';
import csv from 'csv-parser';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'invoice-new-6a045'
});

const db = admin.firestore();

async function importClients() {
  const clients = [];
  let batch = admin.firestore().batch();
  let count = 0;
  const batchSize = 500;

  fs.createReadStream('invoice data.csv')
    .pipe(csv({ skipEmptyLines: true }))
    .on('headers', (headers) => {
      // Remove BOM from headers
      headers[0] = headers[0].replace(/^\uFEFF/, '');
    })
    .on('data', (row) => {
      const clientData = {
        id: row.client_id,
        client_name: row.client_name,
        company_group: row.company_group,
        company_name: row.company_name,
        poc: row.poc || 'N/A',
        phone: row.phone || 'N/A',
        email: row.email || 'N/A',
        country: row.country,
        state: row.state,
        address: row.address || 'N/A',
        pan_number: row.pan_number || 'N/A',
        gst_number: row.gst_number || 'N/A',
        created_at: row.created_at ? admin.firestore.Timestamp.fromDate(new Date(row.created_at)) : admin.firestore.Timestamp.now()
      };

      if (!row.client_id || !row.client_name) {
        console.log(`Skipping row: Missing client_id or client_name`);
        return;
      }

      clients.push(clientData);
      const docRef = db.collection('clients').doc(row.client_id);
      batch.set(docRef, clientData);
      count++;

      if (count % batchSize === 0) {
        batch.commit();
        batch = admin.firestore().batch();
      }
    })
    .on('end', async () => {
      await batch.commit();
      console.log(`Imported ${clients.length} clients successfully!`);
    });
}

importClients();