import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'db_fallback.json');

// Initial demo data
const initialData: Record<string, Record<string, any>> = {
  institutions: {
    'demo-institution-id': {
      id: 'demo-institution-id',
      name: 'Lar São Vicente de Paulo (Unidade de Demonstração)',
      cnpj: '00.111.222/0001-33',
      city: 'Cidade Exemplo',
      entityType: 'obra_unida',
      type: 'obra_unida'
    },
    '54.927.132/0001-92': {
      id: '54.927.132/0001-92',
      name: 'Conselho Central SSVP',
      cnpj: '54.927.132/0001-92',
      city: 'Conselho Central',
      entityType: 'conselho_central',
      type: 'conselho_central'
    },
    '52.853.397/0001-68': {
      id: '52.853.397/0001-68',
      name: 'Lar São Vicente de Paulo de Monte Alto',
      cnpj: '52.853.397/0001-68',
      city: 'Monte Alto',
      entityType: 'obra_unida',
      type: 'obra_unida'
    }
  },
  users: {
    'admin': {
      id: 'admin',
      username: 'admin',
      fullName: 'Administrador Padrão',
      role: 'TI / Gestão',
      accessLevel: 'administrador',
      institutionId: 'demo-institution-id'
    },
    'demo-u1': {
      id: 'demo-u1',
      username: 'Demonstração',
      fullName: 'Demonstração',
      role: 'TI / Gestão',
      accessLevel: 'administrador',
      institutionId: 'demo-institution-id'
    },
    'kwarizaya@gmail.com': {
      id: 'kwarizaya@gmail.com',
      username: 'kwarizaya@gmail.com',
      email: 'kwarizaya@gmail.com',
      fullName: 'Gestor Conselho Central',
      role: 'TI / Gestão',
      accessLevel: 'administrador',
      institutionId: '54.927.132/0001-92',
      institutionIds: ['54.927.132/0001-92', '52.853.397/0001-68', 'demo-institution-id']
    }
  },
  residents: {
    'demo-1': {
      id: 'demo-1',
      name: 'Antônio Ferreira (Demo)',
      gender: 'masculino',
      birthDate: '1945-05-12',
      admissionDate: '2020-01-15',
      status: 'ativo',
      cpf: '111.222.333-44',
      institutionId: 'demo-institution-id',
      medications: [
        {
          id: 'med-1',
          name: 'Dipirona 500mg',
          dose: '1 comprimido',
          times: ['08:00', '20:00'],
          route: 'Oral',
          type: 'Contínuo',
          observation: 'Se dor ou febre'
        },
        {
          id: 'med-2',
          name: 'Losartana 50mg',
          dose: '1 comprimido',
          times: ['08:00'],
          route: 'Oral',
          type: 'Contínuo',
          observation: 'Em jejum'
        }
      ]
    },
    'demo-2': {
      id: 'demo-2',
      name: 'Maria das Dores (Demo)',
      gender: 'feminino',
      birthDate: '1938-11-22',
      admissionDate: '2019-06-10',
      status: 'ativo',
      cpf: '555.666.777-88',
      institutionId: 'demo-institution-id',
      medications: [
        {
          id: 'med-3',
          name: 'Metformina 850mg',
          dose: '1 comprimido',
          times: ['12:00', '20:00'],
          route: 'Oral',
          type: 'Contínuo',
          observation: 'Após as refeições'
        }
      ]
    }
  }
};

class FileDatabase {
  private data: Record<string, Record<string, any>> = {};

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        this.data = JSON.parse(fileContent);
        // Make sure residents list is initialized properly if empty
        if (!this.data.residents) {
          this.data.residents = JSON.parse(JSON.stringify(initialData.residents));
        }
      } else {
        this.data = JSON.parse(JSON.stringify(initialData));
        this.save();
      }
    } catch (e) {
      console.error("Error loading local DB:", e);
      this.data = JSON.parse(JSON.stringify(initialData));
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error("Error saving local DB:", e);
    }
  }

  public getRawData(collectionName: string): Record<string, any> {
    this.load(); // Ensure fresh reads
    if (!this.data[collectionName]) {
      this.data[collectionName] = {};
    }
    return this.data[collectionName];
  }

  public writeRawData(collectionName: string, id: string, docData: any, merge = false) {
    if (!this.data[collectionName]) {
      this.data[collectionName] = {};
    }
    if (docData === null) {
      delete this.data[collectionName][id];
    } else {
      if (merge) {
        this.data[collectionName][id] = {
          ...this.data[collectionName][id],
          ...docData,
          id
        };
      } else {
        this.data[collectionName][id] = {
          ...docData,
          id
        };
      }
    }
    this.save();
  }
}

const fileDb = new FileDatabase();

class MockDocSnapshot {
  public id: string;
  private docData: any;

  constructor(id: string, docData: any) {
    this.id = id;
    this.docData = docData;
  }

  get exists() {
    return this.docData !== undefined && this.docData !== null;
  }
  data() {
    return this.docData ? JSON.parse(JSON.stringify(this.docData)) : undefined;
  }
}

class MockQuerySnapshot {
  public docs: MockDocSnapshot[];

  constructor(docs: MockDocSnapshot[]) {
    this.docs = docs;
  }

  get empty() {
    return this.docs.length === 0;
  }
  get size() {
    return this.docs.length;
  }

  forEach(callback: (doc: MockDocSnapshot, index: number) => void) {
    this.docs.forEach(callback);
  }
}

class MockDocRef {
  public collectionName: string;
  public id: string;

  constructor(collectionName: string, id: string) {
    this.collectionName = collectionName;
    this.id = id;
  }

  collection(subCollectionName: string): MockCollection {
    const compositeCollectionName = `${this.collectionName}_${this.id}_${subCollectionName}`;
    return new MockCollection(compositeCollectionName);
  }

  async get(): Promise<MockDocSnapshot> {
    const col = fileDb.getRawData(this.collectionName);
    return new MockDocSnapshot(this.id, col[this.id]);
  }

  async set(data: any, options?: { merge?: boolean }): Promise<void> {
    fileDb.writeRawData(this.collectionName, this.id, data, options?.merge);
  }

  async update(data: any): Promise<void> {
    fileDb.writeRawData(this.collectionName, this.id, data, true);
  }

  async delete(): Promise<void> {
    fileDb.writeRawData(this.collectionName, this.id, null);
  }
}

class MockQuery {
  private filters: Array<{ field: string; op: string; val: any }> = [];
  private limitCount: number | null = null;
  private sortField: string | null = null;
  private sortDir: 'asc' | 'desc' = 'asc';
  private collectionName: string;

  private startAfterVal: any = null;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  where(field: string, op: string, val: any): MockQuery {
    this.filters.push({ field, op, val });
    return this;
  }

  limit(n: number): MockQuery {
    this.limitCount = n;
    return this;
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): MockQuery {
    this.sortField = field;
    this.sortDir = direction;
    return this;
  }

  startAfter(val: any): MockQuery {
    this.startAfterVal = val;
    return this;
  }

  async get(): Promise<MockQuerySnapshot> {
    const col = fileDb.getRawData(this.collectionName);
    let docs = Object.values(col).map(d => JSON.parse(JSON.stringify(d)));

    // Apply where filters
    for (const filter of this.filters) {
      const { field, op, val } = filter;
      docs = docs.filter(doc => {
        const docVal = doc[field];
        if (op === '==' || op === '===') return docVal === val;
        if (op === '!=' || op === '!==') return docVal !== val;
        if (op === '>') return docVal > val;
        if (op === '>=') return docVal >= val;
        if (op === '<') return docVal < val;
        if (op === '<=') return docVal <= val;
        if (op === 'array-contains') {
          return Array.isArray(docVal) && docVal.includes(val);
        }
        if (op === 'in') {
          return Array.isArray(val) && val.includes(docVal);
        }
        return true;
      });
    }

    // Apply ordering
    if (this.sortField) {
      const field = this.sortField;
      const dir = this.sortDir === 'desc' ? -1 : 1;
      docs.sort((a, b) => {
        if (a[field] < b[field]) return -1 * dir;
        if (a[field] > b[field]) return 1 * dir;
        return 0;
      });

      // Apply startAfter if specified
      if (this.startAfterVal !== null && this.startAfterVal !== undefined) {
        const afterIdx = docs.findIndex(d => d[field] === this.startAfterVal || d.id === this.startAfterVal);
        if (afterIdx >= 0) {
          docs = docs.slice(afterIdx + 1);
        }
      }
    }

    // Apply limit
    if (this.limitCount !== null) {
      docs = docs.slice(0, this.limitCount);
    }

    const mockDocs = docs.map(d => new MockDocSnapshot(d.id, d));
    return new MockQuerySnapshot(mockDocs);
  }
}

class MockCollection {
  private collectionName: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  doc(id?: string): MockDocRef {
    const docId = id || Math.random().toString(36).substring(2, 15);
    return new MockDocRef(this.collectionName, docId);
  }

  where(field: string, op: string, val: any): MockQuery {
    const q = new MockQuery(this.collectionName);
    return q.where(field, op, val);
  }

  limit(n: number): MockQuery {
    const q = new MockQuery(this.collectionName);
    return q.limit(n);
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): MockQuery {
    const q = new MockQuery(this.collectionName);
    return q.orderBy(field, direction);
  }

  async add(data: any): Promise<MockDocRef> {
    const docId = Math.random().toString(36).substring(2, 15);
    const ref = this.doc(docId);
    await ref.set(data);
    return ref;
  }

  async get(): Promise<MockQuerySnapshot> {
    const q = new MockQuery(this.collectionName);
    return q.get();
  }
}

class MockBatch {
  private ops: Array<() => Promise<void>> = [];

  set(docRef: MockDocRef, data: any, options?: { merge?: boolean }): MockBatch {
    this.ops.push(async () => {
      await docRef.set(data, options);
    });
    return this;
  }

  update(docRef: MockDocRef, data: any): MockBatch {
    this.ops.push(async () => {
      await docRef.update(data);
    });
    return this;
  }

  delete(docRef: MockDocRef): MockBatch {
    this.ops.push(async () => {
      await docRef.delete();
    });
    return this;
  }

  async commit(): Promise<void> {
    for (const op of this.ops) {
      await op();
    }
  }
}

export class LocalDbFallback {
  public databaseId = 'local-db-fallback';

  collection(name: string): MockCollection {
    return new MockCollection(name);
  }

  doc(path: string): MockDocRef {
    // Basic parser for paths like 'collectionName/docId'
    const parts = path.split('/');
    return new MockDocRef(parts[0], parts[1]);
  }

  batch(): MockBatch {
    return new MockBatch();
  }

  async runTransaction(callback: (transaction: any) => Promise<any>): Promise<any> {
    const transaction = {
      get: async (docRef: MockDocRef) => {
        return await docRef.get();
      },
      set: (docRef: MockDocRef, data: any, options?: { merge?: boolean }) => {
        fileDb.writeRawData(docRef.collectionName, docRef.id, data, options?.merge);
        return transaction;
      },
      update: (docRef: MockDocRef, data: any) => {
        fileDb.writeRawData(docRef.collectionName, docRef.id, data, true);
        return transaction;
      },
      delete: (docRef: MockDocRef) => {
        fileDb.writeRawData(docRef.collectionName, docRef.id, null);
        return transaction;
      }
    };
    return await callback(transaction);
  }
}
