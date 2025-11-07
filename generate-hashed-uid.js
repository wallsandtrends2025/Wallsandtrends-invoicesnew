// Generate hashed UID for secure management team setup
// Run: node generate-hashed-uid.js <your-uid>

const uid = process.argv[2];

if (!uid) {
  console.log('Usage: node generate-hashed-uid.js <firebase-uid>');
  console.log('Example: node generate-hashed-uid.js gabVP5klAPf2mAHkHHKtGX3PeqH2');
  process.exit(1);
}

async function hashUid(uid) {
  const encoder = new TextEncoder();
  const data = encoder.encode(uid + 'wallsandtrends_salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

hashUid(uid).then(hashed => {
  console.log(`Original UID: ${uid}`);
  console.log(`Hashed UID: ${hashed}`);
  console.log('');
  console.log('Use this hashed UID as the document ID in Firebase Console');
  console.log('for the management_team collection.');
});