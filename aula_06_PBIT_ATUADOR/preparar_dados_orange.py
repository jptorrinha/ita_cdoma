"""Gera os CSVs de atributos que o fluxo do professor (pbit.ows) espera, a partir de PBIT_atuador_DESCARAC_r1.xlsx.

A aba DATA está transposta: cada COLUNA é um teste de PBIT (um "movimento" do atuador). Linhas:
  1 classe (N01, N02, F01–F06) | 2 índice do teste | 3 número de série (SN) | 4 vazia | 5–127 as 123 amostras.

Saídas (mesmos nomes e colunas do que o pbit.ows referencia, na mesma pasta):
  PBIT_orange_features.csv       23 colunas: 15 estatísticas globais por teste
  PBIT_orange_features_4seg.csv  46 colunas: 8 estatísticas em cada um de 4 segmentos + 3 globais

Os CSVs originais do professor não foram fornecidos; os nomes das colunas vêm dos contextos salvos no pbit.ows.
SUPOSIÇÕES (a regra exata do professor não está no .ows):
  - os 4 segmentos são quatro blocos consecutivos de ~31 amostras; ExtInicio/ExtFim = 1º/2º bloco (extensão)
    e ConInicio/ConFim = 3º/4º bloco (contração);
  - `SeverityIndex` não é reconstruível e foi omitido (no pbit.ows ele nem é usado como atributo);
  - `Delta` = último − primeiro valor; `Slope` = inclinação da reta ajustada; `Area` = integral trapezoidal.

Qualidade dos dados (ver VALIDACAO_E_SOLUCAO.md):
  - células "#VALUE!" (erro do Excel) viram ausentes e são contadas em MissingPoints;
  - testes com > 10% de ausentes são removidos (2 testes de F06, SN 045); os demais têm a lacuna interpolada.

Uso: /Applications/Orange.app/Contents/MacOS/python preparar_dados_orange.py
"""
import csv
from pathlib import Path

import numpy as np
import openpyxl

PASTA = Path(__file__).resolve().parent
ENTRADA = PASTA / "PBIT_atuador_DESCARAC_r1.xlsx"
MAX_AUSENTES = 0.10
STATS_SEG = ["Mean", "Std", "Min", "Max", "Range", "RMS", "Delta", "Slope"]
STATS_GLOBAL = ["Mean", "Std", "Min", "Max", "Range", "Median", "Q25", "Q75", "IQR", "RMS",
                "FirstValue", "LastValue", "Delta", "Slope", "Area"]
SEGMENTOS = ["ExtInicio", "ExtFim", "ConInicio", "ConFim"]


def ler_planilha(caminho):
    wb = openpyxl.load_workbook(caminho, read_only=True, data_only=True)
    linhas = [list(r) for r in wb["DATA"].iter_rows(values_only=True)]
    descricao = {r[1]: r[2] for r in wb["Falhas"].iter_rows(min_row=2, values_only=True) if r[1]}
    if any(v is not None for v in linhas[3]):
        raise ValueError("a linha 4 da aba DATA deveria estar vazia: o layout mudou")
    sinal = np.array([[v if isinstance(v, (int, float)) else np.nan for v in linha] for linha in linhas[4:]],
                     dtype=float).T
    return linhas[0], linhas[1], linhas[2], sinal, descricao


def inclinacao(y: np.ndarray) -> float:
    return float(np.polyfit(np.arange(len(y)), y, 1)[0])


def stats_segmento(y: np.ndarray) -> dict:
    return {"Mean": y.mean(), "Std": y.std(ddof=1), "Min": y.min(), "Max": y.max(), "Range": np.ptp(y),
            "RMS": np.sqrt(np.mean(y ** 2)), "Delta": y[-1] - y[0], "Slope": inclinacao(y)}


def stats_global(y: np.ndarray) -> dict:
    q25, q75 = np.percentile(y, [25, 75])
    return {"Mean": y.mean(), "Std": y.std(ddof=1), "Min": y.min(), "Max": y.max(), "Range": np.ptp(y),
            "Median": np.median(y), "Q25": q25, "Q75": q75, "IQR": q75 - q25,
            "RMS": np.sqrt(np.mean(y ** 2)), "FirstValue": y[0], "LastValue": y[-1],
            "Delta": y[-1] - y[0], "Slope": inclinacao(y), "Area": float(np.trapezoid(y))}


def main():
    classe, indice, serie, sinal, descricao = ler_planilha(ENTRADA)
    n_total = sinal.shape[1]
    ausentes = np.isnan(sinal)
    frac = ausentes.mean(axis=1)
    manter = np.flatnonzero(frac <= MAX_AUSENTES)
    removidos = [(indice[i], classe[i], serie[i], int(ausentes[i].sum())) for i in np.flatnonzero(frac > MAX_AUSENTES)]

    ordem_na_serie: dict[str, int] = {}
    linhas_global, linhas_seg = [], []
    x = np.arange(n_total)
    interpolados = 0
    for i in manter:
        y = sinal[i].copy()
        falta = ausentes[i]
        if falta.any():
            y[falta] = np.interp(x[falta], x[~falta], y[~falta])
            interpolados += 1
        sn = serie[i]
        ordem_na_serie[sn] = ordem_na_serie.get(sn, 0) + 1
        blocos = np.array_split(np.arange(n_total), len(SEGMENTOS))

        base = {"ID": indice[i], "SN": sn}
        validos = int((~falta).sum()); faltantes = int(falta.sum())
        g = stats_global(y)
        linhas_global.append({**base, "ValidPoints": validos, "MissingPoints": faltantes, **g,
                              "MaxPosition": int(np.argmax(y)) + 1, "MinPosition": int(np.argmin(y)) + 1,
                              "FailureMode": classe[i], "FailureDescription": descricao.get(classe[i], "")})

        seg = {"ID": indice[i], "SN": sn, "SerialRunIndex": ordem_na_serie[sn], "FailureMode": classe[i],
               "ValidPoints": validos, "MissingPoints": faltantes}
        for nome, idx in zip(SEGMENTOS, blocos):
            seg[f"{nome}_ValidPoints"] = int((~falta[idx]).sum())
            for k, v in stats_segmento(y[idx]).items():
                seg[f"{nome}_{k}"] = v
        seg["Ext_Mean"] = float(np.mean(y[np.concatenate(blocos[:2])]))
        seg["Con_Mean"] = float(np.mean(y[np.concatenate(blocos[2:])]))
        seg["ExtCon_MeanDiff"] = seg["Ext_Mean"] - seg["Con_Mean"]
        linhas_seg.append(seg)

    def gravar(nome, linhas):
        with open(PASTA / nome, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(linhas[0]))
            w.writeheader()
            for r in linhas:
                w.writerow({k: (f"{v:.10g}" if isinstance(v, (float, np.floating)) else v) for k, v in r.items()})
        print(f"gravado: {nome} | {len(linhas)} linhas x {len(linhas[0])} colunas")

    gravar("PBIT_orange_features.csv", linhas_global)
    gravar("PBIT_orange_features_4seg.csv", linhas_seg)
    print(f"entrada: {ENTRADA.name} | testes: {sinal.shape[0]} | removidos (> {MAX_AUSENTES:.0%} ausentes): {removidos}")
    print(f"testes com lacuna interpolada: {interpolados}")
    cont = {}
    for r in linhas_global:
        cont[r["FailureMode"]] = cont.get(r["FailureMode"], 0) + 1
    print("testes por classe:", dict(sorted(cont.items())))


if __name__ == "__main__":
    main()
