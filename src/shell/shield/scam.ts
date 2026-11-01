// Bouclier, part 3: does this text look like a scam? Patterns of the frauds that cost people the most
// (FBI IC3 Internet Crime Report, FTC Consumer Sentinel, Centre antifraude du Canada, cybermalveillance.gouv.fr,
// Europol IOCTA): fake bank/government/parcel messages, gift-card and crypto payments, "change of bank details"
// (business email compromise), fake tech support, prizes and inheritances, sextortion, codes asked for.
// Each family needs real signs together; one word alone never raises an alarm.
import type { Finding, Level } from './scan';

interface Family { code: string; weight: number; re: RegExp }

const FAMILIES: Family[] = [
  { code: 'urgent', weight: 1, re: /\b(urgent|immediately|within 24 ?h(ours)?|last (warning|notice)|final notice|imm[ée]diatement|sous 24 ?h|dernier (avis|rappel)|d[ée]lai de \d+ ?h|inmediatamente|en 24 ?horas|[úu]ltimo aviso|imediatamente|em 24 ?horas|[úu]ltimo aviso|sofort|innerhalb von 24 ?stunden|letzte mahnung)\b/i },
  { code: 'suspended', weight: 2, re: /\b(account (has been |will be )?(suspended|locked|blocked|disabled|closed)|unusual (sign-?in|activity)|compte (a [ée]t[ée] |sera )?(suspendu|bloqu[ée]|d[ée]sactiv[ée]|ferm[ée])|activit[ée] inhabituelle|cuenta (ha sido |ser[áa] )?(suspendida|bloqueada)|conta (foi |ser[áa] )?(suspensa|bloqueada)|konto (wurde |wird )?(gesperrt|deaktiviert|eingeschr[äa]nkt))\b/i },
  { code: 'giftcard', weight: 3, re: /\b(gift ?cards?|itunes card|google play card|steam card|amazon card|cartes?[- ]cadeaux?|carte (google play|apple|steam|amazon)|tarjetas? regalo|cart[ãa]o[- ]presente|gutschein ?karten?|paysafecard|neosurf|transcash|pcs mastercard)\b/i },
  { code: 'crypto', weight: 2, re: /\b(bitcoin|btc|usdt|ethereum|crypto ?(wallet|monnaie|moneda|moeda|w[äa]hrung)|wallet address|adresse (du |de )?portefeuille|seed phrase|phrase de r[ée]cup[ée]ration|recovery phrase|send (the )?(btc|crypto)|western union|moneygram)\b/i },
  { code: 'bankChange', weight: 3, re: /\b(new (bank|banking) details|changed? (our|my) (bank|account) details|nouveau (rib|iban)|nouvelles coordonn[ée]es bancaires|changement de (rib|banque)|nuevo (iban|n[úu]mero de cuenta)|novos dados banc[áa]rios|neue bankverbindung|ge[äa]nderte bankverbindung)\b/i },
  { code: 'secret', weight: 2, re: /\b(keep (this|it) (confidential|between us)|do not (tell|discuss) (anyone|with)|strictement confidentiel|n'en parle[sz]? [àa] personne|ne (le )?dites [àa] personne|confidencial|n[ãa]o conte a ningu[ée]m|streng vertraulich|sag es niemandem)\b/i },
  { code: 'code', weight: 3, re: /\b((send|give|share|tell) (me|us) (the |your )?(code|otp|verification code|password|pin)|(envoie|envoyez|donne[sz]?|communique[sz]?)[- ]?(moi|nous) (le |votre |ton )?(code|mot de passe)|code (re[çc]u|de v[ée]rification) par sms|c[óo]digo de verificaci[óo]n|c[óo]digo (sms|de verifica[çc][ãa]o)|best[äa]tigungscode|tan[- ]?nummer)\b/i },
  { code: 'prize', weight: 2, re: /\b(you (have )?won|winner|lottery|jackpot|inheritance|beneficiary of|vous avez gagn[ée]|gagnant|loterie|h[ée]ritage|b[ée]n[ée]ficiaire d|ha ganado|loter[íi]a|herencia|voc[êe] ganhou|heran[çc]a|sie haben gewonnen|gewinner|erbschaft)\b/i },
  { code: 'fee', weight: 2, re: /\b(processing fee|customs fee|delivery fee|small fee|frais (de (douane|livraison|dossier|traitement))|droits de douane|tasa de (aduana|env[íi]o)|taxa (alfandeg[áa]ria|de entrega)|zollgeb[üu]hr|versandgeb[üu]hr)\b/i },
  { code: 'parcel', weight: 1, re: /\b(your (parcel|package)|delivery (failed|attempt)|votre colis|livraison (a )?[ée]chou[ée]|su paquete|seu pacote|ihr paket|zustellung)\b/i },
  { code: 'authority', weight: 1, re: /\b(irs|cra|arc|hmrc|police|gendarmerie|interpol|fbi|impots|imp[ôo]ts|ameli|caf|antai|hacienda|receita federal|finanzamt|bundespolizei|agence du revenu)\b/i },
  { code: 'techSupport', weight: 2, re: /\b(your (computer|pc|device) (is|has been) (infected|hacked|blocked)|call (microsoft|apple) support|votre (ordinateur|pc|appareil) (est|a [ée]t[ée]) (infect[ée]|pirat[ée]|bloqu[ée])|appelez le support|su (ordenador|equipo) est[áa] infectado|seu computador est[áa] infectado|ihr (computer|pc) (ist|wurde) infiziert)\b/i },
  { code: 'sextortion', weight: 3, re: /\b(i (have )?recorded you|webcam|intimate (video|photos)|j'ai (enregistr[ée]|film[ée]) (ta|votre)|vid[ée]o intime|te he grabado|gravei voc[êe]|ich habe (dich|sie) aufgenommen)\b/i },
  { code: 'remoteTool', weight: 2, re: /\b(anydesk|teamviewer|ultraviewer|quick ?support|rustdesk|supremo)\b/i },
  { code: 'romance', weight: 1, re: /\b(my love|my dear|mon amour|ma ch[ée]rie|mi amor|meu amor|mein schatz)\b[\s\S]{0,200}\b(money|argent|dinero|dinheiro|geld|transfer|virement|transferencia|transfer[êe]ncia|[üu]berweisung)\b/i },
  { code: 'investment', weight: 2, re: /\b(guaranteed (returns?|profit)|double your (money|investment)|rendement garanti|doubler (votre|ton) (argent|investissement)|rentabilidad garantizada|retorno garantido|garantierte rendite)\b/i },
];

export interface TextVerdict { level: Level; score: number; findings: Finding[] }

/** Scam signs in a text. */
export function checkText(text: string): TextVerdict {
  const t = text.slice(0, 200_000);
  const findings: Finding[] = [];
  let score = 0;
  for (const f of FAMILIES) {
    const m = t.match(f.re);
    if (m) { score += f.weight; findings.push({ level: 'info', code: f.code, detail: m[0].slice(0, 60) }); }
  }
  // Signs that only mean something together: urgency/authority alone is everyday mail.
  const families = findings.length;
  const level: Level = score >= 5 && families >= 2 ? 'danger' : score >= 3 && families >= 2 ? 'warn' : score >= 3 ? 'info' : 'ok';
  for (const f of findings) f.level = level === 'ok' ? 'info' : level;
  return { level, score, findings: level === 'ok' ? [] : findings };
}
