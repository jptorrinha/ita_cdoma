# Aula 1 — Introducao, panorama e ambiente de trabalho

**Complexidade:** 4/20 (a mais baixa da disciplina)

## Tema

Escopo da TE-292, papel da ciencia de dados na operacao e manutencao de aeronaves e primeiro contato pratico com analise de dados.

## Objetivos de aprendizagem

- Compreender o escopo, a metodologia e os criterios de avaliacao da disciplina.
- Situar o papel da ciencia de dados em operacao e manutencao aeronautica.
- Reconhecer o arco da disciplina: dado bruto para modelo para decisao.
- Identificar, a partir de um caso concreto, quando aprendizado de maquina e necessario e quando nao e.

## Dinamica (2 x 80 min)

- **Tempo 1:** apresentacao da disciplina, criterios de avaliacao e panorama de aplicacoes de ciencia de dados em manutencao aeronautica.
- **Tempo 2:** exemplo pratico guiado com o notebook `aula_01A_analise_dados.ipynb`.

## Tempo 2 — roteiro do notebook

**Premissa:** nenhum modelo e treinado nesta aula. O notebook e inteiramente de analise de dados.
A base `ai4i2020` serve como veiculo para mostrar o que e um problema de manutencao preditiva,
sem entrar em pipeline de ML.

**Fio condutor:** quanto de um problema de manutencao preditiva se resolve *antes* de recorrer a
aprendizado de maquina?

| Bloco | Conteudo | Minutos |
|---|---|---:|
| 1 | Leitura da base; o que e uma linha; granularidade | 10 |
| 2 | Variaveis de processo; estado instantaneo versus dano acumulado | 10 |
| 3 | Evento raro: 3,39% de falha; por que acuracia engana | 10 |
| 4 | Cinco modos de falha; inconsistencia no rotulo | 15 |
| 5 | Construcao da variavel potencia; regra exata para PWF | 20 |
| 6 | HDF e OSF pelo mesmo raciocinio | 10 |
| 7 | TWF: onde a regra falha e o ML se justifica | 5 |

### Os tres momentos de parada

O notebook tem tres pontos marcados para discussao, e o efeito depende de **nao adiantar o
resultado**:

1. **Acuracia de 96,61%.** Responder sempre "nao vai falhar" acerta 96,61% das vezes e nao serve
   para nada. Deixe o desconforto assentar antes de explicar.
2. **373 diferente de 339.** A soma dos modos de falha nao bate com o total. Peca hipoteses antes
   de rodar a celula seguinte. Sao tres causas simultaneas: modos sobrepostos, 9 falhas sem modo
   marcado e 18 `RNF` fora do rotulo principal.
3. **A tabela cruzada da potencia.** Diagonal perfeita, 95 de 95. E o momento central da aula.

### O resultado que sustenta a aula

Tres dos cinco modos de falha sao **regras deterministicas exatas**, descobertas apenas com
analise e fisica elementar:

| Modo | Regra | Acerto |
|---|---|---|
| `PWF` | potencia fora de [3500, 9000] W | 95/95 |
| `HDF` | Delta T < 8,6 K e rotacao < 1380 rpm | 115/115 |
| `OSF` | desgaste x torque > limiar do `Type` | 98/98 |

Juntas cobrem **287 das 339 falhas (85%)** sem nenhum modelo.

O contraste vem de `TWF`: a regra `desgaste >= 198 min` seleciona 894 registros para capturar
46 falhas — 5,1% de acerto. Desgaste alto e condicao necessaria, nao suficiente. **E ai que o
aprendizado de maquina se justifica**, e nao na redescoberta da formula da potencia.

Fecho da aula: um modelo que nao supera uma regra de tres linhas nao deveria ir para producao.

## Materiais

- `aula_01A_analise_dados.ipynb` — notebook do Tempo 2, executavel de ponta a ponta.
- `aula_01B_modelo_preditivo.ipynb` — notebook complementar para retomar o mesmo caso com
  classificacao supervisionada, matriz de confusao e metricas de erro em contexto critico.
- `aula_01C_uso_do_orange.ows` — workflow Orange Data Mining sobre a mesma base.
- Dados: `../aula_09_modelos_preditivos_i/ai4i2020/ai4i2020.csv` (o notebook resolve o caminho
  automaticamente; nao ha copia duplicada do arquivo).

### Requisitos

`pandas`, `numpy` e `matplotlib`. Validado com pandas 3.0.5 e matplotlib 3.11.1.

Se preferir distribuir o notebook isolado aos alunos, copie o `ai4i2020.csv` para o lado dele —
a primeira celula ja procura o arquivo no diretorio corrente antes de tentar o caminho relativo.

### Observacao sobre a base

`ai4i2020` e semissintetica: zero faltantes, zero duplicatas, identificadores unicos. Isso e
deliberadamente conveniente para a aula 1, e o notebook diz isso ao aluno de forma explicita,
para nao criar a expectativa errada sobre dados reais. O contraponto vem na aula 5, com o
conjunto `E2`.

Escolheu-se uma maquina industrial, e nao uma aeronave, por ser uma base pequena, publica e bem
documentada. A estrutura do problema — sensores, degradacao, modos de falha, evento raro — e a
mesma que reaparece no C-MAPSS a partir da aula 7.

## Ligacoes com o restante da disciplina

O notebook planta, em nivel intuitivo, temas que serao retomados com rigor:

| Tema plantado | Retomado na aula |
|---|---:|
| Politica de manutencao por tipo de falha | 2 |
| Origem e integracao dos dados | 3 |
| Dados que nao chegam limpos | 5 |
| Analise exploratoria com metodo | 6 |
| Dano acumulado e RUL | 7-8 |
| Construcao de variaveis (potencia) | 8 |
| Modelos, com a regra como linha de base | 9-10 |
| Por que acuracia engana em evento raro | 11 |

## Arquivos esperados futuramente

- slides introdutorios
- guia de instalacao do ambiente
- gabarito do exercicio para casa
