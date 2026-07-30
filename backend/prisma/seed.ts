/**
 * Seed initial (cf. cahier 6.2 semaine 1) :
 *  - un compte Superadmin,
 *  - l'universite pilote "Universite de Yaounde 1" avec sa hierarchie minimale
 *    (Faculte des Sciences -> filiere -> niveau -> matiere -> canaux), statut actif.
 *
 * Le seed se connecte via DIRECT_URL (role owner) afin de contourner la RLS
 * pour l'amorcage (aucun utilisateur courant n'existe encore).
 *
 * SEED_SUPERADMIN_EMAIL et SEED_SUPERADMIN_PASSWORD sont OBLIGATOIRES
 * (aucun mot de passe par defaut).
 */
import { PrismaClient, Rang, StatutUniversite, TypeRessource } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});

async function main() {
  const superadminEmail = process.env.SEED_SUPERADMIN_EMAIL;
  const superadminPassword = process.env.SEED_SUPERADMIN_PASSWORD;

  if (!superadminEmail || !superadminPassword) {
    throw new Error(
      'SEED_SUPERADMIN_EMAIL et SEED_SUPERADMIN_PASSWORD sont obligatoires (aucun defaut).',
    );
  }
  if (superadminPassword.length < 12) {
    throw new Error('SEED_SUPERADMIN_PASSWORD doit faire au moins 12 caracteres.');
  }

  const motDePasseHash = await argon2.hash(superadminPassword);

  const superadmin = await prisma.utilisateur.upsert({
    where: { email: superadminEmail },
    update: {},
    create: {
      email: superadminEmail,
      motDePasseHash,
      nom: 'Super',
      prenom: 'Admin',
      rang: Rang.superadmin,
      emailVerifie: true,
    },
  });

  // Universite pilote + hierarchie minimale (SA-1 / AU-2).
  const universite = await prisma.universite.create({
    data: {
      nom: 'Universite de Yaounde 1',
      statut: StatutUniversite.actif,
      facultes: {
        create: {
          nom: 'Faculte des Sciences',
          filieres: {
            create: {
              nom: 'Informatique',
              niveaux: {
                create: {
                  nom: 'Licence 1',
                  matieres: {
                    create: {
                      nom: 'Algorithmique',
                      canaux: {
                        create: [
                          { nom: 'Anciens sujets' },
                          { nom: 'TDs' },
                          { nom: 'Corriges' },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    include: {
      facultes: {
        include: {
          filieres: { include: { niveaux: { include: { matieres: { include: { canaux: true } } } } } },
        },
      },
    },
  });

  console.log('Seed termine :');
  console.log('  Superadmin :', superadmin.email);
  console.log('  Universite pilote :', universite.nom, `(statut ${universite.statut})`);
  console.log('  Reference TypeRessource disponible :', Object.values(TypeRessource).join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
