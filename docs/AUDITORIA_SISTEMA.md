# RELATÓRIO DE AUDITORIA COMPLETA DO SISTEMA

## Controle Financeiro Familiar Multiusuário (Finanças do Casal)

**Data:** Novembro de 2026  
**Ambiente Auditado:** Produção / Skip Cloud (PocketBase) + Frontend React/TypeScript/Vite  
**Escopo:** Integridade de Dados, Performance, Segurança & Acesso, Automações/Backend, Processos & UX.

---

## 1. SUMÁRIO EXECUTIVO (TOP 7 RISCOS CRÍTICOS)

| #     | Risco / Ponto de Falha                                                                 | Gravidade      | Impacto Potencial                                                                                                                                                                                                                                                                                                            | Correção Recomendada                                                                                                                                                                                                           |
| ----- | -------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | -------------------------------------- |
| **1** | **Backup Automático com Zero Registros e Retenção Ineficaz**                           | **CRÍTICO**    | Não há nenhum backup persistido na tabela `data_backups` (0 registros no banco real). A retenção atual mantém apenas 1 backup corrente que é sobrescrito diariamente, eliminando a capacidade de recuperação de desastres de dias anteriores.                                                                                | Validar execução da cron `backup-daily-snapshot`, tratar erros de `$filesystem.fileFromBytes` sem suprimir silenciosamente com `catch (_)`, e adotar política de retenção rotativa (últimos 7 dias + 4 semanais + 12 mensais). |
| **2** | **Carregamento Monolítico em Cascata (até 6.000+ registros no client)**                | **CRÍTICO**    | A função `loadAllTransactionsForControl` faz paginações forçadas de 2.000 em 2.000 registros, baixando todas as transações da história da família. Logs mostram requisições de ~275ms cada e chamadas duplicadas simultâneas de subcategorias, contas e categorias no carregamento inicial.                                  | Implementar carregamento paginado e filtrado por competência mensal (`date >= inicio && date <= fim`) no backend PocketBase com cache local (`React Query` / SWR).                                                             |
| **3** | **Troca Arbitrária de Senha por Administrador de Controle (`admin_member_update.js`)** | **CRÍTICO**    | O endpoint customizado permite que um proprietário de controle altere arbitrariamente a senha de login no PocketBase de qualquer membro convidado sem validação de e-mail ou 2FA, expondo credenciais de usuários familiares.                                                                                                | Remover a alteração direta de senha (`setPassword`) por terceiros. O membro convidado deve alterar sua própria senha via fluxo padrão de redefinição por e-mail ou perfil autenticado.                                         |
| **4** | **Regras de Exclusão e Edição de Lançamentos Sem Validação de Perfil (`role`)**        | **MÉDIO/ALTO** | A regra de coleção (`deleteRule` e `updateRule`) de `transactions` permite que qualquer membro ativo do controle (inclusive com perfil de visualizador/membro comum) altere ou delete qualquer transação criada por outros membros.                                                                                          | Restringir `deleteRule` e `updateRule` para validar permissão por role ou checar autoria (`user_id = @request.auth.id                                                                                                          |     | @request.auth.id = control.owner_id`). |
| **5** | **Race Condition no Gerador Client-Side de Recorrências Mensais**                      | **ALTO**       | O trigger de criação automática de parcelas/recorrências (`triggerAutoRecurringGeneration`) roda no navegador do usuário ao abrir `/lancamentos`. Se dois membros da família abrirem a tela simultaneamente, os dois browsers disparam criação paralela de ocorrências antes do sync, recriando duplicidades.                | Mover a geração automática de recorrências para um Cron Job idempotente no backend PocketBase (`pocketbase/hooks/`), ou criar restrição de unicidade lógica para `parent_transaction_id + ano_mes`.                            |
| **6** | **Distorção Imediata de Saldo Bancário por Lançamentos Pagos com Data Futura**         | **MÉDIO**      | O sistema permite salvar lançamentos com flag `paid: true` e `payment_date` futura (identificado no banco ex: `cutn4d9gy43kuto` Havan 1/2 com vencimento em 05/11 e marcado como pago). Isso debita imediatamente o saldo de `accounts.balance`, gerando divergência entre o saldo exibido no app e o extrato bancário real. | Implementar trava ou aviso claro: lançamentos futuros marcados como pagos devem alertar que o saldo bancário refletirá o débito imediatamente, ou introduzir status "agendado".                                                |
| **7** | **Exclusão de Contas/Categorias Gera Chaves Órfãs sem Restrição Referencial**          | **MÉDIO**      | `transactions.account_id` e `transactions.category_id` são campos de texto puro no PocketBase. Excluir uma conta ou categoria deixa transações apontando para IDs inexistentes, causando quebra de filtros e valores "sem categoria/conta" irrecuperáveis.                                                                   | Implementar soft-delete (`archived = true`) em contas e categorias, ou impedir exclusão quando houver transações vinculadas ativas.                                                                                            |

---

## 2. ÁREA 1: INTEGRIDADE DE DADOS

### 2.1 Anomalias e Verificações Quantitativas no Banco de Dados Real

- **Total de Backups Persistidos (`data_backups`):** **0 registros** encontrados. A rotina automática de backup não gerou registros persistidos na coleção.
- **Transações de Parcelas com Total Zerado:** `installment_number > 0 && installment_total = 0 && recurring = false`: **0 registros**. A correção recente eliminou parcelas órfãs com total zerado.
- **Caso Havan e Deduplicação:**
  - Histórico antigo: Transações importadas via planilha em setembro/2026 (`4bf1mvwhd2vun3d`, `27fn6hp5e1zdf6x`, etc.) possuem pais consolidados com `installment_number = 0` e `installment_total = 2`.
  - Série recente Havan: Encontradas apenas 2 transações:
    - Parcela 1/2: ID `cutn4d9gy43kuto` (R$ 454,91, criada em 15/10/2026, `paid: true`, `date: 2026-10-07`, `payment_date: 2026-11-05`).
    - Parcela 2/2: ID `myurfcn7iis0kud` (R$ 454,91, gerada automaticamente, `paid: false`, `date: 2026-11-07`, `payment_date: 2026-12-05`).
    - **Diagnóstico:** A duplicata reportada anteriormente foi saneada e a série está íntegra com 1/2 e 2/2.
- **Séries Recorrentes Ativas:**
  - Identificadas séries recorrentes mensais sem colisão de ano/mês (ex.: Netflix R$ 55,90 e outras despesas fixas), com projeções de até 12 meses futuros corretamente marcadas com `installment_number = 0` e `installment_total = 0`.

### 2.2 Regras de Criação e Edição (Pagos vs. Data Futura)

- **Evidência:** Arquivos `src/lib/formatters.ts` (`resolvePaidStatus`), `src/lib/skip-cloud.ts` e `src/components/transactions/TransactionModal.tsx`.
- **Achado:** Ao criar ou editar uma despesa com data de vencimento/pagamento futura, o frontend permite que o usuário marque o toggle "Pago". O PocketBase salva `paid: true`. Em seguida, a função `updateAccountBalance` subtrai o valor da conta imediatamente.
- **Gravidade:** Médio.
- **Risco:** O saldo da conta bancária no app fica menor do que o saldo real no aplicativo do banco, pois uma despesa que vencerá apenas na próxima semana já foi debitada no sistema.
- **Sugestão:**
  1. Se `payment_date > hoje` e o usuário tentar marcar `paid = true`, exibir diálogo de confirmação: _"Atenção: Este lançamento possui data futura. Deseja realmente marcá-lo como pago hoje e debitar o saldo da conta imediatamente?"_.
  2. Implementar separação entre "Data do Lançamento (Competência)", "Data de Vencimento" e "Data Efetiva de Pagamento".

### 2.3 Idempotência do Gerador de Recorrências e Risco de Novas Duplicações

- **Evidência:** `src/lib/recurring-generation.ts` (`planOccurrencesForSingleRecurring` e `triggerAutoRecurringGeneration`).
- **Achado:** O gerador de recorrências é executado no client pelo navegador (`TransactionsPage.tsx`). Ele faz leitura das transações, computa as parcelas faltantes e envia `createPlannedTransactionsInPool`.
- **Gravidade:** Alto.
- **Risco:** Em um app familiar multiusuário, se o casal abrir o app ao mesmo tempo em dispositivos diferentes (ex: celular e computador), ambas as instâncias verificam que falta a ocorrência do mês seguinte e disparam o POST de criação concorrentemente. Como a coleção `transactions` não possui constraint de unicidade no banco, as transações serão duplicadas.
- **Sugestão:**
  1. Transferir a rotina de projeção de recorrências para um Cron Job de backend (executado 1x por dia ou 1x no 1º dia de cada mês).
  2. Implementar trava distribuída ou checagem atômica no backend antes de persistir uma ocorrência gerada.

---

## 3. ÁREA 2: PERFORMANCE

### 3.1 Consultas em Cascata e Carregamento Monolítico

- **Evidência:** Logs de requisições HTTP do PocketBase e arquivo `src/contexts/CompanyContext.tsx` (`loadAllTransactionsForControl`).
- **Achado:**
  1. Para carregar os lançamentos, o app executa sucessivos `GET /api/collections/transactions/records?page=1&perPage=2000`, `page=2&perPage=2000`, `page=3&perPage=2000`. Cada chamada leva entre 160ms e 275ms de execução no servidor.
  2. No carregamento inicial, há chamadas duplicadas para as mesmas coleções com paginações diferentes (`perPage=1000` e `perPage=500` simultaneamente para `subcategories`, `accounts`, `categories` e `control_members`).
- **Gravidade:** Crítico.
- **Risco:** Conforme a base de dados atinge 5.000 a 10.000 transações, o tempo de inicialização do app no mobile atinge de 4 a 8 segundos, consumindo grande quantidade de memória RAM do dispositivo móvel e gerando custos desnecessários de transferência de dados.
- **Sugestão:**
  1. Unificar o carregamento de metadados em `CompanyContext` para evitar requisições redundantes de categorias/contas.
  2. Mudar a estratégia de carregamento de lançamentos para **lazy-loading por competência mensal** (ex.: carregar apenas o mês selecionado + 1 mês anterior + 1 mês futuro).
  3. No Dashboard, buscar agregações prontas ou limitar o período de análise via filtro de data no PocketBase (`date >= :startDate && date <= :endDate`).

### 3.2 Cálculos Re-renderizados no Cliente

- **Evidência:** `src/pages/Dashboard.tsx` (1.474 linhas) e `src/pages/TransactionsPage.tsx` (1.811 linhas).
- **Achado:** Cálculos de total de receitas, despesas, saldos acumulados e distribuição por categoria são realizados via laços `reduce` e `filter` diretamente no corpo de renderização ou em `useMemo` com dependências amplas.
- **Gravidade:** Médio.
- **Risco:** Queda de taxa de quadros (jank) e lentidão ao digitar em campos de busca ou alternar filtros na tela de transações.
- **Sugestão:** Extrair os cálculos de agregação para um hook dedicado com memoização rigorosa e web worker opcional se a base for mantida em memória.

---

## 4. ÁREA 3: SEGURANÇA E ACESSO

### 4.1 Regras de Coleção (Access Rules / RLS)

- **Evidência:** `src/lib/pocketbase/schema.json` e `db_describe_object(transactions)`.
- **Achado:**
  - As regras de `transactions` são:
    - `listRule`: `@request.auth.id != "" && control_id ?= @request.auth.control_members_via_user_id.control_id`
    - `updateRule`: `@request.auth.id != "" && control_id ?= @request.auth.control_members_via_user_id.control_id`
    - `deleteRule`: `@request.auth.id != "" && control_id ?= @request.auth.control_members_via_user_id.control_id`
- **Gravidade:** Médio/Alto.
- **Risco:** Qualquer membro adicionado ao controle financeiro com perfil `member` ou `viewer` consegue enviar requisições de DELETE ou PATCH diretamente para a API do PocketBase e excluir ou alterar registros financeiros de outros membros, pois a regra apenas valida se o usuário pertence ao controle, e não o seu papel (`role`) ou autoria do registro.
- **Sugestão:**
  Atualizar as regras para exigir papel de administrador/proprietário para deleções de terceiros:
  ```
  deleteRule: @request.auth.id != "" && control_id ?= @request.auth.control_members_via_user_id.control_id && (user_id = @request.auth.id || @request.auth.control_members_via_user_id.role = "admin" || @request.auth.control_members_via_user_id.role = "owner")
  ```

### 4.2 Endpoint Customizado de Atualização de Membros (`admin_member_update.js`)

- **Evidência:** `pocketbase/hooks/admin_member_update.js` (linhas 83 a 95).
- **Achado:** O hook permite que o admin/owner do controle altere campos do registro de usuário na coleção `users`, incluindo nome, avatar e **senha mestra** (`userToUpdate.setPassword(newPassword)`).
- **Gravidade:** Crítico.
- **Risco:** Violação grave de privacidade e segurança da conta. Um usuário convidado tem sua senha de acesso definida ou alterada por outro usuário sem o seu consentimento. Se o usuário utilizar a mesma conta para outros propósitos, sua credencial é comprometida.
- **Sugestão:**
  1. Remover imediatamente o suporte à alteração de senha de terceiros via hook de administração.
  2. Apenas o próprio usuário autenticado pode alterar sua senha, ou utilizar o fluxo nativo de redefinição de senha por e-mail do PocketBase (`requestPasswordReset`).

### 4.3 Criação de Convites (`control_invitations`)

- **Evidência:** `schema.json` - coleção `control_invitations`.
- **Achado:** `createRule: "@request.auth.id != ''"`. Qualquer usuário autenticado no sistema pode criar um convite para qualquer `control_id`, sem validação prévia de ser admin ou dono daquele controle específico na regra da coleção.
- **Gravidade:** Médio.
- **Sugestão:** Ajustar a `createRule` para verificar se `@request.auth.id` é `owner` ou `admin` em `control_members` para o respectivo `control_id`.

---

## 5. ÁREA 4: AUTOMAÇÕES E BACKEND

### 5.1 Job Diário de Backup e Retenção

- **Evidência:** `pocketbase/hooks/backup_automation.js`, `list_scheduled_jobs` e consulta à coleção `data_backups`.
- **Achado:**
  1. O cron job `backup-daily-snapshot` está agendado para `30 3 * * *`.
  2. No banco de dados real, a tabela `data_backups` retornou **0 registros**.
  3. No arquivo `backup_automation.js`, blocos `try { ... } catch (_) {}` engolem erros silenciosamente ao tentar manipular arquivos (`$filesystem.fileFromBytes`).
  4. A política de retenção armazena apenas:
     - 1 registro do tipo `yearly` (se não existir para o ano).
     - 1 registro do tipo `current` (que substitui o registro anterior).
- **Gravidade:** Crítico.
- **Risco:**
  - Se houver falha de escrita no PocketBase ou na chamada do cron, o administrador acredita que possui backups quando na verdade não há nenhum arquivo gravado.
  - O modelo de manter apenas 1 backup corrente impede voltar a um estado anterior a uma corrupção que tenha ocorrido antes da última madrugada.
- **Sugestão:**
  1. Corrigir o tratamento de erro em `backup_automation.js` para registrar logs detalhados com `console.error` em caso de falha de exportação.
  2. Implementar política de retenção do tipo avô-pai-filho (GFS):
     - Últimos 7 backups diários (`daily`).
     - Últimos 4 backups semanais (`weekly`).
     - 1 backup mensal (`monthly`) retido por 12 meses.
  3. Adicionar na aba de Configurações (`BackupsTab.tsx`) um alerta de saúde visual: _"Último backup realizado há X dias"_ e botão de teste de integridade.

### 5.2 Risco de Hooks Mutuamente Destrutivos

- **Evidência:** `pocketbase/hooks/maintenance_installments.js`.
- **Achado:** O hook foi aprimorado para checar flags de recorrência (`is_recurring`, `recurring`, `recurrence_type`, etc.) antes de deduplicar parcelas.
- **Gravidade:** Médio.
- **Risco:** Como a manutenção é executada via endpoint REST customizado (`POST /backend/v1/custom/maintenance-installments`), se for acionada em modo real (`dryRun = false`) enquanto o gerador de recorrências estiver em execução no cliente, pode haver exclusão indevida de parcelas recém-criadas que ainda não tenham o campo `parent_transaction_id` sincronizado.
- **Sugestão:** Executar manutenções sempre em modo transacional fechado ou manter histórico de logs de auditoria de exclusão com backup prévio obrigatório antes da execução.

---

## 6. ÁREA 5: PROCESSOS E UX (EXPERIÊNCIA DO USUÁRIO)

### 6.1 Exclusão em Cascata e Registros Órfãos

- **Evidência:** `src/pages/AccountsPage.tsx`, `src/pages/CategoriesPage.tsx` e `src/lib/skip-cloud.ts`.
- **Achado:** Ao excluir uma conta bancária ou categoria, o sistema remove o registro da tabela correspondente. No entanto, não há foreign keys com restrição no PocketBase. As transações associadas permanecem no banco apontando para o ID removido.
- **Gravidade:** Médio.
- **Risco:**
  - Transações com `account_id` inexistente não aparecem nos filtros de conta bancária.
  - Gráficos de categorias mostram valores como "Sem Categoria" ou podem gerar erros de leitura de propriedades nulas no frontend.
- **Sugestão:**
  1. Impedir a exclusão física de contas e categorias que possuam transações vinculadas. Exibir modal orientando: _"Esta categoria possui 142 lançamentos vinculados. Deseja reatribuir para outra categoria ou arquivá-la?"_.
  2. Implementar campo `is_archived: boolean` em contas e categorias.

### 6.2 Restauração de Backup Sobrescrevendo Dados (Upsert vs. Limpeza)

- **Evidência:** `pocketbase/hooks/backup_automation.js` (`restoreSnapshot`, linhas 600–786).
- **Achado:** O processo de restauração lê o snapshot JSON e faz um **UPSERT** por ID nas coleções (`categories`, `subcategories`, `accounts`, `transactions`).
- **Gravidade:** Alto.
- **Risco:** Se o usuário cadastrou 20 transações novas após a data do backup e decide restaurar o backup anterior para desfazer um erro, as 20 transações novas **NÃO são removidas**. Elas permanecem ativas e misturadas com os dados do backup, e o recálculo de saldos (`lines 789-821`) recalculará os saldos somando as transações antigas e as novas, gerando valores totalmente incoerentes com o estado do backup restaurado.
- **Sugestão:**
  1. Na interface de restauração, oferecer duas opções explícitas ao administrador:
     - **Restauração Limpa (Substituição Total):** Faz backup de segurança do estado atual, arquiva/limpa os dados do controle e restaura exatamente o snapshot.
     - **Mesclagem (Apenas recuperar ausentes):** Insere apenas registros que não existem atualmente.
  2. Exibir relatório pós-restauração detalhando quantos registros foram adicionados, atualizados ou ignorados.

### 6.3 Falhas Silenciosas em Propagação de Edição

- **Evidência:** `src/lib/transaction-propagation.ts` (`updateTransactionWithPropagation`).
- **Achado:** Quando o usuário edita uma parcela de uma compra parcelada (ex.: 2/10) e escolhe "Aplicar a todas as próximas parcelas", o frontend executa um loop sequencial de chamadas `pb.collection('transactions').update()`. Se uma chamada falhar no meio do processo (ex.: erro 429 de limite de taxa ou falha de conexão móvel), o processo é interrompido com erro parcial.
- **Gravidade:** Médio.
- **Risco:** As parcelas 3, 4 e 5 ficam com o novo valor, enquanto as parcelas 6 a 10 mantêm o valor antigo, quebrando a consistência da série parcelada.
- **Sugestão:** Implementar mecanismo de rollback no cliente ou criar um endpoint de backend que execute a propagação em uma transação atômica única no PocketBase.

---

## 7. PLANO DE AÇÃO PRIORIZADO (ROADMAP RECOMENDADO)

### Fase 1 — Imediata (Segurança & Prevenção de Desastres)

1. **Ativar e Validar Rotina de Backup:** Corrigir a gravação de arquivos em `backup_automation.js`, testar manualmente a geração de um snapshot inicial e verificar a persistência na coleção `data_backups`.
2. **Remover Troca de Senha de Terceiros:** Eliminar a funcionalidade de `setPassword` de colaboradores em `admin_member_update.js`.
3. **Restringir Regras de Exclusão de Transações:** Exigir validação de `role = 'admin' | 'owner'` ou `user_id = @request.auth.id` para deletar transações.

### Fase 2 — Curto Prazo (Performance & Escalabilidade)

4. **Lazy Loading de Transações por Competência:** Substituir a busca total de transações em `CompanyContext` por busca paginada e filtrada por mês/ano.
5. **Deduplicação de Chamadas de Metadados:** Unificar fetches de categorias, contas e membros no carregamento inicial da aplicação.

### Fase 3 — Médio Prazo (Integridade & Processos)

6. **Migração do Gerador de Recorrências para o Backend:** Transformar o gerador client-side em um cron job de backend para eliminar concorrência entre navegadores.
7. **Soft-Delete e Proteção Referencial de Contas/Categorias:** Impedir exclusão de contas e categorias com lançamentos vinculados; introduzir status arquivado.
8. **Transação Atômica de Propagação:** Criar endpoint no backend para atualização em lote de parcelas em uma única transação atômica.
