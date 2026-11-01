// What In 1 apps write in an AI's public chat (Claude.ai, ChatGPT…) when there is no AI inside the app: a short,
// friendly message in the person's own language that asks for a plain answer the app can read back, never a block of
// English code (Martin, 2026-11-01, on In 1 Form: the prompt read like a program in English).

type L = 'en' | 'fr' | 'es' | 'pt' | 'de';
const pick = (lang: string): L => (['en', 'fr', 'es', 'pt', 'de'].includes(lang.slice(0, 2)) ? lang.slice(0, 2) as L : 'en');
const q = (lang: L, s: string) => (lang === 'fr' ? `« ${s.trim()} »` : lang === 'de' ? `„${s.trim()}“` : `"${s.trim()}"`);

/** In 1 Form: a form (or a quiz) as numbered lines, choices in brackets split by "/", "✓" before the right answer. */
export function formChat(request: string, lang: string, quiz: boolean): string {
  const l = pick(lang), r = q(l, request);
  const T: Record<L, string> = {
    fr: `Bonjour ! Peux-tu écrire un formulaire en français pour : ${r}${quiz ? ', sous forme de quiz avec les bonnes réponses' : ''} ?
Réponds simplement, sans code, comme ceci :
Titre : …
Description : …
1. Une question à choix ? (choix 1 / choix 2 / choix 3)${quiz ? ' ✓ choix 2' : ''}
2. Une question à réponse libre ?
Mets les choix entre parenthèses, séparés par « / »${quiz ? ', et écris ✓ suivi de la bonne réponse à la fin de chaque question' : ''}. Entre 5 et 15 questions.`,
    en: `Hello! Could you write a form in English for: ${r}${quiz ? ', as a quiz with the right answers' : ''}?
Answer simply, without code, like this:
Title: …
Description: …
1. A multiple-choice question? (choice 1 / choice 2 / choice 3)${quiz ? ' ✓ choice 2' : ''}
2. An open question?
Put the choices in brackets, split by "/"${quiz ? ', and write ✓ followed by the right answer at the end of each question' : ''}. Between 5 and 15 questions.`,
    es: `¡Hola! ¿Puedes escribir un formulario en español para: ${r}${quiz ? ', como un cuestionario con las respuestas correctas' : ''}?
Responde de forma sencilla, sin código, así:
Título: …
Descripción: …
1. ¿Una pregunta con opciones? (opción 1 / opción 2 / opción 3)${quiz ? ' ✓ opción 2' : ''}
2. ¿Una pregunta abierta?
Pon las opciones entre paréntesis, separadas por "/"${quiz ? ', y escribe ✓ seguido de la respuesta correcta al final de cada pregunta' : ''}. Entre 5 y 15 preguntas.`,
    pt: `Olá! Podes escrever um formulário em português para: ${r}${quiz ? ', como um questionário com as respostas certas' : ''}?
Responde de forma simples, sem código, assim:
Título: …
Descrição: …
1. Uma pergunta de escolha? (opção 1 / opção 2 / opção 3)${quiz ? ' ✓ opção 2' : ''}
2. Uma pergunta aberta?
Põe as opções entre parênteses, separadas por "/"${quiz ? ', e escreve ✓ seguido da resposta certa no fim de cada pergunta' : ''}. Entre 5 e 15 perguntas.`,
    de: `Hallo! Kannst du ein Formular auf Deutsch schreiben für: ${r}${quiz ? ', als Quiz mit den richtigen Antworten' : ''}?
Antworte einfach, ohne Code, so:
Titel: …
Beschreibung: …
1. Eine Auswahlfrage? (Antwort 1 / Antwort 2 / Antwort 3)${quiz ? ' ✓ Antwort 2' : ''}
2. Eine offene Frage?
Setze die Antworten in Klammern, getrennt durch „/“${quiz ? ', und schreibe ✓ und die richtige Antwort ans Ende jeder Frage' : ''}. Zwischen 5 und 15 Fragen.`,
  };
  return T[l];
}

/** In 1 Plan: one task per line, in order, its length in brackets, "!" after the important ones. */
export function planChat(goal: string, lang: string): string {
  const l = pick(lang), r = q(l, goal);
  const T: Record<L, string> = {
    fr: `Bonjour ! Peux-tu faire un plan en français pour : ${r} ?
Réponds simplement, sans code, une tâche par ligne, dans l'ordre, comme ceci :
1. Réserver la salle (2 jours) !
2. Envoyer les invitations (1 jour)
Mets la durée entre parenthèses et « ! » à la fin des tâches importantes. Entre 5 et 20 tâches.`,
    en: `Hello! Could you make a plan in English for: ${r}?
Answer simply, without code, one task per line, in order, like this:
1. Book the room (2 days) !
2. Send the invitations (1 day)
Put how long it takes in brackets and "!" at the end of the important tasks. Between 5 and 20 tasks.`,
    es: `¡Hola! ¿Puedes hacer un plan en español para: ${r}?
Responde de forma sencilla, sin código, una tarea por línea, en orden, así:
1. Reservar la sala (2 días) !
2. Enviar las invitaciones (1 día)
Pon la duración entre paréntesis y "!" al final de las tareas importantes. Entre 5 y 20 tareas.`,
    pt: `Olá! Podes fazer um plano em português para: ${r}?
Responde de forma simples, sem código, uma tarefa por linha, por ordem, assim:
1. Reservar a sala (2 dias) !
2. Enviar os convites (1 dia)
Põe a duração entre parênteses e "!" no fim das tarefas importantes. Entre 5 e 20 tarefas.`,
    de: `Hallo! Kannst du einen Plan auf Deutsch machen für: ${r}?
Antworte einfach, ohne Code, eine Aufgabe pro Zeile, der Reihe nach, so:
1. Raum buchen (2 Tage) !
2. Einladungen verschicken (1 Tag)
Setze die Dauer in Klammern und „!“ ans Ende der wichtigen Aufgaben. Zwischen 5 und 20 Aufgaben.`,
  };
  return T[l];
}

/** In 1 Draw: shapes need numbers, so the answer stays a small code block, explained in the person's language. */
export function drawChat(what: string, lang: string, w: number, h: number, kinds: readonly string[]): string {
  const l = pick(lang), r = q(l, what);
  const ex = `{"shapes":[{"type":"rect","x":100,"y":100,"w":300,"h":200,"fill":"#BFD7FF","color":"#2B2D42","text":"…"}]}`;
  const T: Record<L, string> = {
    fr: `Bonjour ! Peux-tu dessiner ${r} avec des formes simples, sur une page de ${w} × ${h} (0,0 en haut à gauche), textes en français ?
Pour que je puisse coller ta réponse dans mon app de dessin In 1 Draw, réponds seulement avec un bloc de code comme : ${ex}
« type » est l'un de : ${kinds.join(', ')}. Une ligne ou une flèche va de (x,y) à (x+w,y+h).`,
    en: `Hello! Could you draw ${r} with simple shapes, on a page ${w} × ${h} (0,0 at the top left), labels in English?
So I can paste your answer into my drawing app In 1 Draw, answer only with one code block like: ${ex}
"type" is one of: ${kinds.join(', ')}. A line or arrow goes from (x,y) to (x+w,y+h).`,
    es: `¡Hola! ¿Puedes dibujar ${r} con formas simples, en una página de ${w} × ${h} (0,0 arriba a la izquierda), textos en español?
Para que pueda pegar tu respuesta en mi app de dibujo In 1 Draw, responde solo con un bloque de código como: ${ex}
"type" es uno de: ${kinds.join(', ')}. Una línea o flecha va de (x,y) a (x+w,y+h).`,
    pt: `Olá! Podes desenhar ${r} com formas simples, numa página de ${w} × ${h} (0,0 em cima à esquerda), textos em português?
Para eu colar a tua resposta na minha app de desenho In 1 Draw, responde só com um bloco de código como: ${ex}
"type" é um de: ${kinds.join(', ')}. Uma linha ou seta vai de (x,y) a (x+w,y+h).`,
    de: `Hallo! Kannst du ${r} mit einfachen Formen zeichnen, auf einer Seite von ${w} × ${h} (0,0 oben links), Texte auf Deutsch?
Damit ich deine Antwort in meine Zeichen-App In 1 Draw einfügen kann, antworte nur mit einem Codeblock wie: ${ex}
„type“ ist eines von: ${kinds.join(', ')}. Eine Linie oder ein Pfeil geht von (x,y) bis (x+w,y+h).`,
  };
  return T[l];
}

/** "My notes:" in the person's language. */
export function myNotes(lang: string): string {
  return { fr: 'Mes notes :', en: 'My notes:', es: 'Mis notas:', pt: 'As minhas notas:', de: 'Meine Notizen:' }[pick(lang)];
}
