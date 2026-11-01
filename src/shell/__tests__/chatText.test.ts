import { describe, expect, it } from 'vitest';
import { drawChat, formChat, planChat } from '../chatText';
import { formFromAnswer } from '../../modules/form/ai';
import { tasksFromAnswer } from '../../modules/plan/ai';

describe('chat messages for AI websites', () => {
  it('speak the person\'s language, with no code for Form and Plan', () => {
    const f = formChat('Quiz sur les capitales du monde', 'fr', true);
    expect(f).toContain('Bonjour');
    expect(f).toContain('« Quiz sur les capitales du monde »');
    expect(f).not.toMatch(/[{}]|JSON|"type"/);
    expect(planChat('Déménagement', 'fr')).not.toMatch(/[{}]|JSON/);
    expect(formChat('Feedback', 'de', false)).toContain('Hallo');
    expect(drawChat('une maison', 'fr', 1200, 800, ['rect'])).toContain('Bonjour');
  });

  it('read back a quiz written as plain lines', () => {
    const f = formFromAnswer(`Voici votre quiz :

**Titre :** Quiz sur les capitales du monde
Description : Testez vos connaissances
1. Quelle est la capitale du Japon ? (Kyoto / Tokyo / Osaka) ✓ Tokyo
2. Quelle est la capitale de l'Australie ? (Sydney / Canberra / Melbourne) ✓ canberra
3. Paris est-elle la capitale de la France ? (Oui / Non) ✓ Oui
4. Votre adresse e-mail ?
Bonne chance !`);
    expect(f.title).toBe('Quiz sur les capitales du monde');
    expect(f.description).toBe('Testez vos connaissances');
    expect(f.questions).toHaveLength(4);
    expect(f.questions[0]).toMatchObject({ type: 'choice', title: 'Quelle est la capitale du Japon ?', options: ['Kyoto', 'Tokyo', 'Osaka'], correct: ['Tokyo'] });
    expect(f.questions[1].correct).toEqual(['Canberra']);
    expect(f.questions[2]).toMatchObject({ type: 'yesno', correct: ['yes'] });
    expect(f.questions[3].type).toBe('email');
  });

  it('read back a plan written as plain lines, one task after the other', () => {
    const t = tasksFromAnswer(`Voici le plan :
1. Trier les affaires (3 jours) !
2. Réserver le camion (1 jour)
3. Faire les cartons
Bon courage !`, '2026-11-02', 'todo');
    expect(t.map(x => x.title)).toEqual(['Trier les affaires', 'Réserver le camion', 'Faire les cartons']);
    expect(t[0].priority).toBe('important');
    expect(t[0].due).toBe('2026-11-04');
    expect(t[1].start).toBe('2026-11-05');
    expect(t[1].deps).toEqual([t[0].id]);
  });
});
