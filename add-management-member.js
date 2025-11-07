// Script to add core management team members to Firebase
// Usage: node add-management-member.js

import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
try {
  admin.initializeApp({
    // Will use default credentials from environment
  });
} catch (e) {
  // App already initialized
}

const db = admin.firestore();

// Core management team emails
const managementEmails = [
  'harsha@wallsandtrends.com',
  'navya@wallsandtrends.com',
  'veda@wallsandtrends.com',
  'sai@wallsandtrends.com'
];

async function hashUid(uid) {
  const encoder = new TextEncoder();
  const data = encoder.encode(uid + 'wallsandtrends_salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function addManagementMembers() {
  console.log('🔄 Adding core management team members...');
  console.log('');

  try {
    // First, we need to find the UIDs for these email addresses
    // This requires querying the users collection
    const usersSnapshot = await db.collection('users').get();

    if (usersSnapshot.empty) {
      console.log('❌ No users found in database. Please ensure users are registered first.');
      return;
    }

    const emailToUidMap = {};
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.email) {
        emailToUidMap[userData.email.toLowerCase()] = doc.id;
      }
    });

    console.log('📋 Found users in database:');
    Object.keys(emailToUidMap).forEach(email => {
      console.log(`  - ${email}: ${emailToUidMap[email]}`);
    });
    console.log('');

    // Check which management emails are found
    const foundEmails = [];
    const missingEmails = [];

    for (const email of managementEmails) {
      if (emailToUidMap[email.toLowerCase()]) {
        foundEmails.push(email);
      } else {
        missingEmails.push(email);
      }
    }

    if (missingEmails.length > 0) {
      console.log('⚠️  Warning: The following emails were not found in users collection:');
      missingEmails.forEach(email => console.log(`  - ${email}`));
      console.log('Please ensure these users are registered in Firebase Auth first.');
      console.log('');
    }

    if (foundEmails.length === 0) {
      console.log('❌ No management emails found in users collection.');
      return;
    }

    // Add found users to management team
    console.log('✅ Adding found management team members:');

    for (const email of foundEmails) {
      const uid = emailToUidMap[email.toLowerCase()];
      const hashedUid = await hashUid(uid);

      try {
        // Check if already exists
        const existingDoc = await db.collection('management_team').doc(hashedUid).get();

        if (existingDoc.exists) {
          console.log(`⏭️  ${email} already in management team`);
          continue;
        }

        // Add to management team
        await db.collection('management_team').doc(hashedUid).set({
          email: email,
          uid: uid,
          addedAt: admin.firestore.FieldValue.serverTimestamp(),
          addedBy: 'core-setup-script',
          role: 'core-management'
        });

        console.log(`✅ Added ${email} to management team`);

      } catch (error) {
        console.error(`❌ Failed to add ${email}:`, error.message);
      }
    }

    console.log('');
    console.log('🎉 Management team setup complete!');
    console.log('');
    console.log('Management team members can now:');
    console.log('- Trigger manual backups');
    console.log('- Access backup logs');
    console.log('- Receive audit notifications');

  } catch (error) {
    console.error('❌ Error setting up management team:', error);
    console.log('');
    console.log('Manual setup instructions:');
    console.log('1. Go to Firebase Console > Firestore Database');
    console.log('2. Create collection: management_team');
    console.log('3. For each email, create document with hashed UID as ID');
    console.log('4. Add fields: email, uid, addedAt, addedBy, role');
  }
}

// Run the script
addManagementMembers().then(() => {
  console.log('\n📝 Script completed.');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});