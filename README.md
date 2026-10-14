# ita_cdoma

Trabalhos práticos da disciplina **TE-292 — Ciência de Dados em Operação e Manutenção de Aeronaves**,
do Instituto Tecnológico de Aeronáutica (ITA).

| | |
|---|---|
| **Disciplina** | TE-292 — Ciência de Dados em Operação e Manutenção de Aeronaves |
| **Instituição** | Instituto Tecnológico de Aeronáutica (ITA) — AeroLogLab |
| **Professor** | Antonio Celio Pereira de Mesquita |
| **Aluno** | João Paulo Gomes de Oliveira |

O repositório reúne, aula a aula, notebooks, fluxos do Orange, scripts e relatórios. O fio condutor da
disciplina é ir do **dado bruto** ao **modelo** e à **decisão de manutenção**: preditiva, de estoque, de
remoção e de programação de tarefas.

## Conteúdo por aula

| Pasta | Tema | Principais arquivos |
|---|---|---|
| [aula_01_introducao_panorama](aula_01_introducao_panorama/) | Panorama da disciplina e análise exploratória da base AI4I 2020 (manutenção preditiva) | `aula_01A_analise_dados.ipynb`, `aula_01B_modelo_preditivo.ipynb`, fluxos `.ows`, [README](aula_01_introducao_panorama/README.md) |
| [aula_02_modelos_preditivos](aula_02_modelos_preditivos/) | Primeiro classificador supervisionado de falhas (LightGBM) com regra de decisão GO / NO-GO | `modelo_preditivo.ipynb`, `predict_offline.py`, `model/`, dashboards HTML, fluxos Orange |
| [aula_03_dados_de_manutencao](aula_03_dados_de_manutencao/) | Integração de dados de manutenção: consumo de peças, uso e falhas em uma tabela por ativo | `manutencao/A*`, `B*`, `C*` (notebooks e `.ows`), `B2_usage_data_explicacao.md` |
| [aula_04_METRIC](aula_04_METRIC/) | Otimização de estoque de sobressalentes com METRIC / VARI-METRIC (dois escalões) e laboratório Poisson × binomial negativa | `metric.py`, `parts*.toml`, `poisson_neg_binom/index.html`, [README](aula_04_METRIC/README.md) |
| [aula_05_xai_confianca](aula_05_xai_confianca/) | XAI e confiança: triagem de anomalias em decolagens (PCA + DBSCAN), com explicação exata do score e análise de estabilidade | `decolagem_deteccao_anomalias_modified.ipynb` (o original é mantido ao lado) |
| [aula_06_PBIT_ATUADOR](aula_06_PBIT_ATUADOR/) | Classificação de modos de falha do PBIT de um atuador no Orange, com validação agrupada por número de série | `PBIT_atuador_solucao.ows`, `preparar_dados_orange.py`, [VALIDACAO_E_SOLUCAO.md](aula_06_PBIT_ATUADOR/VALIDACAO_E_SOLUCAO.md) |
| [aula_07_C-MAPSS](aula_07_C-MAPSS/) | C-MAPSS FD001: remoção por idade × regra baseada no sensor T50, custo por ciclo e tempo logístico | `tarefa_fd001.ipynb`, `relato_fd001.pdf`, [RESUMO_TAREFA_FD001.md](aula_07_C-MAPSS/RESUMO_TAREFA_FD001.md) |
| [aula_09_mta_rcm](aula_09_mta_rcm/) | RCM (seleção da tarefa e intervalo econômico) e MTA (ficha da tarefa e distribuição da duração) | `Oliveira_Joao_aula_09.pdf`, `executar_experimentos.py`, `execucoes/` |

[RESUMO_TRABALHO.md](RESUMO_TRABALHO.md) detalha as correções e decisões das aulas 1 e 2.

## Destaques metodológicos

Algumas escolhas se repetem ao longo dos trabalhos:

- **Separação por unidade, não por linha.** Quando há várias observações por motor, atuador ou série, treino
  e avaliação separam a unidade inteira. Na aula 6, a validação aleatória dava acurácia de 0,86, contra
  0,52–0,60 com a separação por número de série.
- **Escolha só nos dados de desenvolvimento.** Parâmetros e limiares são escolhidos em um grupo e aplicados
  uma única vez ao grupo reservado (aula 7).
- **Incerteza junto do resultado.** Bootstrap, repetição de execuções e comparação com referências simples
  (classe majoritária, remoção por idade) acompanham os números principais.
- **Rastreabilidade.** As execuções de aplicativos externos são gravadas com parâmetros e horário (aula 9),
  e divergências entre documentação e saída são registradas, não contornadas.

## Ambiente

**Python** (testado com 3.14, no ambiente virtual `.venv`, que não é versionado):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install pandas numpy scipy scikit-learn lightgbm matplotlib seaborn jupyter
```

**Orange Data Mining** 3.40 ou superior, para os fluxos `.ows` (aulas 1, 2, 3 e 6). Os scripts
`*_orange.py` da aula 6 rodam com o Python que acompanha o Orange, que já traz `openpyxl`:

```bash
/Applications/Orange.app/Contents/MacOS/python aula_06_PBIT_ATUADOR/preparar_dados_orange.py
```

**LaTeX** (`latexmk` + `pdflatex`), para recompilar os relatórios das aulas 7 e 9.

O laboratório `aula_04_METRIC/poisson_neg_binom` abre direto no navegador, sem instalação.

## Como reproduzir

| Aula | Comando (a partir da pasta da aula) |
|---|---|
| 2 | `python predict_offline.py` (demo com dados de exemplo) |
| 5 | `jupyter nbconvert --to notebook --execute decolagem_deteccao_anomalias_modified.ipynb` |
| 6 | Rodar `preparar_dados_orange.py` e abrir `PBIT_atuador_solucao.ows` no Orange |
| 7 | `jupyter nbconvert --to notebook --execute --inplace tarefa_fd001.ipynb` e `latexmk -pdf relato_fd001.tex` |
| 9 | `python3 executar_experimentos.py rcm` e `python3 executar_experimentos.py mta` (exigem acesso à internet) |

## Dados

Os conjuntos de dados acompanham cada aula:

| Aula | Conjunto | Natureza |
|---|---|---|
| 1 e 2 | AI4I 2020 | Público, sintético |
| 3 | Dados de manutenção, uso e consumo de peças | Material da aula |
| 5 | Decolagens | Anonimizado |
| 6 | PBIT do atuador | Descaracterizado |
| 7 | C-MAPSS FD001 (NASA) | Público, simulado |

Os resultados valem para esses dados e premissas. Eles não constituem programa de manutenção aprovado,
procedimento de execução nem limite técnico certificado.

## Uso acadêmico

Material produzido para fins didáticos na TE-292. Artigos, slides e livros incluídos como leitura de
apoio pertencem aos respectivos autores e editoras.
