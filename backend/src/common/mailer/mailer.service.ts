import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly config: ConfigService) {}

  estConfigure(): boolean {
    return Boolean(
      this.config.get<string>('SMTP_HOST') &&
        this.config.get<string>('SMTP_PORT') &&
        this.config.get<string>('SMTP_USER') &&
        this.config.get<string>('SMTP_PASS') &&
        this.config.get<string>('MAIL_FROM'),
    );
  }

  async envoyerVerificationEmail(email: string, lienVerification: string): Promise<void> {
    if (!this.estConfigure()) {
      throw new Error('SMTP non configure');
    }

    const transport = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('SMTP_HOST'),
      port: Number(this.config.getOrThrow<string>('SMTP_PORT')),
      secure: this.config.get<string>('SMTP_SECURE') === 'true',
      auth: {
        user: this.config.getOrThrow<string>('SMTP_USER'),
        pass: this.config.getOrThrow<string>('SMTP_PASS'),
      },
      requireTLS: true,
      tls: { minVersion: 'TLSv1.2' },
    });

    const appName = this.config.get<string>('MAIL_APP_NAME') ?? 'UniVerse';
    const from = this.config.getOrThrow<string>('MAIL_FROM');
    const subject = `${appName} - Verification de votre email`;
    const text = `Bienvenue sur ${appName}.

Pour activer votre compte, ouvrez ce lien:
${lienVerification}

Ce lien expire dans 24 heures.`;

    const html = `
      <p>Bienvenue sur <strong>${appName}</strong>.</p>
      <p>Pour activer votre compte, cliquez sur le lien suivant :</p>
      <p><a href="${lienVerification}">${lienVerification}</a></p>
      <p>Ce lien expire dans 24 heures.</p>
    `;

    await transport.sendMail({ from, to: email, subject, text, html });
    this.logger.log(`Email verification envoye a ${email}`);
  }
}
