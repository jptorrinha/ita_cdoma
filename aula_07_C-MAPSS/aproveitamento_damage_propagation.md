# Aproveitamento de Damage Propagation Modeling — aula de 7/10/2026

Fonte principal: Saxena, Goebel, Simon e Eklund (2008), `data/Damage Propagation Modeling.pdf`, nove páginas. As páginas e figuras citadas abaixo pertencem a essa cópia local. A versão disponível no [repositório da NASA](https://ntrs.nasa.gov/api/citations/20090029214/downloads/20090029214.pdf) tem diferenças de título, diagramação e numeração de algumas figuras.

Comparação feita com `apresentacao/cmapss_slides.tex` e a versão inicial do PDF, de 30 páginas. Recomendo quatro blocos, com aproximadamente 13 minutos de exposição. Eles explicam a origem dos dados e o significado do alvo antes de aprofundar a previsão e a decisão.

## Seleção para a apresentação

| Material do artigo | Inserção na aula atual | O que acrescenta | Tempo |
|---|---|---|---:|
| Seções IV.D, V.B e V.C, pp. 4–6; tabelas 1–2, p. 3 | Depois de “Origem e propósito”, página 4 | Um esquema de como desgaste, condições de operação, simulador e ruído produzem as leituras. Distinguir grandezas ocultas dos dados disponíveis. | 3 min |
| Seção V.D, pp. 6–7; figura 8, p. 7 | Antes de “Estrutura dos arquivos”, página 6 | Explicar o critério que encerra a trajetória e define o ciclo de falha usado no rótulo de RUL. | 4 min |
| Seção V e figura 5, p. 5 | Depois de “Como a degradação aparece nos sensores”, página 8 | Mostrar que os parâmetros de desempenho têm oscilações locais mesmo durante uma tendência de degradação. | 2 min |
| Seção VII, pp. 7–8; figura 10, p. 8 | Antes da explicação da margem de segurança e da regra de decisão, página 15 | Mostrar por que erros de igual magnitude podem ter consequências diferentes. | 4 min |

## 1. Como o desgaste vira dados

Texto para o slide:

> Cada motor começa com uma condição inicial diferente. O simulador impõe uma trajetória de alteração da eficiência e da capacidade de vazão. A resposta do motor, sob determinadas condições de operação e com seu controle atuando, gera as leituras disponíveis para o modelo de prognóstico.

Esquema sugerido, redesenhado em português:

```text
Condição inicial + trajetória de degradação + ruído de processo
                              ↓
Condições de operação → Simulador do motor e seu controle
                              ↓
                  Leituras + ruído de medição
                              ↓
              Dados observados em cada ciclo
```

Acrescentar ao lado um quadro curto:

- **Disponível:** ciclo, ajustes operacionais e 21 canais de medição.
- **Oculto nos arquivos do desafio:** parâmetros internos de eficiência e vazão e margens usadas para calcular o índice de saúde.

Nota para o professor: o artigo descreve uma observação por voo, obtida em condição de cruzeiro após a resposta atingir regime estacionário. Cada linha representa esse registro; o conjunto não contém toda a evolução das medições durante decolagem, subida e pouso. A tendência exponencial é uma hipótese de geração dos parâmetros internos. Os sinais observados também refletem operação, controle e ruído.

Evitar a notação `H` para o índice de saúde do simulador: a aula já usa `H` para a margem subtraída da RUL. Se precisar de um símbolo, usar `I_sim`.

## 2. O que encerra a vida do motor no conjunto?

Texto para o slide:

> O simulador acompanha a distância até limites operacionais. O índice de saúde é a menor das margens normalizadas. A trajetória termina quando uma delas atinge o limite definido para o experimento. Esse instante fornece o ciclo de falha usado para calcular a RUL.

\[
I_{\mathrm{sim}}(t)=\min_j m_j(t),
\qquad
T=\text{primeiro ciclo em que }I_{\mathrm{sim}}(t)\leq 0.
\]

No artigo, as margens relevantes incluem temperatura de gases de escape e margem de estol do fan e dos compressores. A normalização expressa a distância aos limites adotados na geração; os valores desses limites pertencem ao cenário simulado.

**Visual:** usar a figura 8, página 7, com três trajetórias e a região de falha. Traduzir os eixos como “perda de eficiência” e “perda de capacidade de vazão”; identificar a temperatura de gases de escape na escala de cores e destacar a fronteira da região. Explicar os eixos antes de discutir as trajetórias. A leitura pretendida é: motores podem percorrer caminhos diferentes até atingir um limite.

Nota para o professor: o evento final é a violação do critério operacional definido pelo simulador. O conjunto não demonstra uma sequência até ruptura física catastrófica. Essa distinção dá significado à falha funcional usada na curva P–F e aos rótulos `RUL(t)=T−t`.

A tabela 2, página 3, também permite uma distinção útil: a EGT usada no cálculo interno é identificada como T48, na saída da HPT. O sensor T50 disponível no conjunto corresponde à saída da LPT. Apresentar essas medições com seus nomes e locais específicos.

## 3. Uma melhora momentânea pode ocorrer durante a degradação

Texto para o slide:

> A tendência de desgaste convive com oscilações locais. Uma melhora em um ciclo pode refletir ruído de processo ou variação operacional. Para detectar degradação, precisamos examinar a sequência de observações.

**Visual:** figura 5, página 5, intitulada como variação do parâmetro de eficiência de um motor. O gráfico representa um parâmetro interno simulado, e não uma leitura de sensor disponível aos participantes. Manter essa identificação na legenda.

Nota para o professor: o artigo representa de forma simplificada os efeitos de manutenção entre voos como parte do ruído de processo, permitindo melhoras locais. Isso não constitui um histórico explícito de intervenções, trocas de módulo ou restaurações de idade. A figura ajuda a explicar o uso de suavização, mas não determina o tamanho da janela escolhido na aula. Uma janela maior também pode atrasar a detecção.

## 4. Erros iguais podem levar a decisões diferentes

Texto para o slide:

> Imagine um motor com 20 ciclos de vida remanescente. Prever 15 ou 25 ciclos produz o mesmo erro absoluto de 5 ciclos. A previsão de 25 oferece ao planejador um tempo que o motor não tem. A previsão de 15 antecipa a intervenção e pode desperdiçar vida útil.

**Visual:** figura 10, página 8, com a função assimétrica simplificada. Ela permite mostrar diretamente que a penalidade ilustrativa para superestimar em cinco ciclos é maior que a penalidade para subestimar em cinco ciclos. Traduzir “Prediction Error” por “erro: RUL prevista − RUL verdadeira” e “Score” por “penalidade ilustrativa”.

Nota para o professor: conectar o lado positivo do erro à motivação da margem de segurança e, depois, à necessidade de considerar o tempo logístico `L`. A penalidade do desafio expressa uma preferência entre erros. O custo por ciclo da aula avalia a política de remoção, considerando consequências e vida aproveitada; um score de prognóstico não substitui essa avaliação.

## Complementos curtos

- **Figura 1, p. 2:** fornece o diagrama do motor já recomendado a partir do slide 13 de Amanda. É o mesmo esquema; escolher uma única reprodução e atribuir ao artigo, que remete ao manual do simulador.
- **Tabela 2, p. 3:** acrescentar unidades à tabela de sensores da aula, ou a uma versão de consulta. Temperaturas em °R (Rankine), pressões em psia e rotações em rpm evitam interpretar números como 1.400 em graus Celsius.
- **Figura 6, p. 6:** opcional para explicar por que a condição operacional altera as margens. Usar um painel, como o de temperatura, e conectar aos seis regimes de FD002/FD004. Para uma aula concentrada em FD001/FD003, cabe como preparação para extensão futura.
- **Seção VI, p. 7:** reforçar a distinção entre trajetórias completas de treino e trajetórias interrompidas de teste. Na avaliação com os arquivos locais de RUL, o ciclo final verdadeiro pode ser reconstruído como último ciclo observado mais RUL final. O que permanece ausente é a continuação das leituras, necessária para acompanhar decisões posteriores à interrupção. Isso qualifica a frase atual “o teste oficial [...] não mostra se o planejamento foi perdido”.

## Cuidados com a transposição

1. **Escopo do artigo.** A descrição do desafio original trata de degradação do HPC sob seis condições operacionais. A tabela de FD001–FD004 da aula descreve a coleção disponível na pasta, incluindo o fan em FD003/FD004. Identificar o cenário ao reproduzir resultados do artigo.
2. **Equações e figuras.** A cópia local contém inconsistências internas. Na equação 8, aparece HPT onde a tabela 2 e a descrição posterior das margens indicam LPC. Na equação 11, os valores declarados de `a1=10` e `a2=13`, combinados com os ramos da fórmula, penalizam mais o erro negativo, contrariando o texto e a figura 9. Para a aula, usar a explicação das margens da seção V.D e a figura 10 de penalidade simplificada; conferir a convenção antes de transcrever uma fórmula numérica de score.
3. **Limites operacionais.** Os valores empregados para gerar o benchmark não são recomendações de remoção nem limites certificados para a frota do operador.

As equações de Arrhenius, Coffin–Manson e Eyring, página 4, e as superfícies tridimensionais das figuras 3–4 podem ficar como leitura complementar. Para esta aula, o fluxo de geração, a definição de falha e o contraste entre erros têm ligação mais direta com os dados e a decisão de manutenção.

Integração realizada em 6/10/2026: os quatro blocos foram incorporados ao fonte e ao PDF, inicialmente com 39 páginas. A revisão para alunos não engenheiros ampliou a apresentação para 52 páginas, com explicações antes das fórmulas. As figuras 5 e 8 receberam rótulos em português, preservando curvas, trajetórias e valores. A função de penalidade da figura 10 foi redesenhada como exemplo didático. O diagrama do motor, as unidades dos sensores e a explicação do teste truncado também foram incorporados. A geração das figuras está registrada em `apresentacao/preparar_figuras_fontes.py`.
