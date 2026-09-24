# Compasso — sistema de gestão interna da B Mídia

## Etapa 1 · Banco de dados (Supabase) ✅

Migrations em `supabase/migrations/`, uma por módulo, aplicadas **nesta ordem**:

| Arquivo | Módulo |
|---|---|
| `01_base_usuarios_permissoes.sql` | Perfis, papéis, códigos de acesso, desbloqueios |
| `02_area_do_cliente.sql` | Clientes, Tarefas (kanban), Calendário, Bloco de Notas |
| `03_prospeccao.sql` | Prospecção (prospects + anotações) |
| `04_financeiro.sql` | Faturamento, custos, colaboradores, pró-labore, calculadora |

### Como instalar
1. Crie um **projeto novo** no Supabase para o Compasso (separado do Cadência).
2. **Authentication → Sign In / Providers**: desative "Allow new users to sign up" (a equipe entra só por convite).
3. **SQL Editor**: cole e rode cada arquivo, na ordem.
4. **Authentication → Users → Invite user**: convide **você primeiro** — o primeiro usuário vira admin com acesso total. Depois convide a equipe.
5. No SQL Editor, defina os dois códigos (troque pelos seus):
   ```sql
   select definir_codigo_area('prospeccao', 'SEU-CODIGO-PROSPECCAO');
   select definir_codigo_area('financeiro', 'SEU-CODIGO-FINANCEIRO');
   ```

### Regras de acesso
- **Área do Cliente**: só quem está em `cliente_membros` daquele cliente (admin vê todos).
- **Prospecção / Financeiro**: a admin marca `pode_prospeccao` / `pode_financeiro` no perfil **e** a pessoa digita o código. O desbloqueio vale 4 h. 5 erros em 15 min bloqueiam novas tentativas por 15 min. Trocar o código derruba todos os desbloqueios ativos.
- Tudo isso é garantido pelo banco (RLS), não só pela tela.

### Calculadora de precificação
- Base fixa do mês = custos fixos + colaboradores (tipo `fixo`) + pró-labore
- Custo fixo por entrega = base fixa ÷ nº de entregas do mês
- Custo real = custo fixo por entrega + custos variáveis da entrega (inclui IA e colaboradores `por_entrega`)
- Views: `fin_resumo_mensal`, `fin_custo_entregas` · Simulação: `fin_simular_preco(...)`
