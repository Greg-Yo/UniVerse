/**
 * Echange un code OAuth YouTube contre un refresh token (machine de confiance).
 * Usage: npx ts-node scripts/youtube-exchange-code.ts --code=XXXX
 *
 * Affiche le refresh token sur stdout uniquement — a rediriger vers un secret
 * store, jamais vers des logs partages ni une reponse HTTP.
 */
import { google } from 'googleapis';

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main(): Promise<void> {
  const code = argValue('code') ?? process.env.YOUTUBE_OAUTH_CODE;
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI;

  if (!code || !clientId || !clientSecret || !redirectUri) {
    console.error(
      'Requis: --code=... et YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REDIRECT_URI',
    );
    process.exit(1);
  }

  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    console.error('Aucun refresh_token. Relancer avec prompt=consent.');
    process.exit(2);
  }

  const outFile = process.env.YOUTUBE_REFRESH_TOKEN_FILE;
  if (outFile) {
    const fs = await import('fs/promises');
    await fs.writeFile(outFile, tokens.refresh_token, { encoding: 'utf8', mode: 0o600 });
    console.log(`Refresh token ecrit dans ${outFile}`);
  } else {
    // Sortie exclusive pour l'operateur local (pas de prefixe log).
    process.stdout.write(`${tokens.refresh_token}\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
