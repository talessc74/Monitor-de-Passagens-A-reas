import type { AirlineSite } from '@mpa/types';
import { db, COLLECTIONS } from './firestore.js';

const DEFAULT_SITES: AirlineSite[] = [
  {
    id: 'latam',
    name: 'LATAM Airlines',
    url: 'https://www.latamairlines.com',
    logo: 'PLANE_ORANGE',
    status: 'active',
    scrapedCount: 0,
    lastScrapedAt: null,
    avgResponseMs: 450,
  },
  {
    id: 'gol',
    name: 'GOL Linhas Aéreas',
    url: 'https://www.voegol.com.br',
    logo: 'PLANE_ORANGE',
    status: 'active',
    scrapedCount: 0,
    lastScrapedAt: null,
    avgResponseMs: 380,
  },
  {
    id: 'azul',
    name: 'Azul Linhas Aéreas',
    url: 'https://www.voeazul.com.br',
    logo: 'PLANE_BLUE',
    status: 'active',
    scrapedCount: 0,
    lastScrapedAt: null,
    avgResponseMs: 520,
  },
  {
    id: 'decolar',
    name: 'Decolar.com',
    url: 'https://www.decolar.com',
    logo: 'PASSPORT',
    status: 'active',
    scrapedCount: 0,
    lastScrapedAt: null,
    avgResponseMs: 610,
  },
  {
    id: 'skyscanner',
    name: 'Skyscanner',
    url: 'https://www.skyscanner.com.br',
    logo: 'COMPASS',
    status: 'active',
    scrapedCount: 0,
    lastScrapedAt: null,
    avgResponseMs: 310,
  },
];

async function seed() {
  const batch = db.batch();
  for (const site of DEFAULT_SITES) {
    const ref = db.collection(COLLECTIONS.sites).doc(site.id);
    const existing = await ref.get();
    if (!existing.exists) {
      batch.set(ref, site);
    }
  }
  await batch.commit();
  console.log(`Seed concluído em ${COLLECTIONS.sites}.`);
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erro ao popular sites:', error);
    process.exit(1);
  });
