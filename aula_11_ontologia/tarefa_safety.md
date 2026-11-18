# Tarefa da aula 11 — Monte Carlo: comparar planos e interpretar limites

**TE-292 · Ciência de Dados em Operação e Manutenção de Aeronaves**

**Entrega individual:** envie o notebook por e-mail para `celio@ita.br` até **25/11/2026**. Prazo: uma semana.

## Objetivo e material

Você deverá comparar dois planos de inspeção estrutural, quantificar a precisão das estimativas de Monte Carlo e avaliar como uma mudança no crescimento da trinca afeta a conclusão.

Use `tarefa_safety.ipynb`, fornecido nesta pasta. O notebook contém o simulador pronto, a execução dos cenários e espaços para suas respostas. Requer Python 3, NumPy e um ambiente que abra notebooks, como Jupyter ou Google Colab. Não é necessário obter dados externos.

**Sua parte de programação consiste em calcular os indicadores e apresentar a tabela.** Mantenha as funções do simulador e os cenários fornecidos. Não é necessário executar R, escrever outro simulador, entregar relatório separado ou preparar um README. Os exercícios do notebook utilizado em aula não fazem parte desta entrega.

## O que será simulado

O modelo acompanha uma frota de 1.000 aeronaves, cada uma com vida nominal de 80.000 ciclos. A trinca cresce segundo o modelo fornecido; sua detecção depende do tamanho e da curva de probabilidade de detecção (POD). Cada réplica simula uma frota completa e devolve dois valores: o número de falhas estruturais e a exposição nominal da frota, em horas.

Serão executados **três cenários**, com **10.000 réplicas em cada um**:

| Cenário | Limiar da primeira inspeção (ciclos) | Intervalo entre inspeções (ciclos) | Fator de crescimento da trinca | Semente |
|---|---:|---:|---:|---:|
| Base | 15.000 | 7.500 | 1,0 | 2026 |
| Revisto | 10.000 | 5.000 | 1,0 | 2027 |
| Revisto com crescimento +20% | 10.000 | 5.000 | 1,2 | 2028 |

Os valores de inspeção são os parâmetros nominais do modelo; mantenha a variação aleatória já implementada no simulador. O fator 1,2 multiplica o coeficiente de crescimento da trinca tanto na inicialização quanto após cada renovação. No código Python, os fatores são escritos como `1.0` e `1.2`.

## Parte 1 — Comparar os planos base e revisto (40%)

1. Execute as células de importação, definição do modelo e experimentos, nessa ordem. As versões de Python e NumPy serão impressas automaticamente. A célula de experimentos já executa os três cenários, incluindo o da Parte 2, e guarda os vetores em `resultados`.
2. Complete a célula indicada para calcular os indicadores de cada cenário. Para cada réplica, calcule a taxa como `falhas / horas`. Calcule a média das falhas e a média dessas taxas. Para cada vetor, calcule o erro-padrão (EP) com `vetor.std(ddof=1) / np.sqrt(vetor.size)`.
3. Apresente **uma tabela com três linhas**, uma por cenário, e estas colunas: cenário, número de réplicas, semente, falhas médias por frota, EP das falhas, taxa média (/h), EP da taxa (/h), limite inferior e limite superior da faixa de dois EP da taxa. Calcule os limites como **taxa média − 2 × EP** e **taxa média + 2 × EP**. Use notação científica para taxas e seus erros-padrão; não as arredonde a zero. Uma tabela impressa pela célula de código é suficiente; não são exigidos gráficos.
4. Na célula Markdown **Comparação dos planos**, escreva um parágrafo: qual plano apresentou menor taxa, como cada plano se situa em relação ao critério didático de **1 × 10⁻⁹ /h** e se a precisão obtida permite concluir que a taxa está abaixo desse valor.

Use a seguinte regra didática para interpretar cada cenário:

- faixa inteiramente abaixo do critério: os resultados sustentam taxa inferior ao critério, sob as hipóteses do modelo;
- faixa inteiramente acima do critério: os resultados sustentam taxa superior ao critério;
- faixa que inclui o critério: resultado inconclusivo com a precisão obtida.

A faixa de dois EP é uma aproximação da incerteza de Monte Carlo, não uma garantia de segurança. Se todas as réplicas de um cenário retornarem zero falhas, registre que a amostra não permite concluir pela ausência de risco; o EP amostral nulo não sustenta essa conclusão. Não é necessário desenvolver outro método estatístico.

## Parte 2 — Testar a sensibilidade (35%)

Use a terceira linha da tabela, **Revisto com crescimento +20%**, já gerada pela célula de experimentos. A única mudança nos parâmetros do modelo em relação ao plano revisto é o fator de crescimento; cada cenário usa a semente indicada.

Na célula Markdown **Sensibilidade**, escreva um parágrafo que:

1. compare a taxa do plano revisto com a do cenário de crescimento +20%, citando os valores da tabela;
2. aplique a mesma regra de dois EP ao cenário alterado;
3. diga se a conclusão sobre ficar abaixo do critério se mantém e o que isso revela sobre a dependência da decisão em relação ao crescimento da trinca.

O aumento de 20% é um **cenário didático de sensibilidade**, não uma estimativa calibrada da incerteza desse parâmetro. Todos os parâmetros são ilustrativos; os resultados não demonstram a segurança de uma frota real.

## Parte 3 — Interpretar os limites (25%)

Preencha as três respostas indicadas no notebook. Um parágrafo curto por item é suficiente; no item 3, você pode usar duas linhas de uma tabela.

1. **Exposição e denominador nominal:** explique o que representa a soma de 80.000 ciclos × horas por ciclo de cada aeronave, por que sua unidade é hora e como ela entra no cálculo da taxa. Indique uma situação operacional em que a exposição real poderia diferir dessa exposição nominal. Não é necessário alterar o denominador ou investigar o código R.
2. **Verificação e validação:** diferencie conferir se o código implementa as regras especificadas de avaliar se o modelo representa uma frota operacional. Explique por que executar o código fornecido não basta para validar o modelo.
3. **Dados para validação:** proponha dois conjuntos de dados operacionais. Para cada conjunto, indique os registros ou medições necessários, o elemento do modelo que ajudariam a avaliar e um cuidado de definição ou de registro para evitar uma comparação inadequada.

## Entrega e avaliação

Antes de enviar:

1. Confirme que `N_REP = 10_000`. Você pode usar 200 réplicas durante a preparação, mas os resultados entregues devem usar 10.000 por cenário.
2. Reinicie o kernel e execute todas as células, em ordem. Confira se as versões, a tabela completa e as respostas estão visíveis e se não há mensagens de erro.
3. Salve e envie **somente** o arquivo `Sobrenome_Nome_aula_11.ipynb`, substituindo os campos pelo seu nome. Não envie PDF, ZIP ou cópias dos outros materiais da aula.

| Critério | O que será avaliado | Peso |
|---|---|---:|
| Comparação dos planos | Dois planos executados conforme os parâmetros; versões registradas; tabela com indicadores e faixas de dois EP; comparação fundamentada com o critério | 40% |
| Sensibilidade | Terceiro cenário incluído na tabela; comparação com o plano revisto; conclusão fundamentada nos valores e nas faixas de dois EP | 35% |
| Interpretação dos limites | Denominador e unidade explicados; verificação distinguida de validação; dois conjuntos de dados com uso e cuidado de registro explicitados | 25% |
