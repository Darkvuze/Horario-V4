# FaZes - PRD

## Problema original
> "FaZes apps?" → cria uma aplicação que carrega um PDF (escala de horários da Sata Air Açores), permite escolher uma linha por número/nome, e gera um calendário do mês com:
> - Feriados portugueses (Continental rosa + Açores azul) — com nomes específicos
> - Manhã verde / Intermédio amarelo / Tarde vermelho / Folgas brancas (cores fortes)
> - Menu 3-pontinhos com: Pessoas, Horários, Trocas, Despertador/Relógio
> - Memória de "quem sou eu" (auto-seleciona na próxima vez)
> - Clicar numa célula para mudar o código (potenciais trocas)
> - Pesquisa para trocas: filtrar quem tem folga / manhã / tarde num dia específico
> - Alarmes 30 e 40 min antes da entrada (.ics)
> - 3 temas (escuro / cinzento / claro)
> - Instalável no telemóvel (PWA), funciona offline após primeiro upload

## Arquitetura
- **Frontend**: React 19 + TailwindCSS, lucide-react, axios
  - PWA: `manifest.json` + `sw.js` (cache shell)
  - 3 temas via CSS variables `[data-theme="dark|soft|light"]`
  - Persistência: localStorage (`fazes:codes`, `fazes:schedule`, `fazes:selected`, `fazes:region`, `fazes:theme`, `fazes:me`, `fazes:overrides`)
  - `.ics` 100% client-side (RFC 5545 com 2 VALARM: -PT30M e -PT40M)
- **Backend**: FastAPI + pdfplumber, `POST /api/parse-schedule` (stateless)

## Implementado (Jan 2026)

### V1 (MVP)
- ✅ Upload PDF + parser robusto (deteta `5XXXXXXX - Nome` + dias da semana + códigos por posição X)
- ✅ Deteção automática de mês/ano
- ✅ Calendário mensal Seg-Dom
- ✅ Feriados PT (Continental rosa + Açores azul) com móveis (Páscoa, Sexta-feira Santa, Corpo de Deus, Domingo/Dia da Região Açores)
- ✅ Drawer editável de códigos (entrada/almoço/saída/tipo)
- ✅ Códigos pré-configurados (M76, M50, M14, M7, M13, M42, P16, P24, P34, 50A, 796, D, DF, F)
- ✅ Códigos novos do PDF adicionados automaticamente
- ✅ Exportação `.ics` com 2 alarmes (30 e 40 min antes)
- ✅ 3 modos: Escuro / Cinzento / Claro
- ✅ PWA instalável

### V2 (classificação + cores)
- ✅ Classificação por hora de entrada: <08:30 manhã (verde), 08:30-09:30 intermédio (amarelo), ≥09:30 tarde (vermelho)
- ✅ Cores reforçadas (saturadas) em todos os temas
- ✅ Categoria "Intermédio" no drawer e legenda
- ✅ Auto-correção retroativa de códigos guardados com kind errado
- ✅ Bug fix: códigos com prefixo T/P (ex: T2) → tarde por defeito
- ✅ Códigos não-M e não-folga → tarde por defeito (apanha "IT2", "S*", etc.)

### V3 (UX major)
- ✅ Menu **3 pontinhos** (canto sup. direito) com dropdown:
  - 👥 **Pessoas**: lista de funcionários com pesquisa, escolher quem sou, e trocar pessoa visualizada
  - 📋 **Horários**: tabela editável de códigos
  - 🔄 **Trocas (Opção B)**: escolher dia + filtro (Todos/Folga/Manhã/Tarde) → lista candidatos ordenados, cada um com seu código no dia (badge colorido)
  - 🕐 **Despertador / Relógio**: hora atual em Açores em tempo real (atualiza segundo a segundo) + dicas para alarmes no iPhone/Android
- ✅ Modal **"Quem és tu?"** aparece após upload, fica memorizado no telemóvel (`fazes:me`)
- ✅ Auto-seleciona o utilizador na próxima abertura — header mostra "Olá, [primeiro nome]"
- ✅ **Clicar numa célula** → modal com lista de códigos (cada um colorido por tipo + entrada/almoço/saída) → escolher novo código
- ✅ **Overrides** guardados separados dos dados originais (chave `fazes:overrides`, scope ano-mês-pessoa) — não corrompem o PDF original
- ✅ Lista detalhada de **feriados do mês** debaixo do calendário (com etiqueta colorida Açores/Continental)
- ✅ **Nome do feriado** visível dentro da célula do calendário (ex: "Dia do Trabalhador", "Domingo do Espírito Santo")
- ✅ Sidebar removida (mais espaço para o calendário no telemóvel)

## Backlog (P1/P2)
- **P0 — Offline TOTAL**: substituir parser do servidor por `pdfjs-dist` (parser dentro do navegador). Atualmente a app funciona offline depois do upload, mas o upload em si precisa de rede.
- P1: Notificações push nativas
- P1: Botão "Adicionar todos os turnos ao Google Calendar" via deep-link
- P2: Suporte XLSX
- P2: Export PDF/imagem do calendário individual
- P2: Resumo mensal (X manhãs, Y intermédios, Z tardes, W folgas, total horas)
- P2: Editor de alarmes personalizável (não só 30/40 min)
- P2: Histórico de PDFs carregados (mudar de mês/escala rapidamente)

## Próximas ações sugeridas
1. Implementar **offline total** com `pdfjs-dist`
2. Testar com PDF real `Esc_Hor 2026043-MAI.pdf` e ajustar tolerâncias do parser se necessário
3. Adicionar ícones PWA reais (192x192 e 512x512)
