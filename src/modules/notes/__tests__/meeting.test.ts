import { describe, expect, it } from 'vitest';
import { elapsed, isPoint, isTodo, meetingHtml, meetingNotes, sentences } from '../meeting';

const FR = `[09:00] Bonjour à tous, aujourd'hui on parle du lancement du nouveau site.
Le budget est de 12 000 euros pour cette année. Il faut envoyer la maquette au client avant vendredi.
[09:05] Nous avons décidé de garder la couleur verte. Marie prépare les photos de l'équipe.
N'oubliez pas de relire les textes de la page d'accueil. Merci à tous pour votre travail.`;

describe('meeting notes', () => {
  it('splits the transcript into sentences without time stamps', () => {
    const s = sentences(FR);
    expect(s[0]).toBe("Bonjour à tous, aujourd'hui on parle du lancement du nouveau site.");
    expect(s.some(x => x.includes('['))).toBe(false);
  });
  it('finds to-dos in French, with accents and apostrophes', () => {
    const n = meetingNotes(FR);
    expect(n.todos).toContain('Il faut envoyer la maquette au client avant vendredi.');
    expect(n.todos).toContain("N'oubliez pas de relire les textes de la page d'accueil.");
    expect(n.todos.some(x => x.startsWith('Marie'))).toBe(false);
  });
  it('keeps decisions and numbers as key points, word for word', () => {
    const n = meetingNotes(FR);
    expect(n.points).toContain('Le budget est de 12 000 euros pour cette année.');
    expect(n.points).toContain('Nous avons décidé de garder la couleur verte.');
    // Every line is a sentence that was really said.
    for (const x of [...n.summary, ...n.points, ...n.todos]) expect(FR.replace(/\[\d\d:\d\d\] /g, '')).toContain(x);
  });
  it('never lists a sentence twice', () => {
    const n = meetingNotes(FR);
    const all = [...n.summary, ...n.points, ...n.todos];
    expect(new Set(all).size).toBe(all.length);
  });
  it('knows the other languages', () => {
    expect(isTodo('We need to call the bank tomorrow.')).toBe(true);
    expect(isTodo('Hay que comprar los billetes.')).toBe(true);
    expect(isTodo('Temos que terminar o relatório.')).toBe(true);
    expect(isTodo('Wir müssen das Angebot prüfen.')).toBe(true);
    expect(isTodo('Il fait beau aujourd’hui.')).toBe(false);
    expect(isPoint('Das Ergebnis war sehr gut.')).toBe(true);
    expect(isPoint('Le rendez-vous est en mars.')).toBe(true);
    expect(isPoint('Il fait beau, mais froid.')).toBe(false);
  });
  it('writes Summary / Key points / To do with a check list', () => {
    const html = meetingHtml(meetingNotes(FR), { summary: 'Résumé', points: 'Points clés', todos: 'À faire', none: 'Rien' });
    expect(html).toContain('<h2>Résumé</h2>');
    expect(html).toContain('data-type="taskList"');
    expect(meetingHtml({ summary: [], points: [], todos: [] }, { summary: 'S', points: 'P', todos: 'T', none: 'Rien' })).toContain('<em>Rien</em>');
  });
  it('shows the recording time', () => {
    expect(elapsed(65_000)).toBe('1:05');
    expect(elapsed(3_725_000)).toBe('1:02:05');
  });
});
