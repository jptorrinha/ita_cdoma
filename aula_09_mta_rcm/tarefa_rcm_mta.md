# TE-292 — Da seleção da manutenção à execução da tarefa: RCM e MTA

**Atividade individual — Aula 9 — Estratégias de manutenção, RCM e MTA**

Relatório em PDF, **no máximo quatro páginas**, incluindo tabelas e ficha MTA. Não há capa. Referências, se houver, cabem em meia página além desse limite. Fonte 11 ou 12, espaçamento simples. Não é necessário reproduzir telas dos aplicativos.

Arquivo: `Sobrenome_Nome_aula_09.pdf`, com identificação do aluno no topo, enviado para `celio@ita.br`.

Data de entrega: _______________

Os aplicativos da atividade são [RCM](https://tool.aerologlab.ita.br/rcm) e [MTA](https://tool.aerologlab.ita.br/mta). Onde este enunciado divergir da saída ou da documentação do aplicativo, valem o aplicativo e sua documentação; registre a divergência no relatório.

---

## Objetivos

Justificar uma tarefa pelas funções e consequências de falha, estruturar sua execução e avaliar se os recursos e o prazo permitem realizá-la. RCM seleciona o que fazer e por quê; MTA detalha como executar, com quais recursos e quanto tempo.

Três partes, nesta ordem: seleção da tarefa por RCM, análise da execução por MTA e decisão integrada. Texto corrido, com tabela onde os números pedem tabela. A redação não repete a tabela célula a célula.

Use suas próprias saídas dos aplicativos e registre os parâmetros de cada execução. Os casos conceituais abaixo são hipóteses didáticas, não dados de uma aeronave real nem procedimentos aprovados de manutenção.

## Parte 1 — RCM: qual manutenção é necessária?

### 1. Caso conceitual: conjunto de roda, pneu e monitoramento

Considere uma aeronave empregada em missões diárias, com uma janela de manutenção de 300 minutos entre missões. Admita os seguintes modos de falha:

| Modo | Informações disponíveis para a análise |
|---|---|
| A — Desgaste progressivo do pneu | A inspeção identifica degradação antes da perda da função. Ainda é necessário demonstrar que a antecedência permite intervir. A falha pode comprometer a segurança no pouso. |
| B — Falha abrupta do sensor de pressão | A perda da medição é anunciada à tripulação. A taxa de falha é constante e não há indicador precursor conhecido. Existem meios alternativos de verificar a pressão, mas sua suficiência operacional precisa ser avaliada. |
| C — Falha do circuito de alarme de uma proteção de reserva | A falha permanece oculta durante a operação normal e pode ser descoberta por teste funcional. Quando a proteção for demandada, a indisponibilidade do alarme pode contribuir para uma consequência de segurança. |

**a)** Defina o contexto operacional e duas funções do conjunto. Expresse cada função por um verbo, um objeto e um padrão de desempenho verificável. Se faltar um valor técnico, indique o dado necessário; não invente limites de pressão, desgaste ou temperatura.

**b)** Preencha uma linha por modo de falha. Diferencie a perda ou insuficiência da função do mecanismo que a provoca, e diferencie o que acontece após a falha de sua importância para segurança e operação.

| Modo | Falha funcional associada | Efeitos e evidência de detecção | Consequências, incluindo falha oculta quando aplicável | Tarefa/política proposta | Por que é aplicável e eficaz? | Ação se não houver tarefa adequada |
|---|---|---|---|---|---|---|
| A | | | | | | |
| B | | | | | | |
| C | | | | | | |

Considere manutenção sob condição, restauração ou substituição programada, busca de falhas e operação até a falha. Não é necessário usar todas as alternativas. Fundamente a escolha nas informações disponíveis e identifique o que ainda precisa ser demonstrado. Para consequências de segurança, a ausência de tarefa adequada exige examinar mudanças de projeto ou operação; não autoriza automaticamente operar até a falha.

**c)** Responda, em até três frases por pergunta:

- Por que uma taxa de falha constante, por si só, não justifica a substituição periódica do sensor? Considere substituí-lo por outro com a mesma taxa de falha.
- Que evidências sobre detecção, intervalo P-F e tempo de resposta são necessárias para justificar a inspeção do pneu?
- O teste do circuito de alarme evita sua falha ou revela uma falha já existente? Como isso altera a justificativa da tarefa e de seu intervalo?

Leitura de apoio: `RCM_Gateway_worldclass_maintenance.pdf`, especialmente as seções 4.4 e 5.5 a 5.8, sobre funções, falhas funcionais, modos, consequências e seleção de tarefas.

### 2. Experimento quantitativo: intervalo económico e LIM

Aplicativo: [RCM](https://tool.aerologlab.ita.br/rcm). Apoio: [manual](https://tool.aerologlab.ita.br/rcm/manual).

Use o cenário **Default Example**, de componente hidráulico típico: PMC = $315, CMC = $847, MTBF = 15 000 h e LIM = 600 h. Este experimento é separado do caso da roda: não transfira seus parâmetros para o pneu. O aplicativo explora o intervalo económico de uma intervenção já assumida; sua saída não substitui a análise RCM de seleção da tarefa.

O modelo de confiabilidade padrão é exponencial, \(R(t) = e^{-\lambda t}\) com \(\lambda = 1/\text{MTBF}\); mantenha a opção Weibull, \(R(t) = e^{-(t/\eta)^{\beta}}\), desativada. A otimização é uma varredura de 100 h a 8 000 h, com horizonte de análise de 8 000 h e passo de 100 h. Em todas as execuções, MTBF, LIM, horizonte e passo permanecem nesses valores: muda um custo de cada vez. Alterar mais de um parâmetro de uma vez impede atribuir o resultado ao custo alterado.

Antes de executar, escreva as funções de custo como estão documentadas no manual e diga, em uma frase por termo, o que cada uma empurra a busca a fazer. Note a assimetria: o custo preventivo é multiplicado pelo número de intervalos no horizonte, `Horizonte/t`, enquanto o corretivo entra uma só vez, como `[1 − R(t)] × CMC`. Pergunte-se o que essa assimetria faz com o custo total à medida que `t` cresce.

Registre então, em uma frase, a direção esperada do intervalo ótimo quando o CMC dobra e quando o PMC dobra, com a razão de cada uma. Essa frase fica no relatório e não é reescrita depois dos números. A nota depende da fundamentação dessa frase e do confronto com a tabela. Uma expectativa que os dados não confirmem permanece no texto e não reduz a nota quando a interpretação posterior é adequada.

1. Execute o cenário padrão, sem alterar horizonte, passo ou modelo de confiabilidade.
2. Dobre somente o CMC e execute novamente. Depois, restaure o CMC, dobre somente o PMC e repita.
3. Registre os resultados e explique o sentido de cada mudança, inclusive se o intervalo permanecer igual ou atingir uma fronteira da busca.

| Execução | PMC ($) | CMC ($) | Intervalo ótimo (h) | R no ótimo (%) | Custo total no ótimo ($) | Custo total no LIM de 600 h ($) | Economia anual ($/ano) |
|---|---|---|---|---|---|---|---|
| Padrão | 315 | 847 | | | | | |
| Apenas CMC duplicado | 315 | 1694 | | | | | |
| Apenas PMC duplicado | 630 | 847 | | | | | |

O cálculo é determinístico: a mesma entrada reproduz a mesma saída. Uma diferença entre duas execuções com as mesmas entradas indica parâmetro alterado por engano, não variabilidade do modelo. Se uma execução não produzir resultado, registre o fato; não substitua o número.

O manual, no Exemplo 1, relata intervalo ótimo de 550 h e confiabilidade de 96,4% para esses mesmos dados. Se a sua execução devolver outra coisa, registre o que o aplicativo devolveu e confronte o resultado com as funções de custo documentadas: vale a saída do aplicativo. Explicar uma divergência dessas, com as fórmulas na mão, vale mais do que repetir o número do manual.

Recomende um intervalo para o cenário padrão dentro das condições assumidas pelo aplicativo. Separe a recomendação económica das evidências e aprovações ainda necessárias. Se o ótimo atingir o horizonte de 8 000 h, explique por que isso não demonstra um ótimo além da região pesquisada. Se ficar acima do LIM, lembre que o limite do fabricante é um teto regulatório: a decisão é manter o LIM e documentar um pedido de extensão, não operar além dele. A economia anual informada supõe 1 000 h de voo por ano; diga o que muda na recomendação se a utilização real for outra. Responda também: **um intervalo mais barato basta para demonstrar que a tarefa controla as consequências de falha?**

## Parte 2 — MTA: como executar e com qual prazo?

### 3. Ficha de análise da tarefa

Retome o modo A e a substituição do pneu após atingir um critério de condição. Construa uma ficha MTA com cinco a oito subtarefas, abrangendo preparação e segurança, acesso/remoção, instalação, verificação e liberação. Explicite o gatilho da substituição e o critério de conclusão da tarefa.

| Subtarefa | Predecessora(s) | Duração base (min) | Quantidade e qualificação do pessoal | Ferramentas/equipamentos | Peças/consumíveis | Condição de segurança e critério de conclusão |
|---|---|---|---|---|---|---|
| | | | | | | |

Use informações da documentação quando disponíveis. Identifique durações, recursos ou sequências que forem estimativas suas. A ficha é um exercício de planejamento; procedimentos e critérios técnicos devem remeter à documentação aplicável. Ela não precisa reproduzir as nove subtarefas do cenário de pneu do simulador.

Observe a diferença de escopo: o formato de dados do simulador tem uma linha por subtarefa, com duração base (`MTTR`), três probabilidades de atraso e os indicadores `COTS` e `SPECIAL`, mas **não** tem coluna de precedência. Sua ficha declara predecessoras e, se houver, paralelismo; o simulador agrega durações sem modelo de precedência. Essa diferença já basta para que o tempo decorrido da sua ficha não precise coincidir com o do cenário simulado.

Calcule o tempo decorrido base e o esforço em homem-hora da sua ficha. Declare se as etapas são sequenciais ou se existe paralelismo justificável. Explique por que duas pessoas trabalhando durante uma hora representam uma hora decorrida e duas homem-hora. Separe execução ativa de espera por pessoal, peça ou equipamento.

### 4. Experimento quantitativo: distribuição da duração

Aplicativo: [MTA](https://tool.aerologlab.ita.br/mta). Apoio: [documentação dos cenários](https://tool.aerologlab.ita.br/mta/summary).

Selecione **5 000 simulações** (opção *Balanced*) e execute **três vezes** cada cenário: *Aircraft Tire Replacement* (ATA 32, nove subtarefas) com alvo de **300 min** e *Avionics Post-Maintenance Check* (ATA 34, nove subtarefas) com alvo de **200 min**. Esses são os alvos documentados dos dois cenários, cujos MTTR determinísticos são de cerca de 235 min e 170 min. Três execuções mostram a dispersão entre amostras; não bastam para afirmar, com confiança estatística, uma diferença pequena. As entradas desses cenários pertencem ao aplicativo: os resultados não são uma simulação da ficha que você criou.

Na documentação, a duração base de cada subtarefa é sorteada de uma normal com média `MTTR` e desvio-padrão `0,1 × MTTR`, e os atrasos entram como acréscimos discretos sobre essa base. Diga o que essa construção implica para a forma da distribuição do tempo total e por que o coeficiente de variação do total não é 10%.

Não há semente aleatória registrada. Sem semente, as execuções não se reproduzem número a número. O protocolo aceita essa limitação: o que se observa é a amplitude entre execuções.

Tabela obrigatória, com os três valores de cada cenário, não só a média:

| Cenário | Alvo (min) | MTTR determinístico (min) | Média (3 execuções, min) | P90 (3 execuções, min) | P95 (3 execuções, min) | Coeficiente de variação (3 execuções) | Probabilidade de concluir no alvo (3 execuções) | Nível de risco informado |
|---|---|---|---|---|---|---|---|---|
| Pneu | 300 | | | | | | | |
| Aviônica | 200 | | | | | | | |

1. No pneu, repita com alvo igual ao MTTR determinístico e com alvo próximo do P90 obtido inicialmente. Registre os alvos e as probabilidades de cumprimento. Explique por que a duração determinística, a média e um percentil respondem a perguntas diferentes.
2. Compare a diferença entre alvos com a amplitude entre as três execuções do mesmo alvo. Se as duas forem da mesma ordem, cabe concluir que o experimento não separa o efeito do alvo da variabilidade da simulação; essa conclusão, quando a tabela a sustenta, é uma resposta válida. Alterar apenas o alvo não altera, por si só, a distribuição física da duração.
3. Adote **90% de probabilidade de cumprimento** como requisito de planejamento do exercício. Escolha um prazo para o pneu e diga se a janela de 300 min atende ao requisito. Explique o que mudaria se a exigência fosse 95%. O prazo é uma estimativa para planejamento, distinta dos critérios técnicos de execução e liberação.

### 5. Recursos e atrasos

Na documentação, os atrasos por ocorrência são: pessoal (`DELAY1`), **+15 min**; peças COTS (`DELAY2`), **+30 min**; equipamento especial (`DELAY3`), **+60 min**. As probabilidades são específicas de cada subtarefa; o atraso de peça só se aplica com `COTS=1`, e o de equipamento com `SPECIAL=1`.

Para o cenário de pneu, a documentação declara três riscos principais:

| Recurso | Categoria de atraso | Probabilidade declarada | Acréscimo por ocorrência |
|---|---|---:|---:|
| Disponibilidade do pneu | `DELAY2` — peça COTS | 25% | +30 min |
| Balanceadora de roda | `DELAY3` — equipamento especial | 20% | +60 min |
| Disponibilidade do inspetor | `DELAY1` — pessoal | 20% | +15 min |

1. Estime a contribuição esperada de cada categoria por ocorrência, como `probabilidade × acréscimo`, e ordene-as. Justifique qual merece prioridade de investigação considerando probabilidade, acréscimo e quantidade de etapas afetadas. O maior acréscimo por ocorrência não determina sozinho o atraso dominante.
2. Essa estimativa é de primeira ordem: a documentação dos cenários declara as probabilidades desses três riscos, mas não a tabela `DELAY1`–`DELAY3` subtarefa a subtarefa, de modo que não se sabe quantas etapas cada categoria afeta. Com a tabela por subtarefa, a contribuição seria `soma(probabilidade aplicável × acréscimo de tempo)`. Declare essa limitação em vez de apresentar a ordenação como conclusiva. Contribuição à média e contribuição ao risco de ultrapassar o prazo também podem diferir.
3. Proponha uma ação concreta — disponibilizar peça, reservar equipamento ou programar pessoal qualificado — e explique qual espera ela reduz. Indique como verificaria sua eficácia comparando a situação inicial com a situação após a ação, mantendo o mesmo alvo. Não invente resultados se o aplicativo não permitir alterar os recursos.

A coluna `% of Total Variance` descreve a dispersão da duração base das subtarefas. Ela não demonstra, sozinha, qual recurso domina o atraso total.

## Parte 3 — Decisão integrada

Em um parágrafo, responda: **a substituição do pneu selecionada na análise RCM pode ser executada com os recursos disponíveis dentro da janela de 300 min, atendendo ao requisito de 90%?**

Relacione o modo de falha, o gatilho da tarefa, a ficha MTA e a evidência do cenário simulado. Como a ficha e o cenário podem ter entradas diferentes, explicite o limite dessa evidência. Se o prazo não for atendido, proponha uma mudança de recursos, janela ou operação. Não adie uma intervenção necessária à segurança apenas para acomodar a programação.

Feche com duas respostas curtas, de poucas linhas cada:

- Uma recomendação que uma CAMO ou uma organização de manutenção **não** deveria extrair deste exercício, e por quê.
- Que dado de campo, ou que modificação do protocolo, você buscaria primeiro para validar a recomendação: histórico de condição do pneu, intervalo P-F observado, durações reais de tarefa, probabilidades de espera por recurso ou custos efetivos? Justifique a prioridade.

## Entrega e avaliação

Organize a entrega na ordem das três partes. Conclusões sem justificativa, ou sem rastreabilidade dos parâmetros de cada execução, não bastam.

A nota desta atividade é a média ponderada de três critérios:

\[
N = 0{,}20\,C + 0{,}30\,T + 0{,}50\,R
\]

\(C\) é clareza da comunicação, \(T\) é completude técnica e \(R\) é rigor científico. A presença de um item entra na completude; a correção e a interpretação entram no rigor. O mesmo defeito não é descontado nos dois critérios.

**1. Clareza da comunicação — 20%.** O relatório apresenta o caso, a seleção da tarefa, os experimentos e a decisão de forma organizada. Termos de RCM e MTA usados com o significado próprio: função, falha funcional, modo de falha, efeito, consequência, tempo decorrido, homem-hora, espera logística. Tabelas e ficha MTA legíveis sem o texto ao redor. Precisão técnica é rigor; clareza é a forma como o argumento se deixa ler.

**2. Completude técnica — 30%.** Estão presentes: contexto operacional e duas funções com padrão verificável; uma linha por modo de falha (A, B e C) com tarefa proposta e ação na ausência de tarefa adequada; as três respostas curtas da Parte 1; as funções de custo do aplicativo RCM escritas como documentadas; a frase de expectativa registrada antes das execuções alternativas; a tabela das três execuções do RCM; a ficha MTA com cinco a oito subtarefas, tempo decorrido e homem-hora; a tabela dos dois cenários do MTA com as três execuções de cada um; a análise de recursos e atrasos; a decisão integrada e as duas respostas de fechamento. Omissão essencial — um experimento ausente, uma parte inteira ausente, uma pergunta sem resposta — pesa mais do que omissão secundária, como um parâmetro não nomeado ou uma célula faltando na tabela. Item omitido não conta como resposta implícita.

**3. Rigor científico — 50%.** Quatro evidências:

- **Distinção conceitual.** Falha funcional separada do mecanismo que a provoca; efeito separado de consequência; falha oculta identificada onde existe. A tarefa proposta é aplicável ao modo e eficaz quanto à consequência, e o que ainda precisa ser demonstrado está declarado. Para consequência de segurança sem tarefa adequada, a resposta examina projeto ou operação em vez de passar a operar até a falha.
- **Fidelidade ao modelo.** As funções de custo, os parâmetros e a construção da duração simulada correspondem ao que os aplicativos documentam, incluindo a assimetria entre custo preventivo e corretivo no RCM e a normal com desvio de `0,1 × MTTR` por subtarefa no MTA. Divergência entre o manual e a saída do aplicativo é registrada e discutida, não contornada pela cópia do número do manual.
- **Controle experimental.** No RCM, um custo de cada vez, com MTBF, LIM, horizonte e passo preservados. No MTA, 5 000 simulações e três execuções por cenário, todas registradas na tabela.
- **Análise das evidências.** O efeito do alvo é comparado à amplitude entre execuções do mesmo alvo. Distingue-se duração determinística, média e percentil. A prioridade entre categorias de atraso considera probabilidade, número de etapas afetadas e acréscimo por ocorrência, e não só o maior acréscimo. A coluna `% of Total Variance` não é usada como prova de qual recurso domina o atraso.
- **Validade das conclusões.** A leitura permanece dentro das premissas de cada aplicativo. O intervalo económico não é tratado como demonstração de que a tarefa controla a consequência de falha; um ótimo na fronteira do horizonte não é tratado como ótimo global; um ótimo acima do LIM não é tratado como autorização para estender o intervalo; a economia anual não é citada sem a premissa de 1 000 h de voo por ano; o prazo com 90% não é tratado como critério técnico de liberação; e a saída dos aplicativos não é tratada como programa de manutenção aprovado nem como procedimento de execução.

**Níveis, em cada critério**

- **Excelente:** atendimento integral, com precisão e fundamentação.
- **Bom:** elementos essenciais atendidos, com pequenas imprecisões.
- **Satisfatório:** atendimento parcial, com lacunas relevantes.
- **Insuficiente:** omissões ou erros que comprometem o critério.

Descrição genérica de RCM ou de MTA, paráfrase do material de estudo e informação sem relação com os experimentos não acrescentam pontos. Expectativa não confirmada não tira ponto quando a interpretação é adequada; concluir que a evidência é inconclusiva é resposta válida quando os dados sustentam isso. Valores técnicos inventados — limites de pressão, desgaste, temperatura, durações ou probabilidades não observadas no aplicativo nem na documentação — comprometem o rigor.

Os pesos acima distribuem apenas a nota desta atividade; não alteram os pesos de avaliação da disciplina.
