import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getPerfilMembroAutenticado, 
  updatePerfilMembroAutenticado 
} from '../lib/membro_service';
import { ServiceAuthContext } from '../lib/conselho_particular_service';

// Mock do Banco de Dados Firestore
class MockFirestore {
  private users: Map<string, any> = new Map();
  private membros: Map<string, any> = new Map();
  private conferencias: Map<string, any> = new Map();
  private conselhosParticulares: Map<string, any> = new Map();

  setUser(id: string, data: any) {
    this.users.set(id, { ...data, id });
  }

  setMembro(id: string, data: any) {
    this.membros.set(id, { ...data, id });
  }

  setConferencia(id: string, data: any) {
    this.conferencias.set(id, { ...data, id });
  }

  setCP(id: string, data: any) {
    this.conselhosParticulares.set(id, { ...data, id });
  }

  collection(name: string) {
    const self = this;
    if (name === 'users') {
      return {
        doc(id: string) {
          return {
            async get() {
              const data = self.users.get(id);
              return { exists: !!data, data: () => data, id };
            },
            async set(data: any, opts?: any) {
              const current = self.users.get(id) || {};
              self.users.set(id, { ...current, ...data });
            }
          };
        }
      };
    }

    if (name === 'membros_ssvp') {
      return {
        doc(id: string) {
          return {
            async get() {
              const data = self.membros.get(id);
              return { exists: !!data, data: () => data, id };
            },
            async set(data: any, opts?: any) {
              const current = self.membros.get(id) || {};
              self.membros.set(id, { ...current, ...data });
            }
          };
        },
        where(field: string, op: string, val: any) {
          return {
            limit(n: number) {
              return {
                async get() {
                  const docs: any[] = [];
                  for (const [id, m] of self.membros.entries()) {
                    if (m[field] === val) {
                      docs.push({
                        id,
                        exists: true,
                        data: () => m,
                        ref: {
                          id,
                          async set(data: any, opts?: any) {
                            const cur = self.membros.get(id) || {};
                            self.membros.set(id, { ...cur, ...data });
                          },
                          async get() {
                            const cur = self.membros.get(id);
                            return { exists: !!cur, data: () => cur, id };
                          }
                        }
                      });
                      if (docs.length >= n) break;
                    }
                  }
                  return { empty: docs.length === 0, docs };
                }
              };
            }
          };
        }
      };
    }

    if (name === 'conferencias') {
      return {
        doc(id: string) {
          return {
            async get() {
              const data = self.conferencias.get(id);
              return { exists: !!data, data: () => data, id };
            }
          };
        }
      };
    }

    if (name === 'conselhos_particulares') {
      return {
        doc(id: string) {
          return {
            async get() {
              const data = self.conselhosParticulares.get(id);
              return { exists: !!data, data: () => data, id };
            }
          };
        }
      };
    }

    throw new Error(`Coleção ${name} não implementada no mock`);
  }
}

async function runTests() {
  console.log('🚀 Iniciando bateria de testes do Perfil do Vicentino (Meu Perfil)...');

  const db = new MockFirestore();
  const centralId = 'central_jaboticabal_1';

  // Configurar dados de teste
  db.setCP('cp_1', { name: 'CP Santo Antônio', centralId });
  db.setConferencia('conf_1', { name: 'Conferência São Vicente', particularId: 'cp_1', centralId });

  db.setMembro('mem_123', {
    fullName: 'José da Silva Vicentino',
    type: 'confrade',
    status: 'ativo',
    phone: '(16) 99999-1111',
    email: 'jose.vicentino@ssvp.org',
    birthDate: '1980-05-15',
    admissionDate: '2010-03-20',
    conferenciaId: 'conf_1',
    particularId: 'cp_1',
    centralId: centralId,
    userId: 'user_vic_1'
  });

  db.setUser('user_vic_1', {
    username: 'jose.silva',
    membroId: 'mem_123',
    conferenciaId: 'conf_1',
    role: 'membro_conferencia',
    institutionId: centralId
  });

  const authContextValido: ServiceAuthContext = {
    allowed: true,
    userId: 'user_vic_1',
    validatedCentralId: centralId,
    conferenciaId: 'conf_1',
    role: 'membro_conferencia',
    isAdmin: false
  };

  // Teste 1: Obter perfil completo com nomes amigáveis
  console.log('🧪 Teste 1: Consulta ao Meu Perfil Autenticado...');
  const res1 = await getPerfilMembroAutenticado(authContextValido, db);
  if (!res1.success || !res1.data) {
    throw new Error(`Falha no teste 1: ${res1.error}`);
  }
  if (res1.data.membro.fullName !== 'José da Silva Vicentino') {
    throw new Error(`Nome incorreto: ${res1.data.membro.fullName}`);
  }
  if (res1.data.conferenciaNome !== 'Conferência São Vicente') {
    throw new Error(`Conferência incorreta: ${res1.data.conferenciaNome}`);
  }
  if (res1.data.particularNome !== 'CP Santo Antônio') {
    throw new Error(`CP incorreto: ${res1.data.particularNome}`);
  }
  if (res1.data.username !== 'jose.silva') {
    throw new Error(`Username incorreto: ${res1.data.username}`);
  }
  console.log('✅ Teste 1 passou com sucesso!');

  // Teste 2: Atualizar dados pessoais permitidos (telefone, email, endereço, datas)
  console.log('🧪 Teste 2: Atualização de Dados Pessoais pelo Membro...');
  const updatePayload = {
    phone: '(16) 98888-2222',
    email: 'jose.novoemail@ssvp.org',
    addressStreet: 'Rua das Palmeiras',
    addressNumber: '450',
    addressNeighborhood: 'Centro',
    addressCity: 'Jaboticabal',
    addressState: 'SP',
    addressZip: '14870-000',
    birthDate: '1980-05-15',
    profession: 'Marceneiro',
    admissionDate: '2010-03-20',
    acclamationDate: '2012-07-10',
    proclamationDate: '2015-11-20',
    // Tentativas de modificar dados administrativos que devem ser ignorados/protegidos:
    conferenciaId: 'outra_conf',
    particularId: 'outro_cp',
    status: 'inativo',
    type: 'aspirante'
  };

  const res2 = await updatePerfilMembroAutenticado(updatePayload, authContextValido, db);
  if (!res2.success || !res2.data) {
    throw new Error(`Falha no teste 2: ${res2.error}`);
  }
  if (res2.data.phone !== '(16) 98888-2222' || res2.data.email !== 'jose.novoemail@ssvp.org') {
    throw new Error('Falha ao atualizar dados de contato.');
  }
  if (res2.data.profession !== 'Marceneiro' || res2.data.addressCity !== 'Jaboticabal') {
    throw new Error('Falha ao atualizar dados de endereço/profissão.');
  }
  if (res2.data.acclamationDate !== '2012-07-10' || res2.data.proclamationDate !== '2015-11-20') {
    throw new Error('Falha ao atualizar datas vicentinas.');
  }

  // Garantir que campos institucionais foram preservados intactos
  if (res2.data.conferenciaId !== 'conf_1' || res2.data.particularId !== 'cp_1' || res2.data.status !== 'ativo' || res2.data.type !== 'confrade') {
    throw new Error('Falha de segurança: Campos administrativos foram alterados indevidamente!');
  }
  console.log('✅ Teste 2 passou com sucesso! Campos administrativos protegidos.');

  // Teste 3: Tentativa de acesso sem autenticação válida
  console.log('🧪 Teste 3: Rejeição de Acesso Não Autenticado...');
  const authInvalido: ServiceAuthContext = {
    allowed: false,
    validatedCentralId: undefined
  };
  const res3 = await getPerfilMembroAutenticado(authInvalido, db);
  if (res3.success || res3.code !== 'UNAUTHORIZED') {
    throw new Error('Falha no teste 3: Sessão não autorizada não foi bloqueada.');
  }
  console.log('✅ Teste 3 passou com sucesso!');

  console.log('🎉 TODOS OS TESTES DE PERFIL DO VICENTINO PASSARAM COM SUCESSO (100% GREEN)!');
}

runTests().catch(err => {
  console.error('❌ Erro nos testes:', err);
  process.exit(1);
});
