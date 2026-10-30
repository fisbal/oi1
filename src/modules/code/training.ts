// Training: 20 courses of short exercises, each checked by real tests in the sandbox. Four kinds of exercise,
// because people learn code in different ways: write it, find the bug, put the lines in order (Parsons
// problems, Parsons & Haden 2006) and predict what it prints. Hints come in levels (a question first, then
// a clue), Claude can tutor without giving the answer (like CS50's duck), and missed exercises come back
// later (Leitner boxes).

export type Kind = 'code' | 'bug' | 'parsons' | 'predict';
export interface Words { en: string; fr: string }
export interface Exercise {
  id: string; kind: Kind; title: Words; brief: Words;
  /** The file the programmer works in (.js, .ts, .html or .css). */
  file: string; starter: string; solution: string;
  /** Test code (describe / it / expect). The exercise file is imported as `m`; for HTML, `html` is its text. */
  tests: string;
  hints: Words[];
  /** Code run after the file in the step-by-step simulation (usually a call). */
  example?: string;
}
export interface Course { id: string; icon: string; title: Words; intro: Words; exercises: Exercise[] }

const w = (en: string, fr: string): Words => ({ en, fr });
let n = 0;
const ex = (kind: Kind, title: Words, brief: Words, starter: string, solution: string, tests: string, hints: Words[], example?: string, file = 'exercise.js'): Exercise =>
  ({ id: `e${++n}`, kind, title, brief, file, starter, solution, tests, hints, example });
const fn = (name: string, cases: [string, string][]) => cases.map(([args, out]) => `  it('${name}(${args.replace(/'/g, "\\'")})', () => expect(m.${name}(${args})).toEqual(${out}));`).join('\n');
const suite = (name: string, body: string) => `describe('${name}', () => {\n${body}\n});\n`;

export const COURSES: Course[] = [
  { id: 'js-basics', icon: 'code', title: w('JavaScript: first steps', 'JavaScript : premiers pas'), intro: w('Values, variables and functions.', 'Valeurs, variables et fonctions.'), exercises: [
    ex('code', w('Add two numbers', 'Additionner deux nombres'), w('Write add(a, b) that returns a + b.', 'Écris add(a, b) qui renvoie a + b.'),
      'export function add(a, b) {\n  // your code\n}\n', 'export function add(a, b) {\n  return a + b;\n}\n',
      suite('add', fn('add', [['2, 3', '5'], ['-1, 1', '0'], ['0.5, 0.25', '0.75']])),
      [w('What keyword sends a value back from a function?', 'Quel mot renvoie une valeur hors d’une fonction ?'), w('return a + b;', 'return a + b;')], 'console.log(add(2, 3));'),
    ex('bug', w('The greeting is wrong', 'Le bonjour est faux'), w('greet("Ana") must return "Hello, Ana!". Find the bug.', 'greet("Ana") doit renvoyer "Hello, Ana!". Trouve le bug.'),
      'export function greet(name) {\n  return "Hello, " + "name" + "!";\n}\n', 'export function greet(name) {\n  return "Hello, " + name + "!";\n}\n',
      suite('greet', fn('greet', [['"Ana"', '"Hello, Ana!"'], ['"Li"', '"Hello, Li!"']])),
      [w('Is name used as a variable or as text?', 'name est-il utilisé comme variable ou comme texte ?'), w('Remove the quotes around name.', 'Enlève les guillemets autour de name.')], 'console.log(greet("Ana"));'),
    ex('predict', w('What does it print?', 'Qu’est-ce que ça affiche ?'), w('Read the code, then type exactly what it prints.', 'Lis le code, puis tape exactement ce qu’il affiche.'),
      'let x = 2;\nx = x * 3;\nconsole.log(x + 1);\n', '7', '', [w('Follow x line by line.', 'Suis x ligne par ligne.'), w('x becomes 6, then 6 + 1 is printed.', 'x devient 6, puis 6 + 1 est affiché.')]),
  ] },
  { id: 'conditions', icon: 'swap', title: w('Conditions', 'Conditions'), intro: w('if, else and comparisons.', 'if, else et comparaisons.'), exercises: [
    ex('code', w('Even or odd', 'Pair ou impair'), w('isEven(n) returns true when n is even.', 'isEven(n) renvoie true quand n est pair.'),
      'export function isEven(n) {\n\n}\n', 'export function isEven(n) {\n  return n % 2 === 0;\n}\n',
      suite('isEven', fn('isEven', [['4', 'true'], ['7', 'false'], ['0', 'true'], ['-3', 'false']])),
      [w('What is left when you divide by 2?', 'Que reste-t-il quand on divise par 2 ?'), w('Use the % operator: n % 2.', 'Utilise l’opérateur % : n % 2.')], 'console.log(isEven(4));'),
    ex('code', w('Grade', 'Mention'), w('grade(score): "A" from 90, "B" from 75, "C" from 50, else "F".', 'grade(score) : "A" dès 90, "B" dès 75, "C" dès 50, sinon "F".'),
      'export function grade(score) {\n\n}\n', 'export function grade(score) {\n  if (score >= 90) return "A";\n  if (score >= 75) return "B";\n  if (score >= 50) return "C";\n  return "F";\n}\n',
      suite('grade', fn('grade', [['95', '"A"'], ['90', '"A"'], ['80', '"B"'], ['50', '"C"'], ['12', '"F"']])),
      [w('Test the highest grade first.', 'Teste la meilleure mention d’abord.'), w('if (score >= 90) return "A"; then 75, then 50.', 'if (score >= 90) return "A"; puis 75, puis 50.')], 'console.log(grade(80));'),
    ex('bug', w('Free entry', 'Entrée gratuite'), w('Children under 12 enter free: isFree(12) must be false.', 'Les moins de 12 ans entrent gratuitement : isFree(12) doit être false.'),
      'export function isFree(age) {\n  return age <= 12;\n}\n', 'export function isFree(age) {\n  return age < 12;\n}\n',
      suite('isFree', fn('isFree', [['5', 'true'], ['11', 'true'], ['12', 'false'], ['30', 'false']])),
      [w('“Under 12”: is 12 included?', '« Moins de 12 » : 12 est-il inclus ?'), w('Use < instead of <=.', 'Utilise < au lieu de <=.')], 'console.log(isFree(12));'),
  ] },
  { id: 'loops', icon: 'sync', title: w('Loops', 'Boucles'), intro: w('Repeat with for and while.', 'Répéter avec for et while.'), exercises: [
    ex('code', w('Sum to n', 'Somme jusqu’à n'), w('sumTo(n) returns 1 + 2 + … + n.', 'sumTo(n) renvoie 1 + 2 + … + n.'),
      'export function sumTo(n) {\n  let total = 0;\n\n  return total;\n}\n', 'export function sumTo(n) {\n  let total = 0;\n  for (let i = 1; i <= n; i++) total += i;\n  return total;\n}\n',
      suite('sumTo', fn('sumTo', [['1', '1'], ['4', '10'], ['100', '5050'], ['0', '0']])),
      [w('Which numbers must you visit?', 'Quels nombres dois-tu visiter ?'), w('for (let i = 1; i <= n; i++) total += i;', 'for (let i = 1; i <= n; i++) total += i;')], 'console.log(sumTo(4));'),
    ex('parsons', w('Countdown', 'Compte à rebours'), w('Put the lines in order: countdown(3) returns [3, 2, 1].', 'Remets les lignes dans l’ordre : countdown(3) renvoie [3, 2, 1].'),
      '', 'export function countdown(n) {\n  const out = [];\n  while (n > 0) {\n    out.push(n);\n    n--;\n  }\n  return out;\n}\n',
      suite('countdown', fn('countdown', [['3', '[3, 2, 1]'], ['1', '[1]'], ['0', '[]']])),
      [w('The list is created before the loop.', 'La liste est créée avant la boucle.'), w('Push, then decrease n, inside the loop.', 'Ajoute, puis diminue n, dans la boucle.')], 'console.log(countdown(3));'),
    ex('bug', w('Off by one', 'Décalage d’un'), w('firstN(n) must return [1..n] but returns one too many.', 'firstN(n) doit renvoyer [1..n] mais en renvoie un de trop.'),
      'export function firstN(n) {\n  const out = [];\n  for (let i = 1; i <= n + 1; i++) out.push(i);\n  return out;\n}\n', 'export function firstN(n) {\n  const out = [];\n  for (let i = 1; i <= n; i++) out.push(i);\n  return out;\n}\n',
      suite('firstN', fn('firstN', [['3', '[1, 2, 3]'], ['1', '[1]']])),
      [w('Step through: when does the loop stop?', 'Avance pas à pas : quand la boucle s’arrête-t-elle ?'), w('The condition should be i <= n.', 'La condition doit être i <= n.')], 'console.log(firstN(3));'),
  ] },
  { id: 'strings', icon: 'case', title: w('Text (strings)', 'Texte (chaînes)'), intro: w('Cut, join and change text.', 'Couper, joindre et changer du texte.'), exercises: [
    ex('code', w('Reverse', 'À l’envers'), w('reverse("abc") returns "cba".', 'reverse("abc") renvoie "cba".'),
      'export function reverse(s) {\n\n}\n', 'export function reverse(s) {\n  return [...s].reverse().join("");\n}\n',
      suite('reverse', fn('reverse', [['"abc"', '"cba"'], ['""', '""'], ['"été"', '"été"']])),
      [w('Can you turn the text into a list of letters?', 'Peux-tu transformer le texte en liste de lettres ?'), w('[...s].reverse().join("")', '[...s].reverse().join("")')], 'console.log(reverse("abc"));'),
    ex('code', w('Palindrome', 'Palindrome'), w('isPalindrome ignores case and spaces: "Never odd or even" is true.', 'isPalindrome ignore majuscules et espaces : "Never odd or even" est vrai.'),
      'export function isPalindrome(s) {\n\n}\n', 'export function isPalindrome(s) {\n  const t = s.toLowerCase().replace(/\\s+/g, "");\n  return t === [...t].reverse().join("");\n}\n',
      suite('isPalindrome', fn('isPalindrome', [['"kayak"', 'true'], ['"Never odd or even"', 'true'], ['"hello"', 'false']])),
      [w('Clean the text first: lower case, no spaces.', 'Nettoie d’abord : minuscules, sans espaces.'), w('Compare the cleaned text with its reverse.', 'Compare le texte nettoyé avec son inverse.')], 'console.log(isPalindrome("kayak"));'),
    ex('code', w('Initials', 'Initiales'), w('initials("ada lovelace") returns "AL".', 'initials("ada lovelace") renvoie "AL".'),
      'export function initials(name) {\n\n}\n', 'export function initials(name) {\n  return name.split(" ").filter(Boolean).map(p => p[0].toUpperCase()).join("");\n}\n',
      suite('initials', fn('initials', [['"ada lovelace"', '"AL"'], ['"grace brewster hopper"', '"GBH"']])),
      [w('Split the name into words.', 'Découpe le nom en mots.'), w('split(" "), take [0] of each, toUpperCase, join.', 'split(" "), prends [0] de chacun, toUpperCase, join.')], 'console.log(initials("ada lovelace"));'),
  ] },
  { id: 'arrays', icon: 'bullets', title: w('Lists (arrays)', 'Listes (tableaux)'), intro: w('map, filter, reduce, find.', 'map, filter, reduce, find.'), exercises: [
    ex('code', w('Double them', 'Doubler'), w('double([1,2,3]) returns [2,4,6].', 'double([1,2,3]) renvoie [2,4,6].'),
      'export function double(list) {\n\n}\n', 'export function double(list) {\n  return list.map(x => x * 2);\n}\n',
      suite('double', fn('double', [['[1, 2, 3]', '[2, 4, 6]'], ['[]', '[]']])),
      [w('Which method makes a new list of the same length?', 'Quelle méthode crée une liste de même longueur ?'), w('list.map(x => x * 2)', 'list.map(x => x * 2)')], 'console.log(double([1, 2, 3]));'),
    ex('code', w('Only the adults', 'Seulement les adultes'), w('adults(people) keeps people aged 18 or more.', 'adults(people) garde les personnes de 18 ans ou plus.'),
      'export function adults(people) {\n\n}\n', 'export function adults(people) {\n  return people.filter(p => p.age >= 18);\n}\n',
      suite('adults', fn('adults', [['[{ name: "a", age: 17 }, { name: "b", age: 18 }]', '[{ name: "b", age: 18 }]']])),
      [w('Keep some, drop others: which method?', 'Garder certains, enlever d’autres : quelle méthode ?'), w('people.filter(p => p.age >= 18)', 'people.filter(p => p.age >= 18)')], 'console.log(adults([{ name: "a", age: 17 }, { name: "b", age: 18 }]));'),
    ex('predict', w('reduce', 'reduce'), w('What does it print?', 'Qu’est-ce que ça affiche ?'),
      'const total = [3, 4, 5].reduce((sum, x) => sum + x, 10);\nconsole.log(total);\n', '22', '', [w('The sum starts at 10.', 'La somme commence à 10.'), w('10 + 3 + 4 + 5', '10 + 3 + 4 + 5')]),
  ] },
  { id: 'objects', icon: 'table', title: w('Objects', 'Objets'), intro: w('Keys, values and JSON.', 'Clés, valeurs et JSON.'), exercises: [
    ex('code', w('Count the words', 'Compter les mots'), w('countWords("a b a") returns { a: 2, b: 1 }.', 'countWords("a b a") renvoie { a: 2, b: 1 }.'),
      'export function countWords(text) {\n  const counts = {};\n\n  return counts;\n}\n', 'export function countWords(text) {\n  const counts = {};\n  for (const word of text.split(/\\s+/).filter(Boolean)) counts[word] = (counts[word] ?? 0) + 1;\n  return counts;\n}\n',
      suite('countWords', fn('countWords', [['"a b a"', '{ a: 2, b: 1 }'], ['""', '{}']])),
      [w('Visit each word and add 1 to its count.', 'Visite chaque mot et ajoute 1 à son compte.'), w('counts[word] = (counts[word] ?? 0) + 1', 'counts[word] = (counts[word] ?? 0) + 1')], 'console.log(countWords("a b a"));'),
    ex('bug', w('Copy, not the same', 'Copie, pas le même'), w('withAge must not change the original object.', 'withAge ne doit pas modifier l’objet d’origine.'),
      'export function withAge(person, age) {\n  const copy = person;\n  copy.age = age;\n  return copy;\n}\n', 'export function withAge(person, age) {\n  return { ...person, age };\n}\n',
      suite('withAge', "  it('keeps the original', () => { const p = { name: 'a' }; const q = m.withAge(p, 3); expect(q).toEqual({ name: 'a', age: 3 }); expect(p).toEqual({ name: 'a' }); });"),
      [w('Does = make a new object?', '= crée-t-il un nouvel objet ?'), w('Use { ...person, age }.', 'Utilise { ...person, age }.')], 'const p = { name: "a" };\nconsole.log(withAge(p, 3), p);'),
    ex('code', w('Read JSON', 'Lire du JSON'), w('names(json) returns the names from \'[{"name":"a"}]\'.', 'names(json) renvoie les noms de \'[{"name":"a"}]\'.'),
      'export function names(json) {\n\n}\n', 'export function names(json) {\n  return JSON.parse(json).map(p => p.name);\n}\n',
      suite('names', fn('names', [['\'[{"name":"a"},{"name":"b"}]\'', '["a", "b"]']])),
      [w('Turn the text into data first.', 'Transforme d’abord le texte en données.'), w('JSON.parse(json).map(p => p.name)', 'JSON.parse(json).map(p => p.name)')], 'console.log(names(\'[{"name":"a"}]\'));'),
  ] },
  { id: 'functions', icon: 'fx', title: w('Functions', 'Fonctions'), intro: w('Parameters, defaults, functions as values.', 'Paramètres, valeurs par défaut, fonctions comme valeurs.'), exercises: [
    ex('code', w('Default value', 'Valeur par défaut'), w('power(x, n) returns x to the power n; n is 2 when missing.', 'power(x, n) renvoie x puissance n ; n vaut 2 s’il manque.'),
      'export function power(x, n) {\n\n}\n', 'export function power(x, n = 2) {\n  return x ** n;\n}\n',
      suite('power', fn('power', [['3', '9'], ['2, 3', '8'], ['5, 0', '1']])),
      [w('A parameter can have a default: n = 2.', 'Un paramètre peut avoir un défaut : n = 2.'), w('return x ** n;', 'return x ** n;')], 'console.log(power(3));'),
    ex('code', w('Make a counter', 'Fabriquer un compteur'), w('makeCounter() returns a function that returns 1, then 2, then 3…', 'makeCounter() renvoie une fonction qui renvoie 1, puis 2, puis 3…'),
      'export function makeCounter() {\n\n}\n', 'export function makeCounter() {\n  let count = 0;\n  return () => ++count;\n}\n',
      suite('makeCounter', "  it('counts', () => { const c = m.makeCounter(); c(); c(); expect(c()).toBe(3); });\n  it('two counters are separate', () => { const a = m.makeCounter(); a(); expect(m.makeCounter()()).toBe(1); });"),
      [w('A variable outside the inner function is remembered (a closure).', 'Une variable hors de la fonction intérieure est gardée (une fermeture).'), w('let count = 0; return () => ++count;', 'let count = 0; return () => ++count;')], 'const c = makeCounter();\nc(); c();\nconsole.log(c());'),
    ex('parsons', w('Apply twice', 'Appliquer deux fois'), w('twice(f, x) returns f(f(x)).', 'twice(f, x) renvoie f(f(x)).'),
      '', 'export function twice(f, x) {\n  const once = f(x);\n  return f(once);\n}\n',
      suite('twice', fn('twice', [['x => x + 3, 1', '7'], ['s => s + "!", "hi"', '"hi!!"']])),
      [w('Call f once and keep the result.', 'Appelle f une fois et garde le résultat.'), w('Then return f of that result.', 'Puis renvoie f de ce résultat.')], 'console.log(twice(x => x + 3, 1));'),
  ] },
  { id: 'recursion', icon: 'outline', title: w('Recursion', 'Récursion'), intro: w('A function that calls itself, with a stop case.', 'Une fonction qui s’appelle, avec un cas d’arrêt.'), exercises: [
    ex('code', w('Factorial', 'Factorielle'), w('factorial(5) returns 120; factorial(0) is 1.', 'factorial(5) renvoie 120 ; factorial(0) vaut 1.'),
      'export function factorial(n) {\n\n}\n', 'export function factorial(n) {\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}\n',
      suite('factorial', fn('factorial', [['0', '1'], ['1', '1'], ['5', '120']])),
      [w('What is the smallest case you know the answer to?', 'Quel est le plus petit cas dont tu connais la réponse ?'), w('n * factorial(n - 1)', 'n * factorial(n - 1)')], 'console.log(factorial(4));'),
    ex('bug', w('Never stops', 'Ne s’arrête jamais'), w('fib(n) must return the n-th Fibonacci number (fib(0)=0, fib(1)=1).', 'fib(n) doit renvoyer le n-ième nombre de Fibonacci (fib(0)=0, fib(1)=1).'),
      'export function fib(n) {\n  return fib(n - 1) + fib(n - 2);\n}\n', 'export function fib(n) {\n  if (n < 2) return n;\n  return fib(n - 1) + fib(n - 2);\n}\n',
      suite('fib', fn('fib', [['0', '0'], ['1', '1'], ['10', '55']])),
      [w('What stops the calls?', 'Qu’est-ce qui arrête les appels ?'), w('if (n < 2) return n;', 'if (n < 2) return n;')], 'console.log(fib(5));'),
    ex('code', w('Flatten', 'Aplatir'), w('flatten([1,[2,[3]]]) returns [1,2,3], without .flat().', 'flatten([1,[2,[3]]]) renvoie [1,2,3], sans .flat().'),
      'export function flatten(list) {\n\n}\n', 'export function flatten(list) {\n  const out = [];\n  for (const x of list) Array.isArray(x) ? out.push(...flatten(x)) : out.push(x);\n  return out;\n}\n',
      suite('flatten', fn('flatten', [['[1, [2, [3]]]', '[1, 2, 3]'], ['[]', '[]']])),
      [w('If an item is a list, flatten it too.', 'Si un élément est une liste, aplatis-la aussi.'), w('Array.isArray(x) ? out.push(...flatten(x)) : out.push(x)', 'Array.isArray(x) ? out.push(...flatten(x)) : out.push(x)')], 'console.log(flatten([1, [2, [3]]]));'),
  ] },
  { id: 'algorithms', icon: 'sort', title: w('Algorithms', 'Algorithmes'), intro: w('Search and sort, and why speed matters.', 'Chercher et trier, et pourquoi la vitesse compte.'), exercises: [
    ex('code', w('Largest', 'Le plus grand'), w('largest(list) returns the biggest number, without Math.max.', 'largest(list) renvoie le plus grand nombre, sans Math.max.'),
      'export function largest(list) {\n\n}\n', 'export function largest(list) {\n  let best = list[0];\n  for (const x of list) if (x > best) best = x;\n  return best;\n}\n',
      suite('largest', fn('largest', [['[3, 9, 2]', '9'], ['[-5, -2]', '-2']])),
      [w('Keep the best seen so far.', 'Garde le meilleur vu jusqu’ici.'), w('Start with list[0] and compare each.', 'Commence par list[0] et compare chacun.')], 'console.log(largest([3, 9, 2]));'),
    ex('code', w('Binary search', 'Recherche dichotomique'), w('indexOf(sorted, x) returns the index of x or -1, halving the range each step.', 'indexOf(sorted, x) renvoie l’index de x ou -1, en coupant l’intervalle en deux.'),
      'export function indexOf(sorted, x) {\n\n}\n', 'export function indexOf(sorted, x) {\n  let lo = 0, hi = sorted.length - 1;\n  while (lo <= hi) {\n    const mid = (lo + hi) >> 1;\n    if (sorted[mid] === x) return mid;\n    if (sorted[mid] < x) lo = mid + 1; else hi = mid - 1;\n  }\n  return -1;\n}\n',
      suite('indexOf', fn('indexOf', [['[1, 3, 5, 7, 9], 7', '3'], ['[1, 3, 5], 4', '-1'], ['[], 1', '-1']])),
      [w('Look at the middle. Is x left or right?', 'Regarde le milieu. x est-il à gauche ou à droite ?'), w('Keep lo and hi; mid = (lo + hi) >> 1.', 'Garde lo et hi ; mid = (lo + hi) >> 1.')], 'console.log(indexOf([1, 3, 5, 7, 9], 7));'),
    ex('code', w('Bubble sort', 'Tri à bulles'), w('bubbleSort(list) returns a sorted copy, swapping neighbours.', 'bubbleSort(list) renvoie une copie triée, en échangeant les voisins.'),
      'export function bubbleSort(list) {\n  const a = [...list];\n\n  return a;\n}\n', 'export function bubbleSort(list) {\n  const a = [...list];\n  for (let i = 0; i < a.length; i++)\n    for (let j = 0; j < a.length - 1 - i; j++)\n      if (a[j] > a[j + 1]) [a[j], a[j + 1]] = [a[j + 1], a[j]];\n  return a;\n}\n',
      suite('bubbleSort', fn('bubbleSort', [['[3, 1, 2]', '[1, 2, 3]'], ['[5, 4, 3, 2, 1]', '[1, 2, 3, 4, 5]'], ['[]', '[]']])),
      [w('Compare a[j] and a[j+1]; swap if needed.', 'Compare a[j] et a[j+1] ; échange si besoin.'), w('Two loops; [a[j], a[j+1]] = [a[j+1], a[j]].', 'Deux boucles ; [a[j], a[j+1]] = [a[j+1], a[j]].')], 'console.log(bubbleSort([3, 1, 2]));'),
  ] },
  { id: 'structures', icon: 'columns', title: w('Data structures', 'Structures de données'), intro: w('Stack, queue, Map and Set.', 'Pile, file, Map et Set.'), exercises: [
    ex('code', w('Balanced brackets', 'Parenthèses équilibrées'), w('balanced("([]{})") is true, "(]" is false. Use a stack.', 'balanced("([]{})") est vrai, "(]" est faux. Utilise une pile.'),
      'export function balanced(s) {\n\n}\n', 'export function balanced(s) {\n  const pairs = { ")": "(", "]": "[", "}": "{" };\n  const stack = [];\n  for (const c of s) {\n    if ("([{".includes(c)) stack.push(c);\n    else if (pairs[c] && stack.pop() !== pairs[c]) return false;\n  }\n  return stack.length === 0;\n}\n',
      suite('balanced', fn('balanced', [['"([]{})"', 'true'], ['"(]"', 'false'], ['"(("', 'false'], ['""', 'true']])),
      [w('An opening bracket waits for its closing one: last in, first out.', 'Une ouvrante attend sa fermante : dernier entré, premier sorti.'), w('push on open; on close, pop must match.', 'push à l’ouverture ; à la fermeture, pop doit correspondre.')], 'console.log(balanced("([]{})"));'),
    ex('code', w('No duplicates', 'Sans doublons'), w('unique(list) keeps the first of each value, in order.', 'unique(list) garde la première de chaque valeur, dans l’ordre.'),
      'export function unique(list) {\n\n}\n', 'export function unique(list) {\n  return [...new Set(list)];\n}\n',
      suite('unique', fn('unique', [['[1, 2, 1, 3, 2]', '[1, 2, 3]'], ['["a", "a"]', '["a"]']])),
      [w('Which structure keeps each value once?', 'Quelle structure garde chaque valeur une fois ?'), w('[...new Set(list)]', '[...new Set(list)]')], 'console.log(unique([1, 2, 1, 3]));'),
    ex('code', w('Group by', 'Regrouper'), w('groupBy(words) groups words by first letter in a Map.', 'groupBy(words) regroupe les mots par première lettre dans une Map.'),
      'export function groupBy(words) {\n  const groups = new Map();\n\n  return groups;\n}\n', 'export function groupBy(words) {\n  const groups = new Map();\n  for (const w of words) {\n    const k = w[0];\n    if (!groups.has(k)) groups.set(k, []);\n    groups.get(k).push(w);\n  }\n  return groups;\n}\n',
      suite('groupBy', "  it('groups', () => { const g = m.groupBy(['apple', 'avocado', 'bean']); expect(g.get('a')).toEqual(['apple', 'avocado']); expect(g.get('b')).toEqual(['bean']); });"),
      [w('The key is w[0].', 'La clé est w[0].'), w('Create the list when the key is new, then push.', 'Crée la liste si la clé est nouvelle, puis push.')], 'console.log(groupBy(["apple", "avocado", "bean"]));'),
  ] },
  { id: 'regex', icon: 'find', title: w('Regular expressions', 'Expressions régulières'), intro: w('Find patterns in text.', 'Trouver des motifs dans du texte.'), exercises: [
    ex('code', w('Postal code', 'Code postal'), w('isPostal(s) is true for exactly 5 digits.', 'isPostal(s) est vrai pour exactement 5 chiffres.'),
      'export function isPostal(s) {\n\n}\n', 'export function isPostal(s) {\n  return /^\\d{5}$/.test(s);\n}\n',
      suite('isPostal', fn('isPostal', [['"75001"', 'true'], ['"7500"', 'false'], ['"750011"', 'false'], ['"7a001"', 'false']])),
      [w('\\d is a digit; {5} repeats it.', '\\d est un chiffre ; {5} le répète.'), w('Anchor with ^ and $: /^\\d{5}$/', 'Ancre avec ^ et $ : /^\\d{5}$/')], 'console.log(isPostal("75001"));'),
    ex('code', w('Find the hashtags', 'Trouver les hashtags'), w('tags("go #js and #css") returns ["js", "css"].', 'tags("go #js and #css") renvoie ["js", "css"].'),
      'export function tags(text) {\n\n}\n', 'export function tags(text) {\n  return [...text.matchAll(/#(\\w+)/g)].map(m => m[1]);\n}\n',
      suite('tags', fn('tags', [['"go #js and #css"', '["js", "css"]'], ['"none"', '[]']])),
      [w('A group ( ) captures the word after #.', 'Un groupe ( ) capture le mot après #.'), w('[...text.matchAll(/#(\\w+)/g)].map(m => m[1])', '[...text.matchAll(/#(\\w+)/g)].map(m => m[1])')], 'console.log(tags("go #js and #css"));'),
    ex('bug', w('Hidden email', 'Email masqué'), w('mask("ana@site.com") must return "a**@site.com".', 'mask("ana@site.com") doit renvoyer "a**@site.com".'),
      'export function mask(email) {\n  return email.replace(/^(.)(.*)@/, "$1" + "*" + "@");\n}\n', 'export function mask(email) {\n  return email.replace(/^(.)(.*)@/, (_, a, b) => a + "*".repeat(b.length) + "@");\n}\n',
      suite('mask', fn('mask', [['"ana@site.com"', '"a**@site.com"'], ['"bob1@x.fr"', '"b***@x.fr"']])),
      [w('How many stars? As many as the hidden letters.', 'Combien d’étoiles ? Autant que de lettres cachées.'), w('Use a function: (_, a, b) => a + "*".repeat(b.length) + "@"', 'Utilise une fonction : (_, a, b) => a + "*".repeat(b.length) + "@"')], 'console.log(mask("ana@site.com"));'),
  ] },
  { id: 'async', icon: 'play', title: w('Async and promises', 'Async et promesses'), intro: w('Wait without blocking.', 'Attendre sans bloquer.'), exercises: [
    ex('code', w('Wait', 'Attendre'), w('wait(ms) returns a promise that resolves after ms.', 'wait(ms) renvoie une promesse résolue après ms.'),
      'export function wait(ms) {\n\n}\n', 'export function wait(ms) {\n  return new Promise(resolve => setTimeout(resolve, ms));\n}\n',
      suite('wait', "  it('waits', async () => { const t = Date.now(); await m.wait(50); expect(Date.now() - t).toBeGreaterThanOrEqual(45); });"),
      [w('new Promise(resolve => …)', 'new Promise(resolve => …)'), w('setTimeout(resolve, ms)', 'setTimeout(resolve, ms)')], 'await wait(10);\nconsole.log("done");'),
    ex('code', w('All at once', 'Tout en même temps'), w('total(promises) resolves to the sum of the numbers they give.', 'total(promises) donne la somme des nombres qu’elles renvoient.'),
      'export async function total(promises) {\n\n}\n', 'export async function total(promises) {\n  const values = await Promise.all(promises);\n  return values.reduce((a, b) => a + b, 0);\n}\n',
      suite('total', "  it('adds', async () => expect(await m.total([Promise.resolve(2), Promise.resolve(3)])).toBe(5));"),
      [w('Wait for all of them together.', 'Attends-les toutes ensemble.'), w('await Promise.all(promises), then reduce.', 'await Promise.all(promises), puis reduce.')], 'console.log(await total([Promise.resolve(2), Promise.resolve(3)]));'),
    ex('bug', w('Forgot to wait', 'Oublié d’attendre'), w('double(p) must resolve to twice the value of p.', 'double(p) doit donner le double de la valeur de p.'),
      'export async function double(p) {\n  const v = p;\n  return v * 2;\n}\n', 'export async function double(p) {\n  const v = await p;\n  return v * 2;\n}\n',
      suite('double', "  it('doubles', async () => expect(await m.double(Promise.resolve(21))).toBe(42));"),
      [w('Is v a number or a promise?', 'v est-il un nombre ou une promesse ?'), w('const v = await p;', 'const v = await p;')], 'console.log(await double(Promise.resolve(21)));'),
  ] },
  { id: 'classes', icon: 'user', title: w('Classes', 'Classes'), intro: w('Objects with their own methods.', 'Des objets avec leurs méthodes.'), exercises: [
    ex('code', w('Bank account', 'Compte bancaire'), w('Account with deposit(x), withdraw(x) (refuses if too much) and balance.', 'Account avec deposit(x), withdraw(x) (refuse si trop) et balance.'),
      'export class Account {\n  balance = 0;\n\n}\n', 'export class Account {\n  balance = 0;\n  deposit(x) { this.balance += x; }\n  withdraw(x) { if (x > this.balance) return false; this.balance -= x; return true; }\n}\n',
      suite('Account', "  it('works', () => { const a = new m.Account(); a.deposit(50); expect(a.withdraw(80)).toBe(false); expect(a.withdraw(20)).toBe(true); expect(a.balance).toBe(30); });"),
      [w('Methods use this.balance.', 'Les méthodes utilisent this.balance.'), w('withdraw: if (x > this.balance) return false;', 'withdraw : if (x > this.balance) return false;')], 'const a = new Account();\na.deposit(50);\na.withdraw(20);\nconsole.log(a.balance);'),
    ex('code', w('Inheritance', 'Héritage'), w('Square extends Rect; new Square(3).area() is 9.', 'Square étend Rect ; new Square(3).area() vaut 9.'),
      'export class Rect {\n  constructor(w, h) { this.w = w; this.h = h; }\n  area() { return this.w * this.h; }\n}\n\nexport class Square extends Rect {\n\n}\n', 'export class Rect {\n  constructor(w, h) { this.w = w; this.h = h; }\n  area() { return this.w * this.h; }\n}\n\nexport class Square extends Rect {\n  constructor(side) { super(side, side); }\n}\n',
      suite('Square', "  it('area', () => expect(new m.Square(3).area()).toBe(9));\n  it('is a Rect', () => expect(new m.Square(1)).toBeInstanceOf(m.Rect));"),
      [w('Square needs one size, Rect two.', 'Square a besoin d’une taille, Rect de deux.'), w('constructor(side) { super(side, side); }', 'constructor(side) { super(side, side); }')], 'console.log(new Square(3).area());'),
    ex('predict', w('this and static', 'this et static'), w('What does it print?', 'Qu’est-ce que ça affiche ?'),
      'class Cat {\n  static count = 0;\n  constructor(name) { this.name = name; Cat.count++; }\n}\nnew Cat("a"); new Cat("b");\nconsole.log(Cat.count);\n', '2', '', [w('static belongs to the class, not each cat.', 'static appartient à la classe, pas à chaque chat.'), w('Two cats were made.', 'Deux chats ont été créés.')]),
  ] },
  { id: 'errors', icon: 'shield', title: w('Errors', 'Erreurs'), intro: w('throw, try and catch, and good messages.', 'throw, try et catch, et de bons messages.'), exercises: [
    ex('code', w('Safe divide', 'Division sûre'), w('divide(a, b) throws an Error "Division by zero" when b is 0.', 'divide(a, b) lance une Error "Division by zero" quand b vaut 0.'),
      'export function divide(a, b) {\n\n}\n', 'export function divide(a, b) {\n  if (b === 0) throw new Error("Division by zero");\n  return a / b;\n}\n',
      suite('divide', "  it('divides', () => expect(m.divide(6, 3)).toBe(2));\n  it('refuses zero', () => expect(() => m.divide(1, 0)).toThrow('Division by zero'));"),
      [w('Stop with throw.', 'Arrête avec throw.'), w('if (b === 0) throw new Error("Division by zero");', 'if (b === 0) throw new Error("Division by zero");')], 'try { divide(1, 0); } catch (e) { console.log(e.message); }'),
    ex('code', w('Parse or default', 'Lire ou défaut'), w('parseOr(text, fallback) returns JSON.parse(text), or fallback if it fails.', 'parseOr(text, fallback) renvoie JSON.parse(text), ou fallback en cas d’échec.'),
      'export function parseOr(text, fallback) {\n\n}\n', 'export function parseOr(text, fallback) {\n  try { return JSON.parse(text); } catch { return fallback; }\n}\n',
      suite('parseOr', fn('parseOr', [['"[1]", null', '[1]'], ['"{oops", 0', '0']])),
      [w('try the risky line, catch the failure.', 'try la ligne risquée, catch l’échec.'), w('try { return JSON.parse(text); } catch { return fallback; }', 'try { return JSON.parse(text); } catch { return fallback; }')], 'console.log(parseOr("{oops", 0));'),
    ex('bug', w('Swallowed error', 'Erreur avalée'), w('load must report the error message, not undefined.', 'load doit renvoyer le message d’erreur, pas undefined.'),
      'export function load(fn) {\n  try {\n    return fn();\n  } catch (e) {}\n}\n', 'export function load(fn) {\n  try {\n    return fn();\n  } catch (e) {\n    return "Error: " + e.message;\n  }\n}\n',
      suite('load', "  it('reports', () => expect(m.load(() => { throw new Error('no file'); })).toBe('Error: no file'));\n  it('passes values', () => expect(m.load(() => 4)).toBe(4));"),
      [w('An empty catch hides the problem.', 'Un catch vide cache le problème.'), w('return "Error: " + e.message;', 'return "Error: " + e.message;')]),
  ] },
  { id: 'typescript', icon: 'code', title: w('TypeScript', 'TypeScript'), intro: w('Types that catch mistakes before running.', 'Des types qui attrapent les erreurs avant de lancer.'), exercises: [
    ex('code', w('Typed function', 'Fonction typée'), w('Write area(w: number, h: number): number.', 'Écris area(w: number, h: number): number.'),
      'export function area(w: number, h: number): number {\n\n}\n', 'export function area(w: number, h: number): number {\n  return w * h;\n}\n',
      suite('area', fn('area', [['2, 3', '6']])), [w('Types do not change the logic.', 'Les types ne changent pas la logique.'), w('return w * h;', 'return w * h;')], 'console.log(area(2, 3));', 'exercise.ts'),
    ex('code', w('Interface', 'Interface'), w('fullName(p: Person) returns "first last".', 'fullName(p: Person) renvoie "prénom nom".'),
      'interface Person { first: string; last: string }\n\nexport function fullName(p: Person): string {\n\n}\n', 'interface Person { first: string; last: string }\n\nexport function fullName(p: Person): string {\n  return `${p.first} ${p.last}`;\n}\n',
      suite('fullName', fn('fullName', [['{ first: "Ada", last: "Lovelace" }', '"Ada Lovelace"']])), [w('Use the two fields.', 'Utilise les deux champs.'), w('return `${p.first} ${p.last}`;', 'return `${p.first} ${p.last}`;')], 'console.log(fullName({ first: "Ada", last: "Lovelace" }));', 'exercise.ts'),
    ex('code', w('Generic', 'Générique'), w('last<T>(list: T[]): T | undefined returns the last item.', 'last<T>(list: T[]): T | undefined renvoie le dernier élément.'),
      'export function last<T>(list: T[]): T | undefined {\n\n}\n', 'export function last<T>(list: T[]): T | undefined {\n  return list[list.length - 1];\n}\n',
      suite('last', fn('last', [['[1, 2, 3]', '3'], ['[]', 'undefined']])), [w('T is whatever type the list holds.', 'T est le type contenu dans la liste.'), w('return list[list.length - 1];', 'return list[list.length - 1];')], 'console.log(last([1, 2, 3]));', 'exercise.ts'),
  ] },
  { id: 'dom', icon: 'web', title: w('The page (DOM)', 'La page (DOM)'), intro: w('Change the page with JavaScript.', 'Modifier la page avec JavaScript.'), exercises: [
    ex('code', w('Make a list', 'Créer une liste'), w('makeList(items) returns a <ul> with one <li> per item.', 'makeList(items) renvoie un <ul> avec un <li> par élément.'),
      'export function makeList(items) {\n\n}\n', 'export function makeList(items) {\n  const ul = document.createElement("ul");\n  for (const t of items) {\n    const li = document.createElement("li");\n    li.textContent = t;\n    ul.append(li);\n  }\n  return ul;\n}\n',
      suite('makeList', "  it('builds', () => { const ul = m.makeList(['a', 'b']); expect(ul.tagName).toBe('UL'); expect(ul.children.length).toBe(2); expect(ul.children[1].textContent).toBe('b'); });"),
      [w('document.createElement("ul")', 'document.createElement("ul")'), w('For each item: create li, set textContent, append.', 'Pour chaque élément : crée li, mets textContent, append.')]),
    ex('bug', w('Safe text', 'Texte sûr'), w('show(el, text) must display text as text, never run HTML from it (XSS).', 'show(el, text) doit afficher le texte comme texte, sans jamais exécuter de HTML (XSS).'),
      'export function show(el, text) {\n  el.innerHTML = text;\n}\n', 'export function show(el, text) {\n  el.textContent = text;\n}\n',
      suite('show', "  it('keeps tags as text', () => { const d = document.createElement('div'); m.show(d, '<b>x</b>'); expect(d.children.length).toBe(0); expect(d.textContent).toBe('<b>x</b>'); });"),
      [w('Which property never reads HTML?', 'Quelle propriété ne lit jamais de HTML ?'), w('el.textContent = text;', 'el.textContent = text;')]),
    ex('code', w('Counter button', 'Bouton compteur'), w('counter() returns a button whose text goes 0, 1, 2… on each click.', 'counter() renvoie un bouton dont le texte passe à 0, 1, 2… à chaque clic.'),
      'export function counter() {\n  const b = document.createElement("button");\n  b.textContent = "0";\n\n  return b;\n}\n', 'export function counter() {\n  const b = document.createElement("button");\n  b.textContent = "0";\n  let n = 0;\n  b.addEventListener("click", () => { b.textContent = String(++n); });\n  return b;\n}\n',
      suite('counter', "  it('counts clicks', () => { const b = m.counter(); b.click(); b.click(); expect(b.textContent).toBe('2'); });"),
      [w('Listen to "click".', 'Écoute "click".'), w('b.addEventListener("click", () => { b.textContent = String(++n); });', 'b.addEventListener("click", () => { b.textContent = String(++n); });')]),
  ] },
  { id: 'html', icon: 'web', title: w('HTML', 'HTML'), intro: w('Structure a page that everyone can use.', 'Structurer une page utilisable par tous.'), exercises: [
    ex('code', w('A real page', 'Une vraie page'), w('Add a <h1>, a <p> and an image with alt text.', 'Ajoute un <h1>, un <p> et une image avec un texte alt.'),
      '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Me</title></head>\n<body>\n\n</body>\n</html>\n', '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Me</title></head>\n<body>\n  <h1>Hello</h1>\n  <p>About me.</p>\n  <img src="me.png" alt="My face">\n</body>\n</html>\n',
      suite('page', "  const doc = new DOMParser().parseFromString(html, 'text/html');\n  it('has a title h1', () => expect(doc.querySelector('h1')).not.toBeNull());\n  it('has a paragraph', () => expect(doc.querySelector('p')).not.toBeNull());\n  it('image has alt text', () => expect(doc.querySelector('img')?.getAttribute('alt')).toBeTruthy());"),
      [w('Write the tags between <body> and </body>.', 'Écris les balises entre <body> et </body>.'), w('<img src="me.png" alt="My face">', '<img src="me.png" alt="Mon visage">')], undefined, 'exercise.html'),
    ex('code', w('A labelled form', 'Un formulaire étiqueté'), w('A form with an email input that has a <label for>, and a submit button.', 'Un formulaire avec un champ email relié à un <label for>, et un bouton d’envoi.'),
      '<form>\n\n</form>\n', '<form>\n  <label for="email">Email</label>\n  <input id="email" type="email" required>\n  <button type="submit">Send</button>\n</form>\n',
      suite('form', "  const doc = new DOMParser().parseFromString(html, 'text/html');\n  it('email input', () => expect(doc.querySelector('input[type=email]')).not.toBeNull());\n  it('label linked', () => { const i = doc.querySelector('input[type=email]'); expect(i && doc.querySelector(`label[for=\"${i.id}\"]`)).toBeTruthy(); });\n  it('submit button', () => expect(doc.querySelector('button[type=submit]')).not.toBeNull());"),
      [w('label for="x" points to input id="x".', 'label for="x" pointe vers input id="x".'), w('<label for="email">Email</label><input id="email" type="email">', '<label for="email">Email</label><input id="email" type="email">')], undefined, 'exercise.html'),
    ex('bug', w('Landmarks', 'Repères'), w('Use <header>, <main> and <footer> instead of plain divs.', 'Utilise <header>, <main> et <footer> au lieu de simples div.'),
      '<div class="header">Site</div>\n<div class="main">Content</div>\n<div class="footer">© 2026</div>\n', '<header>Site</header>\n<main>Content</main>\n<footer>© 2026</footer>\n',
      suite('landmarks', "  const doc = new DOMParser().parseFromString(html, 'text/html');\n  for (const tag of ['header', 'main', 'footer']) it(tag, () => expect(doc.querySelector(tag)).not.toBeNull());"),
      [w('Screen readers jump between landmarks.', 'Les lecteurs d’écran sautent entre les repères.'), w('<header>…</header><main>…</main><footer>…</footer>', '<header>…</header><main>…</main><footer>…</footer>')], undefined, 'exercise.html'),
  ] },
  { id: 'css', icon: 'palette', title: w('CSS', 'CSS'), intro: w('Layout and style with flexbox and grid.', 'Mise en page et style avec flexbox et grid.'), exercises: [
    ex('code', w('Center it', 'Le centrer'), w('Make .box use flexbox and center its content both ways.', 'Fais que .box utilise flexbox et centre son contenu dans les deux sens.'),
      '.box {\n\n}\n', '.box {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n}\n',
      suite('center', "  const el = document.createElement('div'); el.className = 'box'; document.body.append(el);\n  const s = getComputedStyle(el);\n  it('flex', () => expect(s.display).toBe('flex'));\n  it('centered', () => { expect(s.justifyContent).toBe('center'); expect(s.alignItems).toBe('center'); });"),
      [w('display: flex first.', 'd’abord display: flex.'), w('justify-content and align-items: center.', 'justify-content et align-items : center.')], undefined, 'exercise.css'),
    ex('code', w('Three columns', 'Trois colonnes'), w('Make .grid a grid of 3 equal columns with a 16px gap.', 'Fais de .grid une grille de 3 colonnes égales avec un écart de 16px.'),
      '.grid {\n\n}\n', '.grid {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 16px;\n}\n',
      suite('grid', "  const el = document.createElement('div'); el.className = 'grid'; el.style.width = '300px'; document.body.append(el);\n  const s = getComputedStyle(el);\n  it('grid', () => expect(s.display).toBe('grid'));\n  it('3 columns', () => expect(s.gridTemplateColumns.split(' ').length).toBe(3));\n  it('gap', () => expect(s.columnGap).toBe('16px'));"),
      [w('repeat(3, 1fr)', 'repeat(3, 1fr)'), w('display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;', 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;')], undefined, 'exercise.css'),
    ex('code', w('Readable text', 'Texte lisible'), w('Give .note a font-size of 1.25rem and a line-height of 1.5.', 'Donne à .note une taille de 1.25rem et une hauteur de ligne de 1.5.'),
      '.note {\n\n}\n', '.note {\n  font-size: 1.25rem;\n  line-height: 1.5;\n}\n',
      suite('note', "  const el = document.createElement('p'); el.className = 'note'; document.body.append(el);\n  const s = getComputedStyle(el);\n  it('size', () => expect(s.fontSize).toBe('20px'));\n  it('line height', () => expect(s.lineHeight).toBe('30px'));"),
      [w('rem follows the reader’s settings.', 'rem suit les réglages du lecteur.'), w('font-size: 1.25rem; line-height: 1.5;', 'font-size: 1.25rem; line-height: 1.5;')], undefined, 'exercise.css'),
  ] },
  { id: 'security', icon: 'shield', title: w('Security', 'Sécurité'), intro: w('The OWASP mistakes, and how to avoid them.', 'Les erreurs OWASP, et comment les éviter.'), exercises: [
    ex('code', w('Escape HTML', 'Échapper le HTML'), w('escapeHtml("<a>&") returns "&lt;a&gt;&amp;".', 'escapeHtml("<a>&") renvoie "&lt;a&gt;&amp;".'),
      'export function escapeHtml(s) {\n\n}\n', 'export function escapeHtml(s) {\n  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\'/g, "&#39;");\n}\n',
      suite('escapeHtml', fn('escapeHtml', [['"<a>&"', '"&lt;a&gt;&amp;"'], ['\'"x"\'', '"&quot;x&quot;"']])),
      [w('Replace & first, or you escape your own escapes.', 'Remplace & d’abord, sinon tu échappes tes échappements.'), w('& → &amp; < → &lt; > → &gt; " → &quot;', '& → &amp; < → &lt; > → &gt; " → &quot;')], 'console.log(escapeHtml("<a>&"));'),
    ex('bug', w('Unsafe query', 'Requête dangereuse'), w('buildQuery must return SQL with ? and the values apart, never pasted in.', 'buildQuery doit renvoyer du SQL avec ? et les valeurs à part, jamais collées dedans.'),
      'export function buildQuery(name) {\n  return { sql: "SELECT * FROM users WHERE name = \'" + name + "\'", params: [] };\n}\n', 'export function buildQuery(name) {\n  return { sql: "SELECT * FROM users WHERE name = ?", params: [name] };\n}\n',
      suite('buildQuery', "  it('uses a placeholder', () => { const q = m.buildQuery(\"x' OR 1=1 --\"); expect(q.sql).not.toContain('OR 1=1'); expect(q.params).toEqual([\"x' OR 1=1 --\"]); });"),
      [w('What if the name contains a quote?', 'Et si le nom contient une apostrophe ?'), w('Use "… WHERE name = ?" and params: [name].', 'Utilise "… WHERE name = ?" et params: [name].')], 'console.log(buildQuery("x\' OR 1=1 --"));'),
    ex('code', w('Strong password', 'Mot de passe solide'), w('isStrong(p): 12+ characters with a lower case, an upper case, a digit and a symbol.', 'isStrong(p) : 12+ caractères avec une minuscule, une majuscule, un chiffre et un symbole.'),
      'export function isStrong(p) {\n\n}\n', 'export function isStrong(p) {\n  return p.length >= 12 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\\d/.test(p) && /[^A-Za-z0-9]/.test(p);\n}\n',
      suite('isStrong', fn('isStrong', [['"Short1!"', 'false'], ['"longpassword123!"', 'false'], ['"Long-Password-123"', 'true']])),
      [w('Check each rule separately.', 'Vérifie chaque règle séparément.'), w('/[a-z]/, /[A-Z]/, /\\d/, /[^A-Za-z0-9]/ and length >= 12', '/[a-z]/, /[A-Z]/, /\\d/, /[^A-Za-z0-9]/ et length >= 12')], 'console.log(isStrong("Long-Password-123"));'),
  ] },
  { id: 'testing', icon: 'check', title: w('Writing tests', 'Écrire des tests'), intro: w('Code that checks code (TDD, Beck).', 'Du code qui vérifie le code (TDD, Beck).'), exercises: [
    ex('code', w('Make the tests pass', 'Faire passer les tests'), w('Read the tests, then write clamp(x, min, max).', 'Lis les tests, puis écris clamp(x, min, max).'),
      'export function clamp(x, min, max) {\n\n}\n', 'export function clamp(x, min, max) {\n  return Math.min(max, Math.max(min, x));\n}\n',
      suite('clamp', fn('clamp', [['5, 0, 10', '5'], ['-3, 0, 10', '0'], ['42, 0, 10', '10']])),
      [w('Below min gives min; above max gives max.', 'Sous min donne min ; au-dessus de max donne max.'), w('Math.min(max, Math.max(min, x))', 'Math.min(max, Math.max(min, x))')], 'console.log(clamp(42, 0, 10));'),
    ex('code', w('Edge cases', 'Cas limites'), w('average(list) returns the mean, and 0 for an empty list (not NaN).', 'average(list) renvoie la moyenne, et 0 pour une liste vide (pas NaN).'),
      'export function average(list) {\n  return list.reduce((a, b) => a + b, 0) / list.length;\n}\n', 'export function average(list) {\n  if (!list.length) return 0;\n  return list.reduce((a, b) => a + b, 0) / list.length;\n}\n',
      suite('average', fn('average', [['[2, 4]', '3'], ['[]', '0']])),
      [w('What is 0 / 0 in JavaScript?', 'Combien vaut 0 / 0 en JavaScript ?'), w('if (!list.length) return 0;', 'if (!list.length) return 0;')], 'console.log(average([]));'),
    ex('parsons', w('Fizz buzz', 'Fizz buzz'), w('fizz(n): "FizzBuzz" for multiples of 15, "Fizz" of 3, "Buzz" of 5, else the number as text.', 'fizz(n) : "FizzBuzz" pour les multiples de 15, "Fizz" de 3, "Buzz" de 5, sinon le nombre en texte.'),
      '', 'export function fizz(n) {\n  if (n % 15 === 0) return "FizzBuzz";\n  if (n % 3 === 0) return "Fizz";\n  if (n % 5 === 0) return "Buzz";\n  return String(n);\n}\n',
      suite('fizz', fn('fizz', [['15', '"FizzBuzz"'], ['9', '"Fizz"'], ['10', '"Buzz"'], ['7', '"7"']])),
      [w('The most specific test comes first.', 'Le test le plus précis vient d’abord.'), w('15, then 3, then 5, then the number.', '15, puis 3, puis 5, puis le nombre.')], 'console.log(fizz(15));'),
  ] },
  { id: 'debugging', icon: 'search', title: w('Debugging', 'Débogage'), intro: w('Find the bug calmly: read, step, test.', 'Trouver le bug calmement : lire, avancer pas à pas, tester.'), exercises: [
    ex('bug', w('Wrong total', 'Total faux'), w('cartTotal must add price × quantity for each item.', 'cartTotal doit additionner prix × quantité pour chaque article.'),
      'export function cartTotal(items) {\n  let total = 0;\n  for (const item of items) {\n    total = item.price * item.qty;\n  }\n  return total;\n}\n', 'export function cartTotal(items) {\n  let total = 0;\n  for (const item of items) {\n    total += item.price * item.qty;\n  }\n  return total;\n}\n',
      suite('cartTotal', fn('cartTotal', [['[{ price: 2, qty: 3 }, { price: 5, qty: 1 }]', '11']])),
      [w('Step through and watch total.', 'Avance pas à pas et regarde total.'), w('= replaces; += adds.', '= remplace ; += ajoute.')], 'console.log(cartTotal([{ price: 2, qty: 3 }, { price: 5, qty: 1 }]));'),
    ex('bug', w('Sorted wrong', 'Mal trié'), w('sortNumbers([10, 9, 1]) must return [1, 9, 10].', 'sortNumbers([10, 9, 1]) doit renvoyer [1, 9, 10].'),
      'export function sortNumbers(list) {\n  return [...list].sort();\n}\n', 'export function sortNumbers(list) {\n  return [...list].sort((a, b) => a - b);\n}\n',
      suite('sortNumbers', fn('sortNumbers', [['[10, 9, 1]', '[1, 9, 10]']])),
      [w('sort() compares as text: "10" < "9".', 'sort() compare en texte : "10" < "9".'), w('sort((a, b) => a - b)', 'sort((a, b) => a - b)')], 'console.log(sortNumbers([10, 9, 1]));'),
    ex('bug', w('Mutated input', 'Entrée modifiée'), w('addItem must return a new list and leave the old one unchanged.', 'addItem doit renvoyer une nouvelle liste et laisser l’ancienne intacte.'),
      'export function addItem(list, item) {\n  list.push(item);\n  return list;\n}\n', 'export function addItem(list, item) {\n  return [...list, item];\n}\n',
      suite('addItem', "  it('new list', () => { const a = [1]; const b = m.addItem(a, 2); expect(b).toEqual([1, 2]); expect(a).toEqual([1]); });"),
      [w('push changes the list it is called on.', 'push modifie la liste sur laquelle on l’appelle.'), w('return [...list, item];', 'return [...list, item];')], 'const a = [1];\nconsole.log(addItem(a, 2), a);'),
  ] },
];

/** Puts the solution's lines in a fixed shuffled order for a Parsons problem. */
export function shuffledLines(e: Exercise): string[] {
  const lines = e.solution.split('\n').filter(l => l.trim());
  let seed = [...e.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const out = [...lines];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out.join('\n') === lines.join('\n') ? [...out.slice(1), out[0]] : out;
}

export const words = (x: Words, lang: string) => (lang === 'fr' ? x.fr : x.en);
export const exercisePath = (c: Course, e: Exercise) => `training/${c.id}/${e.id}-${e.title.en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.${e.file.split('.').pop()}`;

/** The hidden test file for an exercise, importing it as `m` (code) or as text `html` (HTML). */
export function testFileFor(path: string, e: Exercise): { path: string; content: string } {
  const name = path.split('/').pop()!;
  const ext = name.split('.').pop();
  const head = ext === 'html' ? `const html = await (await fetch((await import('./${name}')).default)).text();\n`
    : ext === 'css' ? `import './${name}';\n`
    : `import * as m from './${name}';\n`;
  return { path: path.replace(/\.[^.]+$/, '.check.test.js'), content: head + e.tests };
}

// ---------- progress (Leitner boxes) ----------

export interface Progress { done: Record<string, number>; box: Record<string, number>; due: Record<string, number>; attempts: Record<string, number> }
const KEY = 'oi1.code.training';
export function loadProgress(): Progress {
  try { return { done: {}, box: {}, due: {}, attempts: {}, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { done: {}, box: {}, due: {}, attempts: {} }; }
}
export function saveProgress(p: Progress) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private window */ } }
const DAY = 86_400_000;
const GAPS = [0, 1, 3, 7, 16, 35];
/** A success moves the exercise up a box (seen again later); a miss sends it back to box 1 (seen tomorrow). */
export function record(p: Progress, id: string, ok: boolean, now = Date.now()): Progress {
  const box = ok ? Math.min(5, (p.box[id] ?? 0) + 1) : 1;
  return {
    done: ok ? { ...p.done, [id]: now } : p.done,
    box: { ...p.box, [id]: box },
    due: { ...p.due, [id]: now + GAPS[box] * DAY },
    attempts: { ...p.attempts, [id]: (p.attempts[id] ?? 0) + (ok ? 0 : 1) },
  };
}
export function dueReviews(p: Progress, now = Date.now()): string[] {
  return Object.keys(p.due).filter(id => p.due[id] <= now && (p.box[id] ?? 0) < 5);
}
