# Tarefa FD001: o que foi feito

Este arquivo resume a solução da atividade individual da aula 7 (TE-292), cujo enunciado está em
[tarefa_fd001.md](tarefa_fd001.md):

> Uma regra baseada em sensores consegue aproveitar melhor a vida do motor do que uma remoção por idade?

**Resposta curta:** sim, mas de forma modesta e ainda não conclusiva. Nos 30 motores reservados, a regra
com o sensor T50 reduziu o custo por ciclo em **5,7%**, sem nenhum motor com planejamento perdido. O
intervalo de confiança da diferença, porém, inclui "nenhuma melhora".

## Arquivos produzidos

| Arquivo | O que é |
|---|---|
| [relato_fd001.pdf](relato_fd001.pdf) | Relato de 2 páginas para entrega |
| [relato_fd001.tex](relato_fd001.tex) | Fonte LaTeX do relato |
| [tarefa_fd001.ipynb](tarefa_fd001.ipynb) | Notebook que reproduz todos os cálculos (executado, sem erros) |
| [figuras/motor_exemplo.png](figuras/motor_exemplo.png) | Gráfico exigido: motor 9 com aviso, remoção e falha |
| [figuras/decisoes_avaliacao.png](figuras/decisoes_avaliacao.png) | Onde cada regra programou a remoção nos 30 motores |

Nenhum arquivo da aula foi alterado: dados, slides, defesa da Amanda e os dois `aproveitamento_*.md`.

## 1. Protocolo seguido

- **Dados:** somente `data/train_FD001.txt` (100 motores simulados até a falha, 20 631 linhas, sem
  valores ausentes). Os arquivos de teste oficiais ficaram de fora, como pede o enunciado.
- **Divisão:** sorteio com semente 42, exatamente com o código do enunciado. São **70 motores para
  desenvolvimento** e **30 reservados** para a avaliação final, com todos os ciclos de cada motor no
  mesmo grupo. O notebook confere que os grupos não se sobrepõem.
- **Parâmetros comuns:** tempo logístico L = 20 ciclos, custo planejado cp = 1, custo após falha cf = 50.
- **Desfecho:** remoção até o ciclo de falha T (inclusive) é planejada (custo 1; ciclos aproveitados =
  ciclo da remoção). Remoção depois de T, ou ausência de aviso, é planejamento perdido (custo 50;
  ciclos aproveitados = T). **Custo por ciclo = soma dos custos ÷ soma dos ciclos aproveitados.**
- **Sem olhar o futuro:** o aviso usa apenas leituras até o ciclo atual. T só é usado para conferir o
  desfecho.

## 2. As duas regras

**Remoção por idade.** A idade `a` é a menor vida entre os 70 motores de desenvolvimento: **128
ciclos**. Todos os motores recebem aviso no ciclo 108 e remoção no 128.

**Regra com sensor (T50 = sensor 4, coluna 9 do arquivo).** Seguindo o caminho sugerido no enunciado:

1. linha de base = média de T50 nos ciclos 1–15 de cada motor;
2. a partir do ciclo 16, média móvel das 15 leituras mais recentes;
3. aviso único quando a média móvel supera a linha de base em p%; remoção 20 ciclos depois.

O percentual p foi escolhido **só nos 70 motores de desenvolvimento**, pelo menor custo por ciclo:

| Regra (70 motores) | Perdidos | Vida desperdiçada média | Custo por ciclo |
|---|---|---|---|
| T50, p = 0,20% | 0 | 100,9 | 0,00953 |
| **T50, p = 0,35% (escolhida)** | **0** | **68,3** | **0,00727** |
| T50, p = 0,50% | 1 | 43,6 | 0,01044 |
| Idade, a = 128 | 0 | 77,8 | 0,00781 |

Com 0,20% o aviso sai cedo demais. Com 0,50% desperdiça-se menos vida, mas **um único motor perdido**
(custo 50) torna essa opção a pior.

## 3. Resultado nos 30 motores reservados

As duas regras, já fixadas, foram aplicadas **uma única vez**:

| Regra | Planejamento perdido / 30 | Vida desperdiçada média (só remoções planejadas) | Custo por ciclo |
|---|---|---|---|
| Remoção por idade (a = 128) | 0 / 30 | 79,5 ciclos | 0,00781 |
| Regra com sensor (T50, +0,35%) | 0 / 30 | 71,7 ciclos | **0,00737** |

Outros números do notebook:

- **Vida aproveitada:** em média 135,8 ciclos por motor com o sensor, contra 128 com a idade.
- **Quem remove mais tarde:** o sensor programa a remoção depois da idade em 17 dos 30 motores.
- **Folga até a falha:** a menor folga com o sensor foi de 28 ciclos (motor 65).
- **Bootstrap pareado** (5000 reamostras dos 30 motores): a razão entre os custos (sensor ÷ idade) é
  0,94, com intervalo de 95% de **0,88 a 1,02**. O sensor sai mais barato em 94% das reamostras, mas o
  intervalo inclui 1.
- **Personalização parcial:** a correlação entre o ciclo de remoção pelo sensor e a vida real é de
  apenas r = 0,58. O motor 7, por exemplo, dura 259 ciclos e é removido no ciclo 100, porque o ruído faz
  a média móvel cruzar o limite cedo.

## 4. Como os materiais da aula foram usados

A pedido, a solução foi complementada com os artefatos da pasta.

**Slides da aula** (`apresentacao/cmapss_slides.pdf`, prof. Mesquita):

- **Curva P–F:** o aviso marca o ponto P detectado e a falha marca o ponto F. A remoção chega a tempo
  se e somente se `T − aviso ≥ L`.
- **Explicação para a perda com 0,50%:** nos 70 motores, essa regra dá um intervalo P–F mediano de 57
  ciclos e mínimo de 19, abaixo de L = 20. A aula reporta 54 e 22 para a mesma regra.
- **Custo por ciclo:** justificado pelo teorema da renovação com recompensa.
- **A comparação é justa:** uma varredura nos 70 motores mostra que **128 também é a idade de menor
  custo**, como na aula. A referência do enunciado já é a melhor política por idade possível.

**Defesa da Amanda** (`slides_defesa_ITA_Amanda.pptx`, slide 16): a regra sugerida no enunciado é o
detector do ponto P que ela usou em T50 (linha de base de 15 ciclos, média móvel de 15, ±0,5%). Como o
T50 sobe com a degradação, usamos só o limite superior.

**Artigo de Saxena et al. (2008)** (`data/Damage Propagation Modeling.pdf`):

- **Seção V.A:** cada motor tem desgaste inicial diferente, o que justifica a linha de base por motor.
- **Seção V.B:** o ruído mascara a degradação, o que explica os avisos precoces.
- **Seção VII:** a penalidade é maior para o erro tardio, a mesma assimetria de cf/cp = 50.

## 5. Próxima pergunta de pesquisa

A ideia inicial era um limite ajustado ao ruído de cada motor, o "limiar estatístico" da aula. Testada
**só nos 70 motores de desenvolvimento**, com T50 isolado, ela **não superou** a regra de 0,35% (custo
0,00787 com k = 4). O desvio-padrão estimado com só 15 leituras também é ruidoso.

Já combinar **T50 com Ps30** (pressão na saída do compressor, sensor 11), pela média dos desvios
relativos, chegou a custo 0,0064, sem perdas e com r = 0,90. Esse número foi medido nos mesmos motores
usados para escolher o limite, então é otimista (o "otimismo de seleção" da aula).

**Pergunta proposta:** combinar T50 e Ps30, escolher o limite por validação cruzada interna nos 70
motores e aplicar uma única vez aos mesmos 30 reservados. A mudança terá ajudado se, nesses 30
motores:

- a correlação entre remoção e vida real passar de 0,58;
- o custo por ciclo ficar abaixo de 0,00737, com o intervalo do bootstrap abaixo de 1;
- o número de planejamentos perdidos não aumentar.

## 6. Limitação e ponto de transparência

- **Limitação principal:** a escolha de 0,35% foi decidida por **um único motor** no desenvolvimento. Com
  cf = 50, uma remoção tardia inverte o resultado, e com 30 motores a incerteza do custo é da mesma ordem
  que a diferença encontrada. A referência por idade também depende do mínimo amostral das 70 vidas.
- **Transparência:** num teste exploratório, antes de montar o notebook, as três porcentagens foram
  calculadas também nos 30 motores reservados, por engano. Isso não influenciou a escolha, que segue a
  regra mecânica do enunciado (menor custo nos 70 de desenvolvimento). O notebook entregue aplica só a
  porcentagem escolhida, uma única vez, aos 30 motores.

## Como reproduzir

Na pasta `aula_07_C-MAPSS`, com o ambiente `.venv` do projeto:

```bash
../.venv/bin/jupyter nbconvert --to notebook --execute --inplace tarefa_fd001.ipynb
latexmk -pdf relato_fd001.tex && latexmk -c relato_fd001.tex
```

O notebook regrava as figuras em `figuras/`, que o relato inclui.
