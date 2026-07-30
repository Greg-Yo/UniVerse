import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { assertCleAppartientA } from '../common/storage/storage-key';
import { CreateLivreDto, UpdateLivreDto } from './dto/livre.dto';

/**
 * Bibliotheque numerique partagee (AU-7). Ecriture reservee aux Admins
 * d'universite (et Superadmin) via la RLS ; lecture ouverte a tous.
 */
@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  private ctx(user: AuthUser) {
    return { userId: user.id, rang: user.rang };
  }

  ajouter(user: AuthUser, dto: CreateLivreDto) {
    if (dto.niveauCibleId && dto.matiereCibleeId) {
      throw new BadRequestException('Ciblage niveau et matiere mutuellement exclusifs');
    }
    const fichierCle = assertCleAppartientA(dto.fichierCle, user.id);
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.livre.create({ data: { ...dto, fichierCle, ajouteParId: user.id } }),
    );
  }

  lister(
    user: AuthUser,
    filtres: { niveauCibleId?: string; matiereCibleeId?: string; motCle?: string },
    limite = 30,
  ) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.livre.findMany({
        where: {
          estArchive: false,
          niveauCibleId: filtres.niveauCibleId,
          matiereCibleeId: filtres.matiereCibleeId,
          ...(filtres.motCle ? { titre: { contains: filtres.motCle, mode: 'insensitive' } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limite, 100),
      }),
    );
  }

  modifier(user: AuthUser, id: string, dto: UpdateLivreDto) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.livre.update({ where: { id }, data: dto }),
    );
  }

  archiver(user: AuthUser, id: string) {
    return this.prisma.withRlsContext(this.ctx(user), (tx) =>
      tx.livre.update({ where: { id }, data: { estArchive: true } }),
    );
  }
}
