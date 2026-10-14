# Resumo do trabalho — TE-292, aulas 1 e 2

Este documento explica, em ordem, tudo que foi feito nos notebooks e arquivos do projeto durante
esta sessão. Serve como guia de orientação — não substitui os notebooks, só ajuda a navegar neles.

---

## Aula 1 — `aula_01_introducao_panorama/aula_01A_analise_dados.ipynb`

### Bug corrigido
Na seção 6 ("Onde a análise para de funcionar"), a célula que calculava quantos registros de alto
desgaste realmente falharam somava a coluna errada:

```python
# antes (errado): somava os minutos de desgaste
high_wear['tool_wear_min'].sum()
# depois (certo): soma a flag de falha (0/1)
high_wear['tool_wear_f'].sum()
```

Isso produzia uma "proporção" de 21.012,6% (impossível). Corrigido para bater com o texto da aula:
894 registros com desgaste ≥ 198 min, dos quais 46 realmente falham (5,1%).

### Exercício para casa — resolvido dentro do notebook
Adicionadas células de código + explicação markdown respondendo às três perguntas do exercício:

1. **9 registros com falha e nenhum modo marcado** → recomendação: manter, com rótulo de "causa não
   classificada" (não descartar nem forçar um modo sem sustentação nos dados).
2. **18 registros com `random_f=1` e `failures=0`** → depende do propósito: excluir faz sentido para
   modelagem preditiva, mas subestima a taxa real de parada se o objetivo for confiabilidade.
3. **A regra de potência aponta algum caso fora do rótulo `failures`?** → não: os 95 casos de
   `power_rule` batem 100% com `power_f` e com `failures`. Investigado com código, não suposição.

---

## Aula 2 — `aula_02_modelos_preditivos/`

### 0. Entrega da tarefa (professor)
O topo do `modelo_preditivo.ipynb` agora identifica o autor:

> **Aluno:** João Paulo Gomes de Oliveira

**Pendente, e não automatizável por aqui:** enviar o notebook individualmente para
`celio@ita.br` até **26/08**. Isso precisa ser feito manualmente, da sua própria conta de e-mail.

### 1. Bugs corrigidos no `modelo_preditivo.ipynb`

| # | Bug | Sintoma | Correção |
|---|---|---|---|
| 1 | Caminho do CSV quebrado | `FileNotFoundError` | Aponta para `ai4i2020.csv` (adicionado na própria pasta) |
| 2 | Variável `columns` nunca definida | `NameError` numa execução limpa | Reatribuída antes do uso |
| 3 | Cap de outliers apagava sinal de falha | Recall caía sem explicação aparente | Documentado e testado (ver seção 3 abaixo) |

### 2. `CONFUSION_MATRIX_GUIDE.md` — anomalia encontrada
Há um bloco `{"role":"mechanic"}` solto no meio do texto (linhas 15–19), sem relação com o conteúdo
ao redor — tem cara de instrução injetada. Não foi seguido como instrução; só fica registrado aqui
caso você não tenha colocado esse trecho e queira investigar a origem do arquivo.

### 3. Tratamento de outliers — o que foi testado e por quê

O notebook tem uma seção (2.2) explicando `treat_outliers()` (em `methods.py`), com dois parâmetros
que mudam o resultado:

- **método** para achar o limite: `STD` (média ± fator×desvio-padrão) ou `IQR` (Q1/Q3 ± fator×IQR);
- **tratamento**: `cap` (substitui o valor pelo limite) ou `remove` (descarta a linha inteira).

Ao longo da sessão, comparamos essas combinações porque **os extremos de `torque_nm` e
`speed_rpm` não são ruído — são o próprio sinal físico das falhas de potência e sobrecarga**
(regras determinísticas descobertas na aula 1). Tratar esses valores como outliers estatísticos
apaga parte do que o modelo mais precisa aprender.

**Seção 9** do notebook usa `IQR, remove` como pipeline principal. **Seção 9.3** repete tudo com
`IQR, cap`, para comparar. **Seção 10** compara quatro cenários lado a lado, incluindo duas colunas
novas construídas a partir do conhecimento físico da aula 1:

- `wear_torq = torque_nm × tool_wear_min` (mesmo produto da regra de sobrecarga);
- `delta_k = process_temp_k − air_temp_k` (mesma diferença da regra de dissipação de calor).

| Cenário | Linhas | Falhas restantes | Recall | Precisão | Custo esperado |
|---|---|---|---|---|---|
| Sem outliers (1,5×STD, remove) | 8.020 | 139/339 (41%) | 58,1% | 62,1% | US$ 13,1M |
| Sem outliers (1,5×IQR, remove) | 9.535 | 263/339 (78%) | 67,5% | 74,0% | US$ 26,2M |
| **Com outliers (sem tratamento)** | 10.000 | 339/339 (100%) | **76,6%** | 71,9% | US$ 25,3M |
| IQR + `wear_torq` + `delta_k` | 9.535 | 263/339 (78%) | 72,5% | 76,3% | **US$ 22,2M** |

**Conclusões principais:**
- `STD` é muito mais agressivo que `IQR` para remoção — o desvio-padrão é inflado pelos próprios
  extremos que tenta limitar, então derruba 59% das falhas reais.
- Manter os dados brutos (sem tratar nada) dá o maior recall isolado.
- Adicionar `wear_torq`/`delta_k` recupera boa parte do sinal perdido pela remoção via IQR — e
  fecha com o **menor custo esperado entre os quatro cenários**, mesmo partindo de menos dados.
- Nenhum dos quatro bate a meta de recall ≥95% no limiar padrão (0,5) — isso só se atinge
  calibrando o limiar de decisão (seções 9.1–9.3 mostram como).

### 4. Modelo exportado para uso offline
A pasta `model/` tem o classificador já treinado, para não precisar re-rodar o notebook toda vez:

- `lgbm_aviation_model.pkl` — modelo completo (scikit-learn wrapper);
- `lgbm_aviation_model.txt` — o mesmo modelo em formato nativo do LightGBM;
- `model_config.json` — features usadas, limiares calibrados, custos de FN/FP.

`predict_offline.py` carrega esses arquivos e aplica o sistema de decisão **GO / NO-GO** a novos
dados, sem precisar abrir o Jupyter:

```bash
cd aula_02_modelos_preditivos
python predict_offline.py                  # roda uma demonstração
python predict_offline.py exemplo_dados.csv # aplica a um CSV (6 casos de teste)
```

### 5. Dashboards (HTML, 100% offline)

Todos autocontidos — sem CDN, sem fonte externa, sem internet necessária. Abrem com duplo-clique.

| Arquivo | O que mostra |
|---|---|
| `dashboard_sistema_falhas.html` | Sistema GO/NO-GO original: matriz de confusão, métricas de segurança, comparação de limiares |
| `dashboard_sistema_falhas_IRQ_outlier.html` | Cenário com outliers tratados (cap por IQR) |
| `dashboard_sistema_falhas_IRQ_no-outlier.html` | Cenário sem tratamento (dados brutos) |
| `dashboard_comparacao_cenarios.html` | Os 4 cenários da seção 10, lado a lado (o mais recente e completo) |

> Nota: alguns desses dashboards foram publicados também como link no claude.ai em versões
> anteriores desta sessão. A partir do seu pedido mais recente, paramos de publicar novos links —
> só os arquivos locais acima são mantidos daqui em diante.

### 6. Um incidente que vale saber
Em um certo ponto, o notebook aberto no Jupyter Lab do seu navegador sobrescreveu edições minhas
(uma aba antiga salvou por cima do arquivo mais novo) — perdemos a seção 9.3 e a mudança para
`treatment="remove"` temporariamente. Foi recuperado, mas o alerta vale para o futuro: **se o
notebook estiver aberto numa aba enquanto eu edito, recarregue a aba (F5) antes de mexer nela**,
para não perder trabalho de um lado ou do outro.

---

## Mapa de arquivos (pasta `aula_02_modelos_preditivos/`)

```
aula_02_modelos_preditivos/
├── modelo_preditivo.ipynb              # notebook principal (11 seções)
├── methods.py                          # treat_outliers(), plot_outliers(), etc.
├── ai4i2020.csv                        # dataset (10.000 registros)
├── CONFUSION_MATRIX_GUIDE.md           # guia de interpretação (contém a anomalia da seção 2 acima)
├── exemplo_dados.csv                   # 6 casos de teste p/ predict_offline.py
├── predict_offline.py                  # sistema GO/NO-GO sem precisar do Jupyter
├── model/
│   ├── lgbm_aviation_model.pkl
│   ├── lgbm_aviation_model.txt
│   └── model_config.json
├── dashboard_sistema_falhas.html
├── dashboard_sistema_falhas_IRQ_outlier.html
├── dashboard_sistema_falhas_IRQ_no-outlier.html
└── dashboard_comparacao_cenarios.html
```

## Como rodar tudo de novo, do zero

```bash
cd "ita_cdoma"
./.venv/bin/jupyter lab          # abre o Jupyter (ambiente já tem lightgbm, sklearn, etc.)
```

No notebook: **Kernel → Restart Kernel and Run All Cells**. Deve rodar do início ao fim sem erro —
todos os bugs listados na seção 1 já estão corrigidos.
