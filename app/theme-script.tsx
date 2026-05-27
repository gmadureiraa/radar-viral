/**
 * ThemeScript — script inline que roda ANTES do primeiro paint.
 *
 * Lê preferência salva (localStorage 'rdv-theme') ou system preference
 * (prefers-color-scheme: dark) e seta data-theme="dark" no <html> antes
 * do React hidratar. Evita FOUC (flash do tema light antes do dark aplicar).
 *
 * Renderizado dentro do <head> em app/layout.tsx via dangerouslySetInnerHTML.
 *
 * Não causa SSR mismatch: o script só MUTA o atributo data-theme do <html>,
 * que o React não controla. try/catch silencia ambientes sem localStorage.
 */
const themeScriptSource = `(function(){try{var s=localStorage.getItem('rdv-theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var t=s||m;if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`;

export default function ThemeScript() {
  return (
    <script
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: themeScriptSource }}
    />
  );
}
