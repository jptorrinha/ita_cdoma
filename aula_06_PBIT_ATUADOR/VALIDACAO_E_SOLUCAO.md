# PBIT do atuador: validação do diretório e solução no Orange

**Exercício considerado**: classificar o resultado de cada teste de PBIT nas 8 classes (N01, N02,
F01–F06), avaliando em **números de série não vistos no treino**. Não havia enunciado escrito na
pasta. A estrutura segue o fluxo compartilhado pelo professor (`pbit.ows`).

## Como abrir

1. (Só se os CSVs não existirem) gerar os dados:
   `/Applications/Orange.app/Contents/MacOS/python preparar_dados_orange.py`
2. Abrir **`PBIT_atuador_solucao.ows`** no Orange. Os CSVs são lidos por caminho relativo à pasta do
   fluxo.
3. Conferir os resultados nos três widgets *Test and Score* e nas Matrizes de Confusão.

Para reproduzir sem interface: `.../python executar_fluxo_orange.py`.
Para remontar o `.ows` a partir do `pbit.ows`: `.../python montar_fluxo_orange.py`.

## 1. Validação do diretório

| Item | Situação |
|---|---|
| `PBIT_atuador_DESCARAC_r1.xlsx` | Fonte oficial. Aba `DATA` **transposta**: cada coluna é um teste (1490). Linhas: classe, índice, número de série, linha vazia, 123 amostras. Aba `Falhas`: 8 classes, cujas contagens batem com a aba `DATA`. |
| Comparação com outras versões | O sinal e as classes são **idênticos** a `Orange/PBIT_atuador.xlsx` (sem número de série) e a `TE-292/PBIT_atuador_com_ns.xlsx`. A r1 só acrescenta a linha de número de série (65 séries). |
| `pbit.ows` (professor) | Usado como base e **não alterado**. Ele referencia `PBIT_orange_features.csv` e `PBIT_orange_features_4seg.csv`, que **não estavam na pasta**. |
| Pasta `Orange/` | Cópia da pasta Orange da aula 2 (exercício AI4I 2020), sem relação com o PBIT. Contém `.uso_do_orange.ows.swp.p`, um arquivo temporário de uma sessão do Orange encerrada sem salvar. Nada foi apagado. |

### Qualidade dos dados

- **248 células `#VALUE!`** (erro do Excel) em 11 testes:
  - 2 testes de F06 (931 e 949, SN 045) estão quase vazios (122 e 117 amostras inválidas) e foram
    **removidos**;
  - 9 testes têm uma única célula inválida, **interpolada** no tempo e registrada em `MissingPoints`.
- O teste 920 (F06, SN 045) tem o **sinal todo em zero**. Foi mantido, porque é coerente com "falha na
  transmissão do comando".
- **Desbalanceamento forte**: N01 = 586 testes, F06 = 7 testes depois da limpeza. N02 vem de apenas 2
  séries; F04, F05 e F06 vêm de 4 séries cada.
- **Classe confundida com a unidade**: 49 das 65 séries têm uma única classe, e o nível do sinal varia
  muito entre séries (N01 vai de ~1,8 a ~4,2). Um modelo pode aprender a reconhecer a série em vez da
  falha. Por isso a avaliação precisa separar as séries entre treino e teste.

## 2. Dados para o Orange (`preparar_dados_orange.py`)

O script gera os dois CSVs que o `pbit.ows` espera, com os **mesmos nomes de coluna** recuperados dos
contextos salvos no fluxo do professor (`FailureMode`, `SN`, …):

| Arquivo | Conteúdo |
|---|---|
| `PBIT_orange_features.csv` | 1488 testes × 23 colunas: 15 estatísticas globais (`Mean`, `Std`, `Min`, `Max`, `Range`, `Median`, `Q25`, `Q75`, `IQR`, `RMS`, `FirstValue`, `LastValue`, `Delta`, `Slope`, `Area`) |
| `PBIT_orange_features_4seg.csv` | 1488 testes × 45 colunas: 8 estatísticas em cada segmento (`ExtInicio`, `ExtFim`, `ConInicio`, `ConFim`) + `Ext_Mean`, `Con_Mean`, `ExtCon_MeanDiff` (os 35 atributos usados) |

**Suposições**, porque a regra exata do professor não está no `.ows`:
- os quatro segmentos são blocos consecutivos de cerca de 31 amostras; os dois primeiros formam a
  extensão e os dois últimos a contração;
- `SeverityIndex` não pode ser reconstruído e foi omitido; ele não é usado como atributo no fluxo do
  professor.

## 3. Fluxo `PBIT_atuador_solucao.ows`

Derivado do `pbit.ows`, mantendo os 15 widgets e scripts do professor:

`CSV Import (4seg) → Select Columns (35 atributos; classe FailureMode; meta SN) → Split train test`
`(divisão 70/30 agrupada por SN) → Bootstrap (só no treino) → Random Forest → Test and Score`
`(Test on test data) → Matriz de Confusão, ROC, Rank`

Alterações em relação ao fluxo do professor:
1. contextos dos dois *Select Columns* refeitos para o esquema dos nossos CSVs;
2. caminhos absolutos `C:/Users/celio/...` removidos dos importadores, ficando só o caminho relativo;
3. **acrescentados**: *Test and Score* com validação cruzada de 10 folds **aleatória**, *Test and Score*
   com validação **agrupada por SN** (uma série fora por fold), uma Matriz de Confusão e uma anotação
   explicando a comparação.

O ramo **SMOTE** do professor exige o pacote `imblearn`, que não vem no Orange do macOS, e o script
dele aponta para uma pasta do Windows. Esse ramo dá erro, mas não alimenta nenhum outro widget.

## 4. Resultados (Random Forest do professor: 200 árvores, `min_samples_split` = 5, semente fixa)

| Avaliação | Testes avaliados | CA | F1 macro | Acurácia balanceada |
|---|---|---|---|---|
| Hold-out 70/30 **agrupado por SN** (fluxo do professor) | 421 | **0,596** | 0,521 | 0,546 |
| Validação cruzada 10-fold **aleatória** | 1488 | 0,861 | 0,683 | 0,642 |
| Validação cruzada **agrupada por SN** (65 folds) | 1488 | 0,517 | 0,325 | 0,304 |
| Referência: prever sempre N01 | — | ≈0,40 | — | 0,125 |

Recall por classe no hold-out por SN: F01 0,98 · F02 0,34 · F03 0,44 · F04 0,44 · F05 0,40 ·
F06 1,00 (1 teste) · N01 0,77 · N02 0,00.

### Leitura

- **A validação aleatória é otimista**: 0,86 contra 0,52–0,60 quando a série inteira fica fora do
  treino. A diferença vem de testes da mesma série aparecerem no treino e no teste. É por isso que a
  r1 traz o número de série e que o fluxo do professor divide por `SN`.
- **Em séries novas o modelo supera a referência**, mas está longe de ser confiável para as 8
  classes. F01 é bem reconhecida. **F02 se confunde com N01**: 64 dos 99 testes F02 do hold-out foram
  classificados como normais, o que é o pior erro para manutenção, porque é uma falha não detectada.
  N02 nunca é acertada: só existem 2 séries dela.
- **O hold-out é uma única divisão**, escolhida entre 2000 por ter a melhor estratificação. A
  validação agrupada por SN usa todas as séries e dá um número mais pessimista (CA 0,52). Os dois
  devem ser relatados juntos.
- **Oversampling** (Bootstrap) só repete testes das mesmas séries. Ele equilibra a contagem, mas não
  cria variedade de unidades, que é o que falta para generalizar.

## 5. Limitações e próximos passos

- Classes raras com 2–4 séries: nenhuma validação consegue estimar bem o desempenho em N02, F04, F05
  e F06.
- Segmentação extensão/contração suposta; com a regra real do professor, os atributos segmentados
  podem mudar.
- Próximos passos possíveis:
  - **normalizar o sinal pelo nível de referência de cada série** (por exemplo, pelos testes N01 da
    própria unidade), quando houver;
  - avaliar um alvo binário **normal vs. falha** (nos testes exploratórios, acurácia balanceada de
    ~0,63 com validação agrupada por SN);
  - instalar `imbalanced-learn` no Orange para comparar SMOTE com Bootstrap.
