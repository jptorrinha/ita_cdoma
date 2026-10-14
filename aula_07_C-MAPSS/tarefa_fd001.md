# TE-292 — Uma primeira investigação com o FD001

**Atividade individual — Aula 7: C-MAPSS e decisão de manutenção**

## O desafio

**Uma regra baseada em sensores consegue aproveitar melhor a vida do motor do que uma remoção por idade?**

Proponha e teste uma primeira solução usando somente o **FD001**. O objetivo é emitir um aviso com antecedência suficiente para remover o motor a tempo, aproveitando sua vida útil e reduzindo o custo por ciclo. Uma regra simples, bem avaliada, é suficiente para esta atividade.

## Dados e cenário

Use o arquivo [train_FD001.txt](data/train_FD001.txt), que contém o histórico completo de **100 motores simulados**, até a falha. Cada linha representa um ciclo de operação, equivalente a um voo. FD001 tem uma condição operacional e degradação do compressor de alta pressão.

As 26 colunas, separadas por espaços, são: identificador do motor, ciclo, três ajustes operacionais e 21 sensores. Para começar, use **T50**, a temperatura na saída da turbina de baixa pressão: sensor 4, **coluna 9 do arquivo**, contando a partir de 1.

Adote os mesmos valores nas duas regras:


| Parâmetro             | Valor para a atividade | Significado                                       |
| --------------------- | ---------------------- | ------------------------------------------------- |
| Tempo logístico `L`   | 20 ciclos              | Tempo entre o aviso e a remoção                   |
| Custo planejado `cp`  | 1                      | Unidade de custo de uma remoção feita a tempo     |
| Custo após falha `cf` | 50                     | Custo 50 vezes maior quando a remoção chega tarde |


São valores didáticos, não estimativas de uma operação real. Usaremos trajetórias completas para acompanhar as decisões até seu desfecho. Os arquivos oficiais `test_FD001.txt` e `RUL_FD001.txt` ficam fora desta atividade, pois o primeiro termina antes da falha e não contém as leituras posteriores.

## Roteiro



### 1. Separe os motores

Sorteie **70 motores para desenvolver a regra** e reserve **30 para a avaliação final**, com semente aleatória 42. Mantenha todos os ciclos de cada motor no mesmo grupo. Escolha os parâmetros somente nos 70 motores e aplique a regra escolhida uma vez aos 30 reservados.

Em Python, este trecho prepara a leitura e a divisão, executado a partir da pasta da aula:

```python
import numpy as np
import pandas as pd

colunas = ["motor", "ciclo"] + [f"ajuste_{i}" for i in range(1, 4)]
colunas += [f"sensor_{i}" for i in range(1, 22)]
dados = pd.read_csv("data/train_FD001.txt", sep=r"\s+", header=None, names=colunas)
ids = np.random.default_rng(42).permutation(sorted(dados["motor"].unique()))
desenvolvimento = dados[dados["motor"].isin(ids[:70])].copy()
avaliacao = dados[dados["motor"].isin(ids[70:])].copy()
```

O maior ciclo de cada motor é seu ciclo de falha, `T`. Durante a simulação, use `T` apenas para conferir o resultado da decisão; o aviso deve depender das informações disponíveis até o ciclo atual.

### 2. Monte uma referência por idade

Defina a idade de remoção `a` como a **menor vida observada nos 70 motores de desenvolvimento**. Essa será a mesma idade para todos os motores. Emita o aviso em `a − 20` e programe a remoção para `a`.

Essa referência é fácil de explicar: todos os motores recebem a mesma programação, independentemente dos sensores.

### 3. Teste uma regra com sensor

Você pode propor sua própria regra. Um caminho inicial é:

1. Para cada motor, calcule a média de T50 nos primeiros 15 ciclos: sua **linha de base**.
2. A partir do ciclo 16, calcule a média das 15 leituras mais recentes, incluindo a atual: a **média móvel**.
3. Emita um único aviso quando essa média superar a linha de base em uma porcentagem escolhida. Programe a remoção para 20 ciclos depois.
4. Compare três porcentagens nos motores de desenvolvimento: **0,20%, 0,35% e 0,50%**. Escolha a que apresentar o menor custo por ciclo e mantenha-a fixa na avaliação final. Em empate, escolha a menor porcentagem.

Exemplo: se a linha de base for 1.400 °R e a porcentagem escolhida for 0,50%, o limite será `1.400 × 1,005 = 1.407 °R`. A unidade original de temperatura pode ser mantida.

Calcule as médias separadamente para cada motor, em ordem de ciclo, sempre com leituras já observadas. **Esse caminho decide diretamente pelo sensor; prever RUL não é obrigatório.** Se preferir um modelo de RUL, escolha seus parâmetros em divisões internas dos 70 motores e explique como a previsão gera o aviso.

### 4. Compare as duas regras nos 30 motores reservados

Para cada motor, registre o ciclo do aviso, a remoção programada e o ciclo de falha. Adote esta convenção da simulação:


| Resultado            | Condição                                    | Ciclos aproveitados `U` | Custo `C` |
| -------------------- | ------------------------------------------- | ----------------------- | --------- |
| Remoção planejada    | Remoção programada até `T`, inclusive       | Ciclo da remoção        | 1         |
| Planejamento perdido | Remoção depois de `T`, ou ausência de aviso | `T`                     | 50        |


Calcule o **custo por ciclo = soma dos custos / soma dos ciclos aproveitados**. Nas remoções planejadas, a vida desperdiçada é `T − ciclo da remoção`.

Apresente esta tabela, preenchida com seus resultados:


| Regra                     | Motores com planejamento perdido / 30 | Vida desperdiçada média, só nas remoções planejadas | Custo por ciclo |
| ------------------------- | ------------------------------------- | --------------------------------------------------- | --------------- |
| Remoção por idade         |                                       |                                                     |                 |
| Regra baseada em sensores |                                       |                                                     |                 |


Se uma regra não produzir remoções planejadas, indique “não se aplica” na média de vida desperdiçada. Analise as três medidas juntas: um custo menor pode vir acompanhado de mais remoções tardias.

### 5. Transforme o resultado em uma pergunta de pesquisa

Consulte o artigo **[Damage Propagation Modeling](data/Damage Propagation Modeling.pdf)**, de Saxena et al. (2008), disponíveis no material da aula. Indique a fonte e explique qual ideia ajudou sua investigação.

Em um parágrafo, responda: **o que você mudaria no próximo experimento e que resultado mostraria se a mudança ajudou?** Exemplos: ajustar o limite ao ruído de cada motor; combinar dois sensores; ou variar o tempo logístico. Escolha uma pergunta que possa ser investigada mantendo apenas o FD001.

## Entrega

Envie **um relato de até duas páginas**, acompanhado do notebook, código ou planilha que permita reproduzir os cálculos. Inclua a regra escolhida e seus parâmetros, a tabela de comparação, um gráfico de um motor da avaliação com aviso/remoção/falha indicados e o parágrafo de pesquisa futura. Se o aviso não ocorrer, mostre isso no gráfico.

Conclua se sua regra melhorou a decisão e indique uma limitação da análise. A avaliação considera a separação correta dos motores, a comparação justa, a clareza da explicação e o uso dos resultados para propor uma próxima investigação. **Uma tentativa que não supera a referência, mas é bem executada e interpretada, também atende à atividade.**