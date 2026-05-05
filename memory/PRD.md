# FaZes - PRD

## Problema original
> "FaZes apps?" → cria uma aplicação que carrega um PDF (escala de horários da Sata Air Açores), permite escolher uma linha por número/nome, e gera um calendário do mês com:
> - Feriados portugueses (Continental rosa + Açores azul)
> - Manhã verde claro / Tarde vermelho claro / Folgas brancas
> - Painel lateral via menu hambúrguer com todos os códigos de horário (entrada, almoço, saída)
> - Alarmes 30 e 40 minutos antes da entrada
> - Modos escuro / cinzento (soft) / claro
> - Instalável no telemóvel (PWA)
> - Sem login, persistência em localStorage

## Arquitetura
- **Frontend**: React 19 + TailwindCSS, lucide-react icons, axios.
  - PWA: `manifest.json` + `sw.js` (cache shell offline)
  - 3 temas via CSS variables `[data-theme="dark|soft|light"]`
  - Persistência: localStorage (`fazes:codes`, `fazes:schedule`, `fazes:selected`, `fazes:region`, `fazes:theme`)
  - Geração `.ics` 100% client-side (RFC 5545 com 2 VALARM: -PT30M e -PT40M)
- **Backend**: FastAPI + pdfplumber
  - `POST /api/parse-schedule` (multipart): retorna `{ month, year, employees: [{row, employee_id, name, days:[{day, weekday, code}]}], raw_codes }`
  - Sem MongoDB, stateless

## Personas
- Trabalhador da Sata Air Açores que recebe escalas mensais em PDF e quer ver o seu mês com alarmes prontos a importar para o calendário do telemóvel.

## Implementado (Jan 2026)
- ✅ Upload de PDF + parser robusto (deteta nº empregado `5XXXXXXX`, nomes, dias da semana e códigos por posição X)
- ✅ Deteção automática de mês/ano (ex.: `2026043-MAI` → Maio/2026)
- ✅ Lista de funcionários com pesquisa por nome, nº ou linha
- ✅ Calendário mensal (Seg-Dom) com cores: manhã verde claro, tarde vermelho claro, folga branca, vazio cinza
- ✅ Feriados PT Continental (rosa) e Açores (azul) — incluindo móveis (Páscoa, Sexta-feira Santa, Corpo de Deus, Domingo/Dia da Região Açores)
- ✅ Painel lateral (drawer) com tabela editável de códigos: entrada, início/fim almoço, saída, tipo (manhã/tarde/folga)
- ✅ Códigos pré-configurados (M76, M50, M14, M7, M13, M42, P16, P24, P34, 50A, 796, D, DF, F)
- ✅ Códigos novos detetados no PDF são adicionados automaticamente
- ✅ Exportação `.ics` com 2 alarmes (30 e 40 min antes da entrada) compatível com Google Calendar / Apple Calendar / Outlook
- ✅ 3 modos: Escuro, Cinzento (soft), Claro — com switch no header
- ✅ PWA instalável (`manifest.json` + `sw.js`) — "Adicionar ao ecrã inicial" no Android/iPhone
- ✅ Navegação mês anterior/próximo
- ✅ Selector de região (Açores / Continental / Ambos)

## Backlog (P1/P2)
- P1: Notificações push nativas (precisa de service-worker registration + Permission API)
- P1: Botão "Adicionar todos os turnos ao Google Calendar" (link `text/calendar`)
- P2: Suporte a ficheiros XLSX (sheet com mesma estrutura)
- P2: Export PDF/imagem do calendário individual
- P2: Modo offline total (cachear API parse com IndexedDB) — atualmente o parse exige rede

## Próximas ações sugeridas
1. Testar com o PDF real (`Esc_Hor 2026043-MAI.pdf`) e ajustar tolerâncias do parser se necessário
2. Adicionar ícones PWA reais (192x192 e 512x512) — atualmente fallback para favicon
3. Permitir editar manualmente células do calendário (override de código)
