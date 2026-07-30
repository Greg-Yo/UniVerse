import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthController } from '../auth/auth.controller';
import { ConversationsController } from '../messaging/conversations.controller';
import { HierarchyController } from '../hierarchy/hierarchy.controller';
import { LibraryController } from '../library/library.controller';
import { NotificationsController } from '../notifications/notifications.controller';
import { ResourcesController } from '../resources/resources.controller';
import { SignalementsController } from '../messaging/signalements.controller';
import { StorageController } from '../storage/storage.controller';
import { UsersController } from '../users/users.controller';
import { VideoController } from '../video/video.controller';
import { YoutubeController } from '../video/youtube.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RankGuard } from '../common/guards/rank.guard';
import { MIN_RANG_KEY } from '../common/decorators/roles.decorator';
import { Rang } from '../common/enums/rang.enum';

type Ctor = new (...args: never[]) => object;

function classGuards(ctrl: Ctor): unknown[] {
  return (Reflect.getMetadata(GUARDS_METADATA, ctrl) as unknown[]) ?? [];
}

function methodGuards(proto: object, method: string): unknown[] {
  const fn = (proto as Record<string, unknown>)[method];
  if (typeof fn !== 'function') {
    return [];
  }
  return (Reflect.getMetadata(GUARDS_METADATA, fn) as unknown[]) ?? [];
}

function hasGuard(guards: unknown[], guard: Ctor): boolean {
  return guards.some((g) => g === guard || (g as Ctor)?.name === guard.name);
}

function minRang(proto: object, method: string): Rang | undefined {
  const fn = (proto as Record<string, unknown>)[method];
  if (typeof fn !== 'function') {
    return undefined;
  }
  return Reflect.getMetadata(MIN_RANG_KEY, fn) as Rang | undefined;
}

describe('Audit guards endpoints (sprint 3)', () => {
  const protegesAvecRang: Ctor[] = [
    UsersController,
    HierarchyController,
    ResourcesController,
    LibraryController,
    VideoController,
    StorageController,
  ];

  const protegesJwtSeulement: Ctor[] = [
    ConversationsController,
    SignalementsController,
    NotificationsController,
  ];

  it('controllers metier portent JwtAuthGuard + RankGuard au niveau classe', () => {
    for (const Ctrl of protegesAvecRang) {
      const guards = classGuards(Ctrl);
      expect(hasGuard(guards, JwtAuthGuard)).toBe(true);
      expect(hasGuard(guards, RankGuard)).toBe(true);
    }
  });

  it('messagerie / notifs portent JwtAuthGuard', () => {
    for (const Ctrl of protegesJwtSeulement) {
      expect(hasGuard(classGuards(Ctrl), JwtAuthGuard)).toBe(true);
    }
  });

  it('creation Groupe TDS exige MinRang superadmin', () => {
    expect(minRang(UsersController.prototype, 'creerGroupe')).toBe(Rang.superadmin);
  });

  it('upload storage exige MinRang formateur', () => {
    expect(minRang(StorageController.prototype, 'presignUpload')).toBe(Rang.formateur);
  });

  it('auth-url YouTube exige MinRang superadmin', () => {
    expect(hasGuard(methodGuards(YoutubeController.prototype, 'authUrl'), JwtAuthGuard)).toBe(
      true,
    );
    expect(minRang(YoutubeController.prototype, 'authUrl')).toBe(Rang.superadmin);
  });

  it('change-password exige JwtAuthGuard', () => {
    expect(hasGuard(methodGuards(AuthController.prototype, 'changePassword'), JwtAuthGuard)).toBe(
      true,
    );
  });
});
