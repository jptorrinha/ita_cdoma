# Aproveitamento da apresentação da Amanda — aula de 7/10/2026

Comparação entre `slides_defesa_ITA_Amanda.pptx` (39 slides, defesa de 5/10/2026) e a versão inicial de `apresentacao/cmapss_slides.pdf` (30 páginas), conferida também no fonte `cmapss_slides.tex`.

A apresentação da aula já desenvolve a decisão de remoção, o tempo logístico, o custo por ciclo e a comparação entre políticas. A contribuição mais útil da defesa é tornar visíveis as etapas entre uma leitura de sensor, uma previsão e uma recomendação. Recomendo cinco acréscimos, com cerca de 19 minutos de exposição, e um bloco opcional de três minutos.

## Seleção e lugar de inserção

As páginas abaixo correspondem ao PDF inicial de 30 páginas, antes da integração.

| Prioridade | Material da Amanda | Inserção na aula | Adaptação e objetivo | Tempo |
|---|---|---|---|---:|
| Principal | Diagrama do motor, slide 13; mapa dos sensores, slides 25–26 | Antes da página 7, “Os 21 sensores” | Mostrar fan, compressores e turbinas; localizar T30, Ps30 e T50. O aluno deve relacionar a coluna da tabela com uma medição física. | 2 min |
| Principal | Trajetória T50, média móvel, limites e ponto detectado, slide 16 | Antes da página 18, “Como detectar o ponto P” | Explicar a linha de base e o primeiro cruzamento do limite. Identificar a regra de ±0,5% como o detector empregado naquele estudo. | 4 min |
| Principal | Previsão versus RUL verdadeira, antes e depois da margem, slide 27 | Antes da página 15, “Regra de decisão com tempo logístico” | Explicar os eixos e a diagonal. Acima dela, a previsão dá mais tempo do que realmente resta; abaixo, dá menos. | 3 min |
| Principal | Exemplo de calibração e subtração da margem, slides 21–23 | Na sequência do gráfico anterior | Construir a margem com cinco erros, em português, e conectá-la à regra de alarme da aula. | 6 min |
| Principal | Tabela de quantis e recomendações tardias, slide 28 | Depois da página 25, “Custo por ciclo voado” | Usar três linhas para discutir o compromisso entre antecipação e concordância das categorias de ação. Apresentar como resultado de Amanda, separado da comparação de políticas da aula. | 4 min |
| Opcional | Importância dos atributos e mapa físico, slides 25–26 | Depois da página 17, “Arquitetura em dois estágios” | Mostrar como investigar quais medições contribuem para a previsão. Reduzir o gráfico a poucos atributos, explicar os nomes e acrescentar escala e legenda. | 3 min |

## Exemplo numérico pronto para explicar a margem

Os valores abaixo respeitam a disposição visual das linhas no slide 21. A ordem dos objetos extraídos do PowerPoint não corresponde à ordem das linhas exibidas.

| Motor | RUL prevista | RUL verdadeira | Erro: prevista − verdadeira |
|---:|---:|---:|---:|
| 1 | 20 | 28 | −8 |
| 2 | 21 | 17 | 4 |
| 3 | 14 | 11 | 3 |
| 4 | 10 | 8 | 2 |
| 5 | 10 | 9 | 1 |

Texto para o slide:

> Um erro positivo dá ao planejador mais tempo do que o motor realmente tem. Para reduzir esse risco, calculamos uma margem usando motores reservados para calibração.

Ordenados, os erros são `−8, 1, 2, 3, 4`. O percentil 75 deste exemplo é 3 ciclos. Subtrair essa margem produz as previsões ajustadas `17, 18, 11, 7, 7`.

\[
H=\max\{Q_q(\widehat{\mathrm{RUL}}-\mathrm{RUL}),0\},
\qquad
\mathrm{RUL}_{\mathrm{ajustada}}=\max\{\widehat{\mathrm{RUL}}-H,0\}.
\]

Nota para o professor: apresente primeiro o motor 2. A previsão de 21 ciclos supera a vida verdadeira de 17. A margem de 3 reduz a previsão para 18, mas ainda sobra um ciclo de superestimação. O exemplo mostra o efeito e o limite da correção. Depois retome a regra da aula: emitir alarme quando `RUL prevista − H ≤ L`. A margem antecipa o alarme; o tempo logístico continua sendo necessário para executar a remoção.

O conjunto de cinco motores é um exemplo aritmético. O quantil da distribuição de erros, por si só, não garante uma determinada proporção de remoções antes da falha durante o acompanhamento sequencial. A escolha do quantil e da margem deve ocorrer nos dados de desenvolvimento, preservando os motores usados para avaliação final.

## Um resultado para discussão em sala

O slide 28 apresenta os seguintes resultados para FD001:

| Quantil | Margem (ciclos) | Concordância das categorias de ação* | Previsões tardias | Previsões tardias quando a manutenção é requerida |
|---:|---:|---:|---:|---:|
| 0,75 | 5,34 | 0,85 | 6 | 2 |
| 0,80 | 6,56 | 0,85 | 5 | 2 |
| 0,95 | 16,64 | 0,54 | 0 | 0 |

*A apresentação denomina essa coluna “Accuracy”; sua definição formal não aparece no slide. Explicitar o denominador e o critério de acerto antes de incorporá-la como métrica na aula.*

Pergunta para os alunos:

> A margem de 16,64 ciclos eliminou as previsões tardias neste teste. Que informação ainda precisamos para decidir se ela é a melhor escolha?

Nota para o professor: conduza a discussão para vida removida antecipadamente, custo por ciclo, disponibilidade e tempo logístico. Zero ocorrências observadas neste teste é um resultado amostral. A tabela avalia previsões e categorias de ação em pontos de teste; ela não demonstra zero falhas em uma política sequencial de manutenção. Essa distinção conecta o estudo de Amanda à avaliação mais ampla usada na aula.

## Adaptações necessárias

1. **Ponto P.** Usar a distinção do slide 7 de Amanda entre início físico da degradação e possibilidade de detectá-la. No slide 16, trocar “início da degradação” por “degradação detectada pela regra”. O cruzamento do limiar estima um ponto de detecção; os arquivos disponíveis não fornecem o instante físico de início como rótulo para validar essa estimativa.
2. **Categorias de ação.** O slide 23 usa faixas de RUL de 60, 30 e 15 ciclos. Apresentá-las como escolhas ilustrativas daquele estudo. Na aula, a antecedência necessária é representada por `L`, e a margem por `H`; os limiares precisam ser ligados a esses requisitos.
3. **Experimentos distintos.** Amanda apresenta CatBoost, janela de 15 ciclos e resultados no teste oficial. A aula apresenta LightGBM, média móvel de 25 ciclos, outros detectores e avaliação sequencial com validação aninhada por motor. Identificar a origem dos gráficos e manter separados os números dos dois estudos.
4. **Explicabilidade.** Um gráfico de atribuição ajuda a entender o comportamento do modelo. Atribuições coerentes com o domínio motivam investigação, mas não comprovam o mecanismo físico de degradação. O gráfico da defesa precisa de identificação da medida e da escala. Essa cautela é sustentada pela [documentação oficial de SHAP sobre interpretação e causalidade](https://shap.readthedocs.io/en/latest/example_notebooks/overviews/Be%20careful%20when%20interpreting%20predictive%20models%20in%20search%20of%20causal%20insights.html).
5. **Atribuição.** Identificar os materiais aproveitados como “Adaptado de Amanda Schneider Bassani, defesa de mestrado, ITA, 5/10/2026”. Traduzir títulos, eixos e legendas; preservar os resultados e a identificação dos subconjuntos.

## Material para consulta, sem inclusão no núcleo da aula

- Slides 8–10: motivação e lacunas de pesquisa; a aula já tem uma pergunta operacional concreta.
- Slides 17–20: grade de configurações, ranking composto e seleção de modelo; reservar para aprofundamento metodológico. O ranking de regressão responde a uma pergunta diferente da escolha por custo operacional.
- Slides 29 e 32: decisões de cada unidade; usar apenas se houver tempo para explicar as categorias e as divergências.
- Slide 35: comparação entre calibração e teste; útil para discutir generalização, mas os conjuntos e a granularidade precisam ser descritos antes de atribuir uma causa à diferença de RMSE.

Integração realizada em 6/10/2026: os cinco blocos principais foram incorporados à apresentação, em conjunto com os conteúdos selecionados do artigo. A integração inicial resultou em 39 páginas; a revisão para alunos não engenheiros ampliou o PDF para 52 páginas, com exemplos e explicações de siglas. O mapa de sensores foi redesenhado; a tabela de quantis apresenta os totais explicitados na defesa, sem a coluna Accuracy de definição incerta. O bloco opcional de importância dos atributos permanece como possibilidade de aprofundamento. A apresentação de defesa foi preservada como fonte.
