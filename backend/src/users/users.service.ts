import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Rang, StatutDemande, TypeDemande, TypeNotification } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateGroupeTdsDto, DecisionDemandeDto, DemandeStatutDto } from './dto/user.dto';

/** Correspondance Type_Demande -> rang cible dans la chaine (4.1). */
const RANG_CIBLE: Record<TypeDemande, Rang> = {
  [TypeDemande.formateur]: Rang.formateur,
  [TypeDemande.enseignant]: Rang.enseignant,
  [TypeDemande.moderateur]: Rang.moderateur,
  [TypeDemande.admin_universite]: Rang.admin_universite,
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly auth: AuthService,
  ) {}

  private ctx(user: AuthUser) {
    return { userId: user.id, rang: user.rang };
  }

  profil(user: AuthUser, id: string) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.utilisateur.findUnique({
        where: { id },
        select: {
          id: true,
          nom: true,
          prenom: true,
          rang: true,
          niveauId: true,
          compteCreateur: { select: { id: true, bio: true, nombreAbonnes: true } },
        },
      }),
    );
  }

  // --- Demandes de statut (chaine de promotion, decidee par le Superadmin) ---
  demander(user: AuthUser, dto: DemandeStatutDto) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.demandeStatut.create({
        data: { demandeurId: user.id, type: dto.type, motif: dto.motif },
      }),
    );
  }

  mesDemandes(user: AuthUser) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.demandeStatut.findMany({ where: { demandeurId: user.id }, orderBy: { createdAt: 'desc' } }),
    );
  }

  demandesEnAttente(user: AuthUser) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.demandeStatut.findMany({ where: { statut: StatutDemande.en_attente }, orderBy: { createdAt: 'asc' } }),
    );
  }

  /**
   * Decision Superadmin (SA-3/SA-4). Si approuvee, promeut l'utilisateur dans
   * la chaine et provisionne son Compte_Createur si rang >= formateur.
   * Les sessions sont revoquees apres promotion pour forcer un JWT a jour.
   */
  async decider(user: AuthUser, demandeId: string, dto: DecisionDemandeDto) {
    const resultat = await this.prisma.withRlsContext(this.ctx(user), async (tx) => {
      const demande = await tx.demandeStatut.findUnique({ where: { id: demandeId } });
      if (!demande) {
        throw new NotFoundException('Demande introuvable');
      }
      if (demande.statut !== StatutDemande.en_attente) {
        throw new BadRequestException('Demande deja traitee');
      }

      await tx.demandeStatut.update({
        where: { id: demandeId },
        data: {
          statut: dto.statut as StatutDemande,
          decideurId: user.id,
          decidedAt: new Date(),
          motif: dto.motif ?? demande.motif,
        },
      });

      let promuId: string | null = null;
      if (dto.statut === 'approuvee') {
        await this.appliquerPromotion(tx, demande.demandeurId, demande.type, dto.universiteId);
        promuId = demande.demandeurId;
      }

      await this.notifications.creer(tx, demande.demandeurId, TypeNotification.statut_demande, {
        demandeId,
        statut: dto.statut,
        type: demande.type,
      });

      return { success: true as const, promuId };
    });

    if (resultat.promuId) {
      await this.auth.revoquerToutesSessions(resultat.promuId);
    }
    return { success: true };
  }

  private async appliquerPromotion(
    tx: Prisma.TransactionClient,
    utilisateurId: string,
    type: TypeDemande,
    universiteId?: string,
  ): Promise<void> {
    const rangCible = RANG_CIBLE[type];
    if (type === TypeDemande.admin_universite && !universiteId) {
      throw new BadRequestException('universiteId requis pour promouvoir un Admin Universite');
    }

    await tx.utilisateur.update({
      where: { id: utilisateurId },
      data: {
        rang: rangCible,
        ...(type === TypeDemande.admin_universite ? { universiteAdministreeId: universiteId } : {}),
      },
      select: { id: true, rang: true, universiteAdministreeId: true },
    });

    // Provisionne le Compte_Createur pour tout rang createur (>= formateur).
    if (rangCible === Rang.formateur || rangCible === Rang.enseignant) {
      await tx.compteCreateur.upsert({
        where: { utilisateurId },
        update: {},
        create: { utilisateurId },
      });
    }
  }

  // --- Compte createur (auto-provisionne, mais aussi creable soi-meme) ---
  creerCompteCreateur(user: AuthUser, bio?: string) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.compteCreateur.upsert({
        where: { utilisateurId: user.id },
        update: { bio },
        create: { utilisateurId: user.id, bio },
      }),
    );
  }

  // --- Abonnements createurs ---
  sabonner(user: AuthUser, compteCreateurId: string) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.abonnement.upsert({
        where: { utilisateurId_compteCreateurId: { utilisateurId: user.id, compteCreateurId } },
        update: {},
        create: { utilisateurId: user.id, compteCreateurId },
      }),
    );
  }

  desabonner(user: AuthUser, compteCreateurId: string) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.abonnement.deleteMany({ where: { utilisateurId: user.id, compteCreateurId } }),
    );
  }

  // --- Groupes TDS (tuteur designe exclusivement par le Superadmin) ---
  creerGroupeTds(user: AuthUser, dto: CreateGroupeTdsDto) {
    if (user.rang !== Rang.superadmin) {
      throw new ForbiddenException('Seul le Superadmin peut creer un Groupe TDS');
    }
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.groupeTds.create({
        data: {
          tuteurId: dto.tuteurId,
          nom: dto.nom,
          universiteReferenceId: dto.universiteReferenceId,
        },
      }),
    );
  }

  sabonnerTds(user: AuthUser, groupeTdsId: string) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.abonnementTds.upsert({
        where: { utilisateurId_groupeTdsId: { utilisateurId: user.id, groupeTdsId } },
        update: {},
        create: { utilisateurId: user.id, groupeTdsId },
      }),
    );
  }
}
