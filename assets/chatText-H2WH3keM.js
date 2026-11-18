const i=a=>["en","fr","es","pt","de"].includes(a.slice(0,2))?a.slice(0,2):"en",u=(a,s)=>a==="fr"?`« ${s.trim()} »`:a==="de"?`„${s.trim()}“`:`"${s.trim()}"`;function d(a,s,e){const n=i(s),o=u(n,a);return{fr:`Bonjour ! Peux-tu écrire un formulaire en français pour : ${o}${e?", sous forme de quiz avec les bonnes réponses":""} ?
Réponds simplement, sans code, comme ceci :
Titre : …
Description : …
1. Une question à choix ? (choix 1 / choix 2 / choix 3)${e?" ✓ choix 2":""}
2. Une question à réponse libre ?
Mets les choix entre parenthèses, séparés par « / »${e?", et écris ✓ suivi de la bonne réponse à la fin de chaque question":""}. Entre 5 et 15 questions.`,en:`Hello! Could you write a form in English for: ${o}${e?", as a quiz with the right answers":""}?
Answer simply, without code, like this:
Title: …
Description: …
1. A multiple-choice question? (choice 1 / choice 2 / choice 3)${e?" ✓ choice 2":""}
2. An open question?
Put the choices in brackets, split by "/"${e?", and write ✓ followed by the right answer at the end of each question":""}. Between 5 and 15 questions.`,es:`¡Hola! ¿Puedes escribir un formulario en español para: ${o}${e?", como un cuestionario con las respuestas correctas":""}?
Responde de forma sencilla, sin código, así:
Título: …
Descripción: …
1. ¿Una pregunta con opciones? (opción 1 / opción 2 / opción 3)${e?" ✓ opción 2":""}
2. ¿Una pregunta abierta?
Pon las opciones entre paréntesis, separadas por "/"${e?", y escribe ✓ seguido de la respuesta correcta al final de cada pregunta":""}. Entre 5 y 15 preguntas.`,pt:`Olá! Podes escrever um formulário em português para: ${o}${e?", como um questionário com as respostas certas":""}?
Responde de forma simples, sem código, assim:
Título: …
Descrição: …
1. Uma pergunta de escolha? (opção 1 / opção 2 / opção 3)${e?" ✓ opção 2":""}
2. Uma pergunta aberta?
Põe as opções entre parênteses, separadas por "/"${e?", e escreve ✓ seguido da resposta certa no fim de cada pergunta":""}. Entre 5 e 15 perguntas.`,de:`Hallo! Kannst du ein Formular auf Deutsch schreiben für: ${o}${e?", als Quiz mit den richtigen Antworten":""}?
Antworte einfach, ohne Code, so:
Titel: …
Beschreibung: …
1. Eine Auswahlfrage? (Antwort 1 / Antwort 2 / Antwort 3)${e?" ✓ Antwort 2":""}
2. Eine offene Frage?
Setze die Antworten in Klammern, getrennt durch „/“${e?", und schreibe ✓ und die richtige Antwort ans Ende jeder Frage":""}. Zwischen 5 und 15 Fragen.`}[n]}function p(a,s){const e=i(s),n=u(e,a);return{fr:`Bonjour ! Peux-tu faire un plan en français pour : ${n} ?
Réponds simplement, sans code, une tâche par ligne, dans l'ordre, comme ceci :
1. Réserver la salle (2 jours) !
2. Envoyer les invitations (1 jour)
Mets la durée entre parenthèses et « ! » à la fin des tâches importantes. Entre 5 et 20 tâches.`,en:`Hello! Could you make a plan in English for: ${n}?
Answer simply, without code, one task per line, in order, like this:
1. Book the room (2 days) !
2. Send the invitations (1 day)
Put how long it takes in brackets and "!" at the end of the important tasks. Between 5 and 20 tasks.`,es:`¡Hola! ¿Puedes hacer un plan en español para: ${n}?
Responde de forma sencilla, sin código, una tarea por línea, en orden, así:
1. Reservar la sala (2 días) !
2. Enviar las invitaciones (1 día)
Pon la duración entre paréntesis y "!" al final de las tareas importantes. Entre 5 y 20 tareas.`,pt:`Olá! Podes fazer um plano em português para: ${n}?
Responde de forma simples, sem código, uma tarefa por linha, por ordem, assim:
1. Reservar a sala (2 dias) !
2. Enviar os convites (1 dia)
Põe a duração entre parênteses e "!" no fim das tarefas importantes. Entre 5 e 20 tarefas.`,de:`Hallo! Kannst du einen Plan auf Deutsch machen für: ${n}?
Antworte einfach, ohne Code, eine Aufgabe pro Zeile, der Reihe nach, so:
1. Raum buchen (2 Tage) !
2. Einladungen verschicken (1 Tag)
Setze die Dauer in Klammern und „!“ ans Ende der wichtigen Aufgaben. Zwischen 5 und 20 Aufgaben.`}[e]}function m(a,s,e,n,o){const c=i(s),r=u(c,a),t='{"shapes":[{"type":"rect","x":100,"y":100,"w":300,"h":200,"fill":"#BFD7FF","color":"#2B2D42","text":"…"}]}';return{fr:`Bonjour ! Peux-tu dessiner ${r} avec des formes simples, sur une page de ${e} × ${n} (0,0 en haut à gauche), textes en français ?
Pour que je puisse coller ta réponse dans mon app de dessin In 1 Draw, réponds seulement avec un bloc de code comme : ${t}
« type » est l'un de : ${o.join(", ")}. Une ligne ou une flèche va de (x,y) à (x+w,y+h).`,en:`Hello! Could you draw ${r} with simple shapes, on a page ${e} × ${n} (0,0 at the top left), labels in English?
So I can paste your answer into my drawing app In 1 Draw, answer only with one code block like: ${t}
"type" is one of: ${o.join(", ")}. A line or arrow goes from (x,y) to (x+w,y+h).`,es:`¡Hola! ¿Puedes dibujar ${r} con formas simples, en una página de ${e} × ${n} (0,0 arriba a la izquierda), textos en español?
Para que pueda pegar tu respuesta en mi app de dibujo In 1 Draw, responde solo con un bloque de código como: ${t}
"type" es uno de: ${o.join(", ")}. Una línea o flecha va de (x,y) a (x+w,y+h).`,pt:`Olá! Podes desenhar ${r} com formas simples, numa página de ${e} × ${n} (0,0 em cima à esquerda), textos em português?
Para eu colar a tua resposta na minha app de desenho In 1 Draw, responde só com um bloco de código como: ${t}
"type" é um de: ${o.join(", ")}. Uma linha ou seta vai de (x,y) a (x+w,y+h).`,de:`Hallo! Kannst du ${r} mit einfachen Formen zeichnen, auf einer Seite von ${e} × ${n} (0,0 oben links), Texte auf Deutsch?
Damit ich deine Antwort in meine Zeichen-App In 1 Draw einfügen kann, antworte nur mit einem Codeblock wie: ${t}
„type“ ist eines von: ${o.join(", ")}. Eine Linie oder ein Pfeil geht von (x,y) bis (x+w,y+h).`}[c]}function h(a){return{fr:"Mes notes :",en:"My notes:",es:"Mis notas:",pt:"As minhas notas:",de:"Meine Notizen:"}[i(a)]}export{m as d,d as f,h as m,p};
