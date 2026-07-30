import { Injectable } from '@nestjs/common';
import { StatutUniversite } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import {
  AssignModerateurDto,
  CreateCanalDto,
  CreateFaculteDto,
  CreateFiliereDto,
  CreateMatiereDto,
  CreateNiveauDto,
  CreateUniversiteDto,
} from './dto/hierarchy.dto';

/**
 * Gestion de la hierarchie academique (Universite -> Faculte -> Filiere ->
 * Niveau -> Matiere -> Canal) et de l'assignation des moderateurs.
 * La RLS garantit le "scope" (Superadmin pour l'universite, Admin de l'univ
 * pour la structure interne) ; les Guards posent le rang minimal en amont.
 */
@Injectable()
export class HierarchyService {
  constructor(private readonly prisma: PrismaService) {}

  private ctx(user: AuthUser) {
    return { userId: user.id, rang: user.rang };
  }

  // --- Lecture (ouverte a tout utilisateur authentifie) ---
  listerUniversites(user: AuthUser) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.universite.findMany({ orderBy: { nom: 'asc' } }),
    );
  }

  arbreUniversite(user: AuthUser, id: string) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.universite.findUnique({
        where: { id },
        include: {
          facultes: {
            include: {
              filieres: {
                include: {
                  niveaux: { include: { matieres: { include: { canaux: true } } } },
                },
              },
            },
          },
        },
      }),
    );
  }

  // --- Ecriture Superadmin ---
  creerUniversite(user: AuthUser, dto: CreateUniversiteDto) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.universite.create({ data: { nom: dto.nom } }),
    );
  }

  changerStatutUniversite(user: AuthUser, id: string, statut: StatutUniversite) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.universite.update({ where: { id }, data: { statut } }),
    );
  }

  // --- Ecriture Admin de l'universite (ou Superadmin) ---
  creerFaculte(user: AuthUser, dto: CreateFaculteDto) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.faculte.create({ data: dto }),
    );
  }

  creerFiliere(user: AuthUser, dto: CreateFiliereDto) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.filiere.create({ data: dto }),
    );
  }

  creerNiveau(user: AuthUser, dto: CreateNiveauDto) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.niveauEtude.create({ data: dto }),
    );
  }

  creerMatiere(user: AuthUser, dto: CreateMatiereDto) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.matiere.create({ data: dto }),
    );
  }

  creerCanal(user: AuthUser, dto: CreateCanalDto) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.canal.create({ data: dto }),
    );
  }

  /**
   * Assigne un moderateur a un canal (AU-1). Le trigger SQL garantit qu'un
   * moderateur ne gere que des canaux d'une seule universite (cf. 4.2 #8).
   */
  assignerModerateur(user: AuthUser, dto: AssignModerateurDto) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.attributionModerateur.create({
        data: { moderateurId: dto.moderateurId, canalId: dto.canalId },
      }),
    );
  }

  retirerModerateur(user: AuthUser, moderateurId: string, canalId: string) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.attributionModerateur.deleteMany({ where: { moderateurId, canalId } }),
    );
  }
}
