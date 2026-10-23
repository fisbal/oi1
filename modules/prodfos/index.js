// Office ProDFos: the PDF module.
// ProDFos is its own Flutter app (github.com/fisbal/prodfos). For now OI1 shows its
// published web version inside the tab; deeper links (open this PDF, export a letter)
// come once both sides share files through the module contract.

const PRODFOS_URL = 'https://fisbal.github.io/prodfos/';

export default {
  id: 'prodfos',
  name: 'Office ProDFos',
  extensions: ['.pdf'],

  mount(el, shell) {
    shell.setTitle('ProDFos');
    el.innerHTML = `
      <div class="embed-bar">ProDFos runs inside OI1 from its web version.
        <a href="${PRODFOS_URL}" target="_blank" rel="noopener">Open in its own window</a></div>
      <iframe class="embed" src="${PRODFOS_URL}" title="Office ProDFos"
        allow="clipboard-read; clipboard-write; fullscreen"></iframe>`;
    return {};
  },
};
