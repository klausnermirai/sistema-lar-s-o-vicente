import { getFirestore } from 'firebase-admin/firestore';
import admin from 'firebase-admin';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: firebaseConfig.projectId
});

const activeDbId = firebaseConfig.firestoreDatabaseId || '(default)';
const db = getFirestore(admin.app(), activeDbId);

async function checkData() {
  console.log("Checking users...");
  const users = await db.collection('users').get();
  users.docs.forEach(doc => {
     console.log('User id:', doc.id);
     console.log('User data:', JSON.stringify(doc.data()));
  });

  console.log("\nChecking institutions...");
  const insts = await db.collection('institutions').get();
  insts.docs.forEach(doc => {
     console.log('Inst id:', doc.id);
     console.log('Inst data:', JSON.stringify(doc.data()));
  });
}

checkData().catch(console.error);
