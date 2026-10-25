// Ready-made projects to start from. Each one runs as is in the preview and on GitHub Pages.

import type { MessageKey } from '../../shell/i18n';
import type { Files } from './build';

export interface Template {
  id: string;
  name: MessageKey;
  about: MessageKey;
  /** The file opened first. */
  open: string;
  files: Files;
}

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My page</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="hero">
    <p class="kicker">Hello</p>
    <h1>My first page</h1>
    <p>Change this text in <b>index.html</b> and watch the preview update.</p>
    <button id="hello">Say hello</button>
  </header>
  <script src="script.js"></script>
</body>
</html>
`;

const pageCss = `:root { --gold: #D4A843; --ink: #1f1f24; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; color: var(--ink); background: #faf8f3; }
.hero { min-height: 100vh; display: grid; place-content: center; text-align: center; padding: 24px; }
.kicker { letter-spacing: .2em; text-transform: uppercase; color: var(--gold); font-weight: 700; margin: 0; }
h1 { font-size: clamp(2.2rem, 7vw, 4.5rem); margin: .2em 0; }
button { justify-self: center; padding: 12px 26px; border: 0; border-radius: 999px; background: var(--gold); color: #fff; font-size: 1rem; cursor: pointer; }
button:hover { filter: brightness(1.08); }
`;

const pageJs = `document.getElementById('hello').addEventListener('click', () => {
  const name = prompt('What is your name?') || 'friend';
  document.querySelector('h1').textContent = 'Hello, ' + name + '!';
  console.log('Said hello to', name);
});
`;

const portfolio = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Alex Doe · Portfolio</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <nav><b>Alex Doe</b><span><a href="#work">Work</a><a href="#about">About</a><a href="#contact">Contact</a></span></nav>
  <header>
    <h1>Designer and developer<br>making calm, useful things.</h1>
    <p>Based in Montréal. Available for new projects.</p>
  </header>
  <section id="work" class="grid">
    <article><div class="shot" style="--c:#7FA7E8"></div><h3>Banking app</h3><p>Mobile design, 2026</p></article>
    <article><div class="shot" style="--c:#5FC79A"></div><h3>Garden shop</h3><p>Website and brand</p></article>
    <article><div class="shot" style="--c:#E8875F"></div><h3>Festival poster</h3><p>Print, 2025</p></article>
    <article><div class="shot" style="--c:#B48CF0"></div><h3>Music player</h3><p>Desktop app</p></article>
  </section>
  <section id="about" class="about">
    <h2>About</h2>
    <p>I have ten years of experience in product design and front-end code. I like clear words, strong type and fast pages.</p>
  </section>
  <footer id="contact"><a href="mailto:hello@example.com">hello@example.com</a></footer>
</body>
</html>
`;

const portfolioCss = `* { box-sizing: border-box; }
body { margin: 0; font-family: Georgia, serif; background: #111114; color: #f0ede6; }
a { color: inherit; }
nav { display: flex; justify-content: space-between; padding: 22px 6vw; font-family: system-ui, sans-serif; }
nav a { margin-left: 22px; text-decoration: none; opacity: .75; }
nav a:hover { opacity: 1; }
header { padding: 12vh 6vw 8vh; }
h1 { font-size: clamp(2rem, 5.5vw, 4.2rem); font-weight: 400; line-height: 1.1; margin: 0 0 18px; }
header p { font-family: system-ui, sans-serif; opacity: .7; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 28px; padding: 0 6vw 10vh; }
.shot { aspect-ratio: 4 / 3; border-radius: 14px; background: linear-gradient(135deg, var(--c), #222); transition: transform .3s; }
article:hover .shot { transform: translateY(-6px); }
article h3 { margin: 14px 0 2px; font-weight: 500; }
article p { margin: 0; opacity: .6; font-family: system-ui, sans-serif; font-size: .9rem; }
.about { padding: 6vh 6vw; max-width: 760px; font-size: 1.2rem; line-height: 1.6; }
footer { padding: 8vh 6vw; font-size: clamp(1.4rem, 4vw, 2.4rem); }
`;

const shop = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Little Shop</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header><h1>Little Shop</h1><button id="cart-btn">Cart (<span id="count">0</span>)</button></header>
  <main id="products" class="products"></main>
  <aside id="cart" class="cart" hidden>
    <h2>Your cart</h2>
    <ul id="lines"></ul>
    <p class="total">Total: <b id="total">$0.00</b></p>
    <button id="checkout">Check out</button>
  </aside>
  <script type="module" src="shop.js"></script>
</body>
</html>
`;

const shopCss = `* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: #f6f3ec; color: #222; }
header { display: flex; justify-content: space-between; align-items: center; padding: 16px 5vw; background: #fff; position: sticky; top: 0; box-shadow: 0 2px 12px rgba(0,0,0,.06); }
h1 { font-size: 1.4rem; margin: 0; }
button { border: 0; border-radius: 10px; padding: 10px 16px; background: #222; color: #fff; cursor: pointer; font: inherit; }
.products { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; padding: 28px 5vw; }
.card { background: #fff; border-radius: 16px; padding: 16px; display: grid; gap: 8px; }
.card .pic { aspect-ratio: 1; border-radius: 12px; display: grid; place-items: center; font-size: 3.5rem; background: #f1ede4; }
.card h3 { margin: 4px 0 0; font-size: 1rem; }
.card .price { color: #9A7424; font-weight: 700; }
.cart { position: fixed; right: 16px; top: 76px; width: min(340px, calc(100% - 32px)); background: #fff; border-radius: 16px; padding: 18px; box-shadow: 0 18px 50px rgba(0,0,0,.18); }
.cart ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
.cart li { display: flex; justify-content: space-between; gap: 8px; }
.total { border-top: 1px solid #eee; padding-top: 10px; }
`;

const shopData = `[
  { "id": 1, "name": "Coffee mug", "price": 14, "icon": "☕" },
  { "id": 2, "name": "Notebook", "price": 9.5, "icon": "📓" },
  { "id": 3, "name": "Plant", "price": 22, "icon": "🪴" },
  { "id": 4, "name": "Headphones", "price": 79, "icon": "🎧" },
  { "id": 5, "name": "Candle", "price": 12, "icon": "🕯️" },
  { "id": 6, "name": "Backpack", "price": 54, "icon": "🎒" }
]
`;

const shopJs = `import products from './products.json';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const cart = JSON.parse(localStorage.getItem('cart') || '{}');
const $ = id => document.getElementById(id);

function draw() {
  $('products').innerHTML = products.map(p => \`
    <div class="card">
      <div class="pic">\${p.icon}</div>
      <h3>\${p.name}</h3>
      <span class="price">\${money.format(p.price)}</span>
      <button data-add="\${p.id}">Add to cart</button>
    </div>\`).join('');
  const lines = products.filter(p => cart[p.id]);
  $('lines').innerHTML = lines.map(p => \`<li><span>\${cart[p.id]} × \${p.name}</span><b>\${money.format(cart[p.id] * p.price)}</b></li>\`).join('') || '<li>Your cart is empty.</li>';
  $('count').textContent = Object.values(cart).reduce((a, b) => a + b, 0);
  $('total').textContent = money.format(lines.reduce((sum, p) => sum + cart[p.id] * p.price, 0));
  localStorage.setItem('cart', JSON.stringify(cart));
}

document.addEventListener('click', e => {
  const id = e.target.dataset.add;
  if (id) { cart[id] = (cart[id] || 0) + 1; draw(); }
});
$('cart-btn').onclick = () => { $('cart').hidden = !$('cart').hidden; };
$('checkout').onclick = () => { alert('Thank you for your order!'); for (const k in cart) delete cart[k]; draw(); };
draw();
`;

const blogHead = (title: string) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header><a href="index.html" class="brand">My Blog</a><nav><a href="index.html">Posts</a><a href="about.html">About</a></nav></header>
  <main>
`;
const blogFoot = `  </main>
  <footer>Made with Office Code+</footer>
</body>
</html>
`;

const blog: Files = {
  'index.html': `${blogHead('My Blog')}    <h1>Latest posts</h1>
    <article><a href="posts/first-post.html"><h2>My first post</h2></a><time>October 25, 2026</time><p>Why I started writing, and what comes next.</p></article>
    <article><a href="posts/coffee.html"><h2>The perfect coffee</h2></a><time>October 20, 2026</time><p>Five small changes that made my morning cup much better.</p></article>
${blogFoot}`,
  'about.html': `${blogHead('About · My Blog')}    <h1>About me</h1>
    <p>I write about simple things that make life better. Edit <b>about.html</b> to tell your own story.</p>
${blogFoot}`,
  'posts/first-post.html': `${blogHead('My first post').replace(/href="(index|about|style)/g, 'href="../$1')}    <h1>My first post</h1>
    <time>October 25, 2026</time>
    <p>Welcome to my blog! Every post is one HTML file in the <b>posts</b> folder. Copy this one to write a new post, then add a link to it on the home page.</p>
    <p><a href="../index.html">← All posts</a></p>
${blogFoot}`,
  'posts/coffee.html': `${blogHead('The perfect coffee').replace(/href="(index|about|style)/g, 'href="../$1')}    <h1>The perfect coffee</h1>
    <time>October 20, 2026</time>
    <ol><li>Buy whole beans.</li><li>Grind just before brewing.</li><li>Use water just off the boil.</li><li>Weigh it: 1 g of coffee for 16 g of water.</li><li>Drink it while it is warm.</li></ol>
    <p><a href="../index.html">← All posts</a></p>
${blogFoot}`,
  'style.css': `* { box-sizing: border-box; }
body { margin: 0; font-family: Georgia, serif; color: #2a2a2e; background: #fffdf8; line-height: 1.7; }
header { display: flex; justify-content: space-between; align-items: center; max-width: 720px; margin: 0 auto; padding: 24px 20px; font-family: system-ui, sans-serif; }
header a { color: inherit; text-decoration: none; margin-left: 18px; }
.brand { font-weight: 800; margin: 0; }
main { max-width: 720px; margin: 0 auto; padding: 0 20px 60px; font-size: 1.12rem; }
h1 { font-size: 2.4rem; line-height: 1.2; }
article { padding: 18px 0; border-bottom: 1px solid #eee; }
article a { color: inherit; text-decoration: none; }
article h2 { margin: 0; }
article a:hover h2 { color: #9A7424; }
time { font-family: system-ui, sans-serif; font-size: .85rem; color: #888; }
footer { text-align: center; color: #999; font-family: system-ui, sans-serif; padding: 30px; }
`,
};

const reactFiles: Files = {
  'index.html': `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My React app</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="src/main.tsx"></script>
</body>
</html>
`,
  'package.json': `{
  "name": "my-react-app",
  "private": true,
  "dependencies": {
    "react": "18.3.1",
    "react-dom": "18.3.1"
  }
}
`,
  'src/main.tsx': `import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);
`,
  'src/App.tsx': `import { useEffect, useState } from 'react';

interface Task { id: number; text: string; done: boolean }

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() => JSON.parse(localStorage.getItem('tasks') ?? '[]'));
  const [text, setText] = useState('');

  useEffect(() => localStorage.setItem('tasks', JSON.stringify(tasks)), [tasks]);

  const add = () => {
    if (!text.trim()) return;
    setTasks([...tasks, { id: Date.now(), text: text.trim(), done: false }]);
    setText('');
  };
  const left = tasks.filter(t => !t.done).length;

  return (
    <main className="app">
      <h1>My tasks</h1>
      <form onSubmit={e => { e.preventDefault(); add(); }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="What needs doing?" />
        <button>Add</button>
      </form>
      <ul>
        {tasks.map(t => (
          <li key={t.id} className={t.done ? 'done' : ''}>
            <label>
              <input type="checkbox" checked={t.done}
                onChange={() => setTasks(tasks.map(x => (x.id === t.id ? { ...x, done: !x.done } : x)))} />
              {t.text}
            </label>
            <button className="remove" onClick={() => setTasks(tasks.filter(x => x.id !== t.id))}>×</button>
          </li>
        ))}
      </ul>
      <p className="left">{left === 1 ? '1 task left' : left + ' tasks left'}</p>
    </main>
  );
}
`,
  'src/styles.css': `* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; font-family: system-ui, sans-serif; background: linear-gradient(160deg, #2b2b33, #1c1c22); color: #f0ede6; }
.app { max-width: 480px; margin: 0 auto; padding: 48px 20px; }
h1 { font-size: 2.2rem; margin: 0 0 20px; color: #F2D78B; }
form { display: flex; gap: 8px; }
input:not([type]) { flex: 1; padding: 12px 14px; border-radius: 12px; border: 1px solid #44444f; background: #26262d; color: inherit; font: inherit; }
button { padding: 0 18px; border: 0; border-radius: 12px; background: #D4A843; color: #1c1c22; font-weight: 700; cursor: pointer; }
ul { list-style: none; padding: 0; margin: 20px 0; display: grid; gap: 8px; }
li { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-radius: 12px; background: #2d2d35; }
li label { display: flex; gap: 10px; align-items: center; }
li.done label { opacity: .5; text-decoration: line-through; }
.remove { background: none; color: #999; font-size: 1.3rem; padding: 0 6px; }
.left { color: #a9a6a0; }
`,
};

export const TEMPLATES: Template[] = [
  { id: 'page', name: 'code.tpl.page', about: 'code.tpl.pageAbout', open: 'index.html', files: { 'index.html': page, 'style.css': pageCss, 'script.js': pageJs } },
  { id: 'portfolio', name: 'code.tpl.portfolio', about: 'code.tpl.portfolioAbout', open: 'index.html', files: { 'index.html': portfolio, 'style.css': portfolioCss } },
  { id: 'shop', name: 'code.tpl.shop', about: 'code.tpl.shopAbout', open: 'shop.js', files: { 'index.html': shop, 'style.css': shopCss, 'shop.js': shopJs, 'products.json': shopData } },
  { id: 'blog', name: 'code.tpl.blog', about: 'code.tpl.blogAbout', open: 'index.html', files: blog },
  { id: 'react', name: 'code.tpl.react', about: 'code.tpl.reactAbout', open: 'src/App.tsx', files: reactFiles },
  { id: 'empty', name: 'code.tpl.empty', about: 'code.tpl.emptyAbout', open: 'index.html', files: { 'index.html': '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>New project</title>\n</head>\n<body>\n  \n</body>\n</html>\n' } },
];
