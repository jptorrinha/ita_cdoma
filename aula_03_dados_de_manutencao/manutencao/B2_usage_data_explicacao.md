# O que mudou de B para B2 — `usage_data.csv`

| | |
|---|---|
| **Disciplina** | TE-292 — Ciência de Dados em Operação e Manutenção de Aeronaves |
| **Instituição** | Instituto Tecnológico de Aeronáutica (ITA) — AeroLogLab |
| **Professor** | Antonio Celio Pereira de Mesquita |
| **Aluno** | João Paulo Gomes de Oliveira |
| | |

## Contexto

`B_usage_data.ipynb` junta três fontes (uso, consumo de peças, falhas) numa
tabela de um ativo por linha. `B2_usage_data.ipynb` é uma revisão de
qualidade: antes de juntar, fomos checar se os dados de uso realmente
sustentavam as contas que B fazia — e não sustentavam totalmente.

Cada item abaixo segue o mesmo formato: **problema encontrado → decisão
tomada → por que importa**.

## 1. Duplicatas exatas em `usage_data.csv`

- **Problema:** 315 linhas (1,4% da fonte) eram cópias idênticas de outra
  linha — sinal de exportação ou carga duplicada.
- **Decisão:** remover com `drop_duplicates()`.
- **Por que importa:** não muda `Use_min`/`Use_max` (min/max ignora
  repetição), mas infla contagens como `n_obs` se não for tratado.

## 2. Leituras conflitantes (mesmo ativo, mesmo dia, `Use` diferente)

- **Problema:** 973 combinações `(Asset, Time)` tinham dois valores de `Use`
  diferentes — atingindo 718 ativos (38% do total). Não sabemos qual dos dois
  valores é o correto.
- **Decisão:** manter as duas leituras (não inventamos qual é certa) e
  sinalizar com uma coluna `reading_conflict`, resumida por ativo em
  `n_reading_conflicts`.
- **Por que importa:** é um sinal de qualidade que a etapa C pode usar para
  desconfiar mais de certos ativos.

## 3. Reversões de leitura (`Use` caindo no tempo)

- **Problema:** a fórmula `nb_km = Use_max − Use_min` supõe que o uso só
  cresce, como um odômetro. Encontramos 2 ativos em que uma leitura posterior
  é menor que uma leitura anterior.
- **Decisão:** diagnosticar e sinalizar (`has_use_reversal`), mas não mudar
  a fórmula — a queda é pequena (dezenas de km) e, como usamos mínimo e
  máximo globais (não soma de diferenças consecutivas), o resultado final
  não é distorcido.
- **Por que importa:** mostra que verificamos a premissa da fórmula em vez
  de assumi-la.

## 4. Agregação estava descartando informação

- **Problema:** B calculava `Use_max` só para tirar `nb_km` e depois
  descartava a coluna. Também não guardava quantas leituras sustentavam
  cada linha.
- **Decisão:** manter `Use_max`, `Time_max`, `n_obs` (nº de leituras) e
  `obs_span` (janela de observação) na tabela final.
- **Por que importa:** um ativo com 2 leituras e um com 40 leituras não
  deveriam ter a mesma confiança — agora isso é visível na tabela.

## 5. Nunca havia validação com uma fonte independente

- **Problema:** B nunca checou se `Use_min`/`nb_km` calculados batiam com
  nada externo.
- **Decisão:** comparar com `Asset_new_informations.csv`, que traz
  `Initial_km`/`nb_km` de referência para 80 ativos.
- **Evidência:** correspondência de 100% em `Use_min` e `Time_min`, e
  correlação de 1,00 em `nb_km` — ou seja, a fórmula original de B estava
  correta; a validação é uma confirmação, não uma correção.

## 6. Fonte de consumo desatualizada

- **Problema:** B juntava com a tabela de consumo antiga
  (`maintenance_part_consumption_by_reason.csv`, só a média por motivo,
  14 colunas), ignorando que a etapa A2 já produzia uma versão mais rica.
- **Decisão:** usar `maintenance_part_consumption_by_reason_v2.csv` (soma,
  média, nº de eventos e nº de peças por motivo — 56 colunas).
- **Por que importa:** mais sinal disponível para o modelo preditivo da
  etapa C.

## Resumo em uma frase

Achamos duplicatas e conflitos que B não via, confirmamos que a fórmula de
`nb_km` está certa comparando com uma fonte externa, e enriquecemos a
tabela final em vez de descartar informação e usar consumo desatualizado.

## Resultado final

- Nenhum arquivo original foi sobrescrito: as saídas novas são
  `output/usage_data_by_asset_v2.csv` e `output/asset_modelization_table_v2.csv`.
- Tabela final: 1.894 ativos × 67 colunas (vs. 15 colunas na tabela da
  versão original de B) — mais rica e com sinais explícitos de qualidade
  por ativo.
