import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import fs from 'fs';

async function diagnoseSantaRita() {
  let db: any;
  if (getApps().length === 0) {
    if (fs.existsSync('./firebase-applet-config.json')) {
      const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
      const app = initializeApp({ projectId: config.projectId });
      db = getFirestore(app, config.firestoreDatabaseId || '(default)');
    }
  } else {
    db = getFirestore();
  }

  console.log('--- BUSCANDO CONFERÊNCIA SANTA RITA ---');
  const confSnap = await db.collection('conferencias').get();
  let santaRitaConf: any = null;
  confSnap.forEach((doc: any) => {
    const d = doc.data();
    if (d.name && d.name.toLowerCase().includes('santa rita')) {
      console.log(`Conferência Encontrada: ID=${doc.id}, Name=${d.name}, CentralId=${d.centralId}, ParticularId=${d.particularId}, activeMembersCount=${d.activeMembersCount}`);
      santaRitaConf = { id: doc.id, ...d };
    }
  });

  if (!santaRitaConf) {
    console.log('Santa Rita não encontrada especificamente por nome parcial. Listando todas conferencias:');
    confSnap.forEach((doc: any) => {
      const d = doc.data();
      console.log(`Conf: ID=${doc.id}, Name=${d.name}`);
    });
  }

  console.log('\n--- BUSCANDO SOLICITAÇÕES DE CADASTRO ---');
  const subSnap = await db.collection('solicitacoes_cadastro_membros').get();
  console.log(`Total de solicitações no banco: ${subSnap.size}`);
  subSnap.forEach((doc: any) => {
    const d = doc.data();
    console.log(`Submissão ID=${doc.id}: Nome=${d.fullName || d.name}, Status=${d.status}, ConfId=${d.conferenciaId}, Tipo=${d.tipo}, MembroId=${d.membroId}, SubmittedAt=${d.submittedAt}`);
  });

  console.log('\n--- BUSCANDO MEMBROS EM membros_ssvp ---');
  const memSnap = await db.collection('membros_ssvp').get();
  console.log(`Total de membros em membros_ssvp: ${memSnap.size}`);
  memSnap.forEach((doc: any) => {
    const d = doc.data();
    console.log(`Membro ID=${doc.id}: Nome=${d.fullName || d.name}, Status=${d.status}, ConfId=${d.conferenciaId}, Origin=${d.origin}, CreatedAt=${d.createdAt}`);
  });
}

diagnoseSantaRita().catch(console.error);
