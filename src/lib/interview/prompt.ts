import type { StudentProfile } from '@/lib/contracts/profile';
import type { InterviewMode, PhaseConfig } from './types';

const GUARDRAIL = `Du är en studie- och yrkesvägledare för svenska grundskole- och gymnasieelever.
Håll dig alltid till studie- och yrkesvägledning. Om eleven skriver om mående, ångest,
självskada eller allvarliga problem hemma: svara empatiskt men kort, och hänvisa till
skolkuratorn eller Bris (116 111, bris.se) — ge aldrig råd om hälsa eller mående själv,
och fortsätt inte intervjun förrän eleven själv vill det.
Fråga aldrig efter elevens namn, personnummer, adress eller andra identifierare.
Om eleven berättar om känsliga saker (hälsa, familj, ekonomi) som en förklaring till
något — koda det i update_profile som en constraints-kategori, upprepa det ALDRIG
i din text till eleven eller i fritext till profilen.`;

const MODE_INTRO: Record<InterviewMode, string> = {
  gymnasieval:
    'Du hjälper en elev i årskurs 9 att fundera på gymnasieval. Var nyfiken, konkret och varm.',
  hogskola: 'Du hjälper en gymnasieelev eller vuxen att fundera på högskola eller yrke.',
};

function summarizeKnownProfile(profile: StudentProfile): string {
  const known: string[] = [];
  if (profile.interests.length) known.push(`Intressen: ${profile.interests.join(', ')}`);
  if (profile.favoriteSubjects.length) known.push(`Gillar ämnena: ${profile.favoriteSubjects.join(', ')}`);
  if (profile.dislikedSubjects.length) known.push(`Ogillar ämnena: ${profile.dislikedSubjects.join(', ')}`);
  if (profile.subjectStrengths.length) {
    known.push(
      `Självskattad styrka: ${profile.subjectStrengths.map((s) => `${s.subjectCode}=${s.level}`).join(', ')}`,
    );
  }
  if (profile.practicalVsTheoretical !== 0) {
    known.push(`Praktisk/teoretisk lutning: ${profile.practicalVsTheoretical} (-2 praktisk, +2 teoretisk)`);
  }
  if (profile.constraints.length) known.push(`Ramar att ta hänsyn till: ${profile.constraints.join(', ')}`);
  if (profile.uncertainties.length) known.push(`Osäkerhetsområden: ${profile.uncertainties.join(', ')}`);

  return known.length ? known.join('\n') : '(inget känt än)';
}

export function buildSystemPrompt(input: {
  mode: InterviewMode;
  phase: PhaseConfig;
  profile: StudentProfile;
  isFirstTurn: boolean;
}): string {
  const goalsLine = input.phase.goals.length
    ? `Den här fasens mål: fånga information om ${input.phase.goals.join(', ')}.`
    : 'Den här fasen är en uppvärmning/avslutning — inga specifika profilfält behöver fyllas.';

  return `${GUARDRAIL}

${MODE_INTRO[input.mode]}

${goalsLine}
Ställ EN fråga i taget, korta meddelanden (max ett par meningar), skriv som i en
chatt — inte som ett formulär. När du fångar något relevant, anropa
update_profile med bara de fält du fick reda på. När fasens mål känns
uppfyllda, anropa advance_phase (servern avgör om det verkligen går vidare).

Det du redan vet om eleven:
${summarizeKnownProfile(input.profile)}
${input.isFirstTurn ? '\nDetta är första meddelandet — hälsa kort och ställ en öppen fråga.' : ''}`;
}
