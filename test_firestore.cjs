const admin = require('firebase-admin');
const fs = require('fs');
const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: firebaseConfig.firebaseProjectId || firebaseConfig.projectId
  });
}
const db = admin.firestore();
if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') {
  db.settings({ databaseId: firebaseConfig.firestoreDatabaseId });
}

async function run() {
  try {
     console.log('Querying residents...');
     const snapshot = await db.collection('residents').where('institutionId', '==', 'demo-institution-id').get();
     console.log('Docs found:', snapshot.docs.length);
  } catch (err) {
     console.error('Error in query:', err.message);
  }
}
run();
