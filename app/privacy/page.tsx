import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade — Radar Viral",
  description:
    "Como o Radar Viral coleta, usa e protege dados pessoais. Inclui scraping de fontes públicas (notícias, Instagram, TikTok), cache de mídia e serviços de terceiros.",
  alternates: { canonical: "https://radar.kaleidos.com.br/privacy" },
};

export default function PrivacyPage() {
  return (
    <main
      style={{
        background: "var(--color-rdv-paper)",
        color: "var(--color-rdv-ink)",
        minHeight: "100dvh",
        padding: "64px 20px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <p
          className="rdv-mono"
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--color-rdv-rec)",
          }}
        >
          Legal
        </p>
        <h1
          className="rdv-display"
          style={{
            fontSize: 44,
            lineHeight: 1.05,
            marginTop: 8,
            fontStyle: "italic",
          }}
        >
          Política de Privacidade
        </h1>
        <p
          className="rdv-mono"
          style={{
            fontSize: 12,
            color: "var(--color-rdv-muted)",
            marginTop: 12,
          }}
        >
          Última atualização: 8 de maio de 2026
        </p>

        <Section title="1. Quem somos">
          <p>
            Radar Viral é um produto operado por Kaleidos Digital, com sede no
            Brasil. Controlador de dados: Gabriel Madureira. Contato:{" "}
            <a className="rdv-link" href="mailto:gf.madureiraa@gmail.com">
              gf.madureiraa@gmail.com
            </a>
            .
          </p>
        </Section>

        <Section title="2. Dados que coletamos">
          <ul>
            <li>
              <strong>Conta:</strong> nome, e-mail, autenticação via Neon Auth
              (cookie de sessão criptografado).
            </li>
            <li>
              <strong>Fontes monitoradas:</strong> URLs RSS, perfis públicos de
              Instagram/TikTok/Twitter/Threads/LinkedIn, palavras-chave que
              você cadastra para receber sinais.
            </li>
            <li>
              <strong>Conteúdo público scrapado:</strong> capturamos metadados
              públicos de posts (autor, caption, contagens, URLs de mídia)
              via Apify e RSS feeds. Não acessamos contas privadas nem dados
              pessoais protegidos.
            </li>
            <li>
              <strong>Briefing diário:</strong> resumos editoriais gerados a
              partir das fontes que você monitora, salvos em sua conta para
              histórico.
            </li>
            <li>
              <strong>Pagamento:</strong> processado integralmente pela Stripe
              quando aplicável; nós nunca recebemos dados de cartão.
            </li>
            <li>
              <strong>Uso e telemetria:</strong> logs técnicos, IP, user-agent
              e eventos de produto usados para detectar abuso e melhorar o
              serviço.
            </li>
          </ul>
        </Section>

        <Section title="3. Como usamos">
          <ul>
            <li>
              Entregar o serviço: scrapear fontes públicas, gerar briefs
              diários, alertar sobre tendências relevantes ao seu nicho.
            </li>
            <li>
              Enviar e-mails transacionais (boas-vindas, briefs diários,
              recibos, atualizações importantes).
            </li>
            <li>Processar pagamentos quando aplicável e prevenir abuso.</li>
            <li>
              Melhorar o produto através de métricas agregadas e anônimas.
            </li>
          </ul>
        </Section>

        <Section title="4. Conteúdo público e direitos autorais">
          <p>
            O Radar Viral coleta apenas conteúdo <strong>público</strong> via
            APIs e scrapers. Metadados textuais (caption, autor, contagens) e
            URLs de mídia ficam visíveis apenas no seu painel privado, para
            análise editorial. Imagens e vídeos referenciados continuam
            hospedados nos CDNs originais (Instagram, TikTok, etc.) e expiram
            conforme política de cada plataforma.
          </p>
          <p style={{ marginTop: 12 }}>
            Você é responsável por respeitar os direitos autorais e termos das
            plataformas-fonte ao reaproveitar qualquer informação capturada.
            O produto entrega <em>sinais editoriais e estrutura analítica</em>
            , não cópia.
          </p>
        </Section>

        <Section title="5. Fornecedores (subprocessadores)">
          <ul>
            <li>
              <strong>Neon</strong> — banco Postgres serverless (US/EU).
            </li>
            <li>
              <strong>Vercel</strong> — hospedagem e funções serverless.
            </li>
            <li>
              <strong>Google Gemini</strong> — geração de briefs por IA.
            </li>
            <li>
              <strong>Apify</strong> — coleta de metadados públicos
              (Instagram, TikTok, Twitter, Threads, LinkedIn).
            </li>
            <li>
              <strong>Resend</strong> — envio de e-mails transacionais.
            </li>
            <li>
              <strong>Stripe</strong> — processamento de pagamentos quando
              aplicável.
            </li>
          </ul>
        </Section>

        <Section title="6. Retenção e exclusão">
          <p>
            Mantemos seus dados de conta enquanto sua assinatura estiver ativa.
            Posts scrapados de fontes públicas têm TTL de 90 dias por padrão
            (rotação de cache). Você pode solicitar exclusão completa da conta
            e histórico a qualquer momento escrevendo para{" "}
            <a className="rdv-link" href="mailto:gf.madureiraa@gmail.com">
              gf.madureiraa@gmail.com
            </a>
            . Cumprimos a solicitação em até 30 dias corridos.
          </p>
        </Section>

        <Section title="7. Seus direitos (LGPD / GDPR)">
          <p>
            Você tem direito a acesso, correção, portabilidade, exclusão e
            oposição ao tratamento de seus dados pessoais. Para exercer, envie
            e-mail ao contato acima. Pode também reclamar à ANPD (Brasil) ou à
            autoridade de proteção de dados aplicável no seu país.
          </p>
        </Section>

        <Section title="8. Segurança">
          <p>
            Usamos TLS em todas as conexões, senhas com hashing, tokens
            escopados para APIs externas e controle de acesso por role.
            Notificaremos você e a ANPD em caso de incidente que exponha seus
            dados pessoais.
          </p>
        </Section>

        <Section title="9. Alterações">
          <p>
            Podemos atualizar esta política. Mudanças relevantes serão
            comunicadas por e-mail ou dentro do app antes de entrarem em vigor.
          </p>
        </Section>

        <Link
          href="/"
          style={{
            display: "inline-block",
            marginTop: 48,
            fontWeight: 700,
            color: "var(--color-rdv-rec)",
            textDecoration: "underline",
            textUnderlineOffset: 4,
          }}
        >
          ← Voltar ao site
        </Link>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 40 }}>
      <h2
        className="rdv-display"
        style={{ fontSize: 22, fontStyle: "italic" }}
      >
        {title}
      </h2>
      <div
        style={{
          marginTop: 12,
          fontSize: 14,
          lineHeight: 1.65,
          color: "var(--color-rdv-ink)",
        }}
      >
        {children}
      </div>
      <style>{`
        section ul {
          list-style: disc;
          padding-left: 22px;
        }
        section ul li {
          margin-top: 8px;
        }
        section .rdv-link {
          font-weight: 700;
          color: var(--color-rdv-rec);
          text-decoration: underline;
          text-underline-offset: 3px;
        }
      `}</style>
    </section>
  );
}
