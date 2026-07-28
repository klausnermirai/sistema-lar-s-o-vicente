const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: firebaseConfig.projectId
  });
}

async function run() {
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  console.log('Querying database:', dbId);
  try {
    const db = getFirestore(admin.app(), dbId);
    const snapshot = await db.collection('residents').get();
    console.log(`Successfully connected to ${dbId}. Found ${snapshot.docs.length} residents.`);
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const medicationsCount = data.medications ? data.medications.length : 0;
      const healthUpdatesCount = data.healthUpdates ? data.healthUpdates.length : 0;
      
      console.log(`\nResident: ${data.name} (ID: ${doc.id})`);
      console.log(`- Institution ID: ${data.institutionId}`);
      console.log(`- Medications count: ${medicationsCount}`);
      if (medicationsCount > 0) {
        data.medications.forEach((med, idx) => {
          console.log(`   [Med ${idx + 1}] Name: ${med.nomeMedicamento || med.name || 'Unnamed'}, Dose: ${med.dosagem || 'N/A'}, Freq: ${med.frequencia || med.frequency || 'N/A'}, Type: ${med.tipoMedicamento || 'N/A'}`);
        });
      }
      console.log(`- Health Updates count: ${healthUpdatesCount}`);
      if (healthUpdatesCount > 0) {
        const lastUpdates = data.healthUpdates.slice(-3);
        lastUpdates.forEach((up, idx) => {
          console.log(`   [Update ${idx + 1}] Date: ${up.date || up.dateTime || 'N/A'}, Type: ${up.type || up.attendanceType || 'N/A'}, Text: ${up.text || up.descricaoAtendimento || 'N/A'}`);
        });
      }
    }
  } catch (err) {
    console.error(`Error with ${dbId}:`, err.message);
    
    // Try (default) database fallback
    try {
      console.log('\nTrying fallback to (default) database...');
      const dbDefault = getFirestore(admin.app(), '(default)');
      const snapshot = await dbDefault.collection('residents').get();
      console.log(`Successfully connected to (default). Found ${snapshot.docs.length} residents.`);
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const medicationsCount = data.medications ? data.medications.length : 0;
        const healthUpdatesCount = data.healthUpdates ? data.healthUpdates.length : 0;
        
        console.log(`\nResident: ${data.name} (ID: ${doc.id})`);
        console.log(`- Institution ID: ${data.institutionId}`);
        console.log(`- Medications count: ${medicationsCount}`);
        if (medicationsCount > 0) {
          data.medications.forEach((med, idx) => {
            console.log(`   [Med ${idx + 1}] Name: ${med.nomeMedicamento || med.name || 'Unnamed'}, Dose: ${med.dosagem || 'N/A'}, Freq: ${med.frequencia || med.frequency || 'N/A'}, Type: ${med.tipoMedicamento || 'N/A'}`);
          });
        }
        console.log(`- Health Updates count: ${healthUpdatesCount}`);
        if (healthUpdatesCount > 0) {
          const lastUpdates = data.healthUpdates.slice(-3);
          lastUpdates.forEach((up, idx) => {
            console.log(`   [Update ${idx + 1}] Date: ${up.date || up.dateTime || 'N/A'}, Type: ${up.type || up.attendanceType || 'N/A'}, Text: ${up.text || up.descricaoAtendimento || 'N/A'}`);
          });
        }
      }
    } catch (fallbackErr) {
      console.error('Fallback failed too:', fallbackErr.message);
    }
  }
}
run();
