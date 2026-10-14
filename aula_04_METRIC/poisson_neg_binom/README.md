# Poisson × binomial negativa — laboratório visual

Abra `index.html` no navegador. A aplicação funciona offline, sem servidor, instalação ou bibliotecas externas.

## Sequência sugerida para a aula

1. Selecione **Limite Poisson** (`VMR = 1`) e confirme que as duas distribuições coincidem.
2. Mantenha `μ` fixo e aumente o VMR para observar a saída de massa da região central para os extremos.
3. Mova o estoque `s` e compare `FR(s) = P(X < s)`, `P(X ≥ s)`, `P(X > s)` e `EBO(s)`.
4. Altere a meta de fill rate e compare o estoque requerido pelos dois modelos.
5. Na terceira aba, gere novas amostras e relacione a taxa Gamma variável com os períodos calmos e os picos.

O exemplo inicial usa `μ = 8`, `VMR = 2` e `s = 12`. As duas distribuições têm média 8, mas variâncias 8 e 16. Nesse ponto, o EBO passa de aproximadamente 0,130 (Poisson) para 0,435 (binomial negativa).

## Parametrização

Para a binomial negativa:

```text
ν = μ / (VMR − 1)
p = 1 / VMR
E[X] = μ
Var(X) = μ × VMR
```

Quando `VMR = 1`, o código usa exatamente o limite Poisson. Essa é a mesma convenção adotada por `pops_7_metric/metric.py` para comparar METRIC e VARI-METRIC.

No contexto do modelo da disciplina, a binomial negativa aproxima a contagem no pipeline das bases quando a fila compartilhada de backorders do depósito adiciona variância. O pipeline do depósito permanece Poisson.

## Arquivos

- `index.html`: estrutura e conteúdo didático;
- `styles.css`: interface responsiva e temas claro/escuro;
- `app.js`: interações e gráficos canvas;
- `distributions.js`: probabilidades, medidas de serviço e simulação reproduzível;
- `test_distributions.js`: testes numéricos sem dependências.

## Testes

Com Node.js 18 ou posterior, execute na raiz do repositório:

```powershell
node --test pops_7_metric\poisson_neg_binom\test_distributions.js
```

Os testes verificam a PMF, a normalização e a massa omitida, os momentos, o limite `VMR = 1`, as semânticas de fill rate/backorder, o EBO, o estoque mínimo para uma meta e a simulação Gamma–Poisson.
