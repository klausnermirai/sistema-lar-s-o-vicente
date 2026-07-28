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

async function runAudit() {
  try {
    console.log('--- STARTING AUDIT OF SHIFTS & HANDOVERS ---');
    
    // 1. Fetch all shifts
    console.log('\n--- Collection: shifts ---');
    const shiftsSnapshot = await db.collection('shifts').get();
    console.log(`Total shifts docs: ${shiftsSnapshot.docs.length}`);
    const shiftsList = [];
    shiftsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      shiftsList.push({ id: doc.id, ...data });
      console.log(`ID: ${doc.id} | Name: ${data.nomeTurno} | Status: ${data.status} | Order: ${data.ordem} | InstitutionId: ${data.institutionId}`);
    });

    // 2. Fetch all handovers
    console.log('\n--- Collection: handovers ---');
    const handoversSnapshot = await db.collection('handovers').get();
    console.log(`Total handovers docs: ${handoversSnapshot.docs.length}`);
    const handoversList = [];
    handoversSnapshot.docs.forEach(doc => {
      const data = doc.data();
      handoversList.push({ id: doc.id, ...data });
      console.log(`ID: ${doc.id}`);
      console.log(`  - Shift field: ${data.shift}`);
      console.log(`  - Turno ID field: ${data.turnoId}`);
      console.log(`  - Turno Name field: ${data.turnoNome}`);
      console.log(`  - Operational Date: ${data.dataOperacional}`);
      console.log(`  - Timestamp: ${new Date(data.timestamp).toISOString()} (${data.timestamp})`);
      console.log(`  - Author: ${data.professionalName || data.name} | Role: ${data.professionalRole || data.role}`);
      console.log(`  - Summary: "${data.summary?.substring(0, 50)}..."`);
      console.log(`  - InstitutionId: ${data.institutionId}`);
    });

    console.log('\n--- SUMMARY ---');
    console.log(`Found ${shiftsList.length} total shifts configured.`);
    console.log(`Found ${handoversList.length} handovers saved in Firestore.`);
  } catch (err) {
    console.error('Audit Error:', err.message, err.stack);
  }
}
runAudit();
