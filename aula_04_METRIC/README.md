# metric.py — aderência à Aula 4 (METRIC / VARI-METRIC)

Este documento registra a reescrita de `metric.py` feita para alinhá-lo a
`metric_slides_completo.pdf` (54 slides + notas do professor). A versão
anterior implementava um modelo de **um único escalão** (cada base
otimizada isoladamente, sem representar o parque); a aula inteira é sobre
o modelo de **dois escalões** (parque + bases, acoplados por δⱼ). Este
README explica o que mudou, por quê, e onde cada peça do código corresponde
a qual slide.

## O que mudou

### 1. Escalão do parque (local 0) — antes ausente

`metric.py` não tinha nenhuma variável de estoque no parque. A "equação
central" da aula (slide 29):

```
RSTij = rj·BRTj + (1 − rj)·(OSTi + δj(s0j)·DRTj)
```

virava, no código antigo, apenas `t_h = (drt + dtrans) * 24` — equivalente a
assumir sempre `rj = 0` e `δj = 1` (parque permanentemente zerado). Isso é o
caso-limite "base stockage de um escalão da RAND" que os comentários do
slide 31 citam como o modelo *mais simples possível*, não o METRIC.

Agora `Part` ganhou os campos `r` (fração reparada na base) e `brt` (tempo
de reparo na base), e o código implementa a equação central inteira:
[metric.py](metric.py) — `depotPipelineMean`, `depotDelay`, `rstBase`,
`basePipelines`.

### 2. Otimização conjunta parque + todas as bases — antes por base isolada

O menu antigo pedia para escolher **uma** base e otimizava só ela. Os
comentários do slide 29 dizem explicitamente que isso é o erro que o modelo
conjunto evita ("é a diferença entre este modelo e dimensionar cada base
isoladamente"). Agora `Solve()` roda sobre o sistema inteiro de uma vez:
para cada item e cada local (parque ou uma base), avalia o benefício
marginal de mais uma unidade e aloca no maior — exatamente o algoritmo do
slide 36. Estocar no parque tem benefício calculado por recomputação
"what-if" (afeta todas as bases ao mesmo tempo via δⱼ); estocar numa base
usa a forma fechada |ΔEBO| = Pr{X>s} (slide 35), já que aí o parque fica
fixo.

### 3. VARI-METRIC — antes inexistente

Slides 42–51 (>15% da aula) não tinham nenhuma contrapartida no código.
Agora, com `method="vari-metric"`, o pipeline de cada base é desagregado em
`Pij` (reparo local/trânsito, Poisson exato) e `B0ij` (parcela nos
backorders do parque), os dois primeiros momentos são combinados (slides
43–44), e o resultado ajusta uma binomial negativa (slide 45) em vez da
Poisson. Com `method="metric"` o comportamento é idêntico ao modelo antigo
de pipeline (Poisson), como a aula garante que deveria ser (slide 44: "O
VARI-METRIC muda só a variância").

### 4. Bug: taxa de atendimento com off-by-one

Slide 24: `FRij(s) = P(X < s) = FX(s−1)`. O código antigo calculava
`P(X ≤ s)` — a nota do próprio slide 24 avisa sobre exatamente esse erro
("corridas antigas que compararam P(X≤s) exigem recálculo"). Corrigido em
`getFillRate` (usa `getPoissonCDF(pmf, s-1)`).

### 5. Bug: EBO subestimado para s > 0

Ao validar a implementação contra a própria tabela numérica do slide 23
(μ=1,63), o código antigo (e a primeira versão desta reescrita, que herdou
a mesma fórmula) dava `EBO(1) = 1,311` em vez do `0,826` mostrado no slide.
Faltava um termo na fórmula:

```
EBO(s) = E[max(X−s,0)] = mu − Σ_{k=0}^{s} k·P(k) − s·(1 − F(s))
```

O código antigo (e a versão inicial desta reescrita) computava só os dois
primeiros termos, esquecendo `− s·(1 − F(s))`. Corrigido em
`getExpectedBackorders`; validado numericamente contra as tabelas dos
slides 23 e 27 (ambas batem agora, dígito a dígito).

### 6. `safety_factor` / desvios-padrão de lead time — removidos

O código antigo inflava a média do lead time com
`drt + drt_std*safety_factor` e o equivalente para `dtrans`. Isso contradiz
o Teorema de Palm ensinado na aula (slide 18: "Só a média de T importa.
Qualquer forma de distribuição serve"), testado empiricamente no slide 51
(CV=0 vs CV=0,8 movem o VMR do pipeline em menos de 0,001). Removido; os
campos `drt_std`/`dtrans_std` foram tirados dos `.toml` também.

### 7. Poisson em espaço logarítmico — antes usava `math.factorial`

O slide 21 já dizia como o código deveria calcular a PMF: "log k! =
log Γ(k+1), para que k grande caiba na faixa de ponto flutuante". O código
antigo usava `math.factorial` (estoura para k≳170) e um guarda
`if stock[j] >= 169: break` como paliativo. Agora `poissonPMF`/`negBinomPMF`
usam `math.lgamma`, e o critério de parada do loop guloso passou a ser
"nenhum benefício positivo restante", não mais o limite de overflow.

### 8. Critério de parada `min_ao` — antes ausente

Slide 52 lista `method, use_cost_weighting, budget, min_fr, min_ao,
constraint_priority` como os parâmetros do módulo. O código antigo só tinha
`budget`/`min_fr`. Adicionado `min_ao` (para quando parar por Ao mínimo do
sistema) e `"all"` (para exigir orçamento **e** as duas metas de qualidade
juntas — a aula não detalha a semântica exata de `"all"`, então a
implementação escolhida é: parar ao estourar o orçamento, ou quando `min_fr`
**e** `min_ao` estiverem simultaneamente satisfeitos, o que vier primeiro).

### 9. Dataset `parts5B25P.toml` referenciado pela aula não existe

Os slides 1 e 52 citam `parts2B12P.toml` e `parts5B25P.toml` (5 bases, 25
itens). Só existiam `parts2B12P.toml` e `parts1B28P.toml` no diretório —
mantidos os dois que já existiam (não inventei `parts5B25P.toml`, já que
não há dados reais para ele). `parts2B12P.toml` ganhou `r=0.3`/`brt=3.0` em
cada item, usando os mesmos números do exemplo numérico do slide 8
("3 em cada 10 falhas a base resolve... Reparo na base: 3 d."). Já
`parts1B28P.toml` (1 sistema, sem conceito de reparo local nos dados
originais) manteve `r=0` (sem reparo na base) para não inventar valores sem
lastro.

### 10. Bug: `matplotlib.use('Qt5Agg')` travava a execução no macOS

Ao rodar `python metric.py`, o programa abortava com
`qt.qpa.plugin: Could not find the Qt platform plugin "cocoa"` — o backend
Qt5 estava forçado no topo do arquivo, e o plugin "cocoa" do PyQt5
instalado no venv está quebrado (comum quando há mais de uma instalação de
Qt no sistema). Não é um problema de aderência à aula (o backend gráfico
não é conteúdo do curso), mas impedia o programa de rodar. Removida a
linha `matplotlib.use('Qt5Agg')`; o matplotlib agora escolhe sozinho o
backend nativo do sistema (`macosx` neste Mac), que não depende do PyQt5 e
já foi testado.

## O que já estava correto e foi mantido

- PMF/CDF/EBO de Poisson (estrutura), taxa de demanda `DRij`, análise
  marginal gulosa (efetividade vs. eficiência via `use_cost_weighting`), e
  o índice `Aoi` (Little → WT → AWT → MTBF → Ao, Equações 9–12 do slide 39)
  — todos já batiam com a aula e continuam com a mesma lógica, só
  adaptados para múltiplas bases.

## Como rodar

```bash
cd aula_04_METRIC
python metric.py
```

O menu agora pede: dataset, método (`metric`/`vari-metric`), estratégia
(efetividade/eficiência), fill rate mínimo, Ao mínimo, e critério de
parada. Não pede mais "qual base otimizar" — a otimização é sempre do
sistema inteiro (parque + todas as bases do dataset escolhido).

## Limitações que permanecem (por desenho, e a aula é explícita sobre elas)

- A varredura gulosa conjunta é uma **heurística**, não uma solução exata
  do problema acoplado parque+bases (slide 35, "O alcance da exatidão").
- `Ao` é índice de planejamento, não previsão de disponibilidade de uma
  cauda específica (slide 41).
- Um único nível de indenture (a LRU repara direto — sem hierarquia
  LRU/SRU) e canais de reparo ilimitados (slide 51) continuam sendo
  hipóteses do modelo, não deste código.
