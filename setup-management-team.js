// Manual setup script for core management team
// Run this in Firebase Console or use Firebase Admin SDK

console.log('🔧 MANUAL SETUP REQUIRED FOR MANAGEMENT TEAM');
console.log('');
console.log('Core management team emails to add:');
console.log('1. harsha@wallsandtrends.com');
console.log('2. navya@wallsandtrends.com');
console.log('3. veda@wallsandtrends.com');
console.log('4. sai@wallsandtrends.com');
console.log('');
console.log('STEPS TO ADD MANAGEMENT TEAM MEMBERS:');
console.log('');
console.log('1. Go to Firebase Console: https://console.firebase.google.com');
console.log('2. Select your project (wallsandtrends-invoices)');
console.log('3. Go to Firestore Database');
console.log('4. Create collection: management_team (if it doesn\'t exist)');
console.log('');
console.log('5. For each email, you need to:');
console.log('   a. Find the user\'s UID in Firebase Auth');
console.log('   b. Generate hashed UID using the hash function');
console.log('   c. Create document with hashed UID as document ID');
console.log('');
console.log('HASH FUNCTION (run in browser console):');
console.log(`
async function hashUid(uid) {
  const encoder = new TextEncoder();
  const data = encoder.encode(uid + 'wallsandtrends_salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
`);
console.log('');
console.log('6. Document structure for each member:');
console.log('   Document ID: [hashed-uid]');
console.log('   Fields:');
console.log('   - email: "harsha@wallsandtrends.com"');
console.log('   - uid: "[original-uid]"');
console.log('   - addedAt: [server timestamp]');
console.log('   - addedBy: "core-setup"');
console.log('   - role: "core-management"');
console.log('');
console.log('ALTERNATIVE: Use Firebase Admin SDK with service account');
console.log('1. Download service account key from Firebase Console');
console.log('2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable');
console.log('3. Run: node add-management-member.js');
console.log('');
console.log('Once setup is complete, management team members will be able to:');
console.log('- Trigger manual database backups');
console.log('- Access backup logs and status');
console.log('- Receive automated audit notifications');