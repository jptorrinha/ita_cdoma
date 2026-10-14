"""Monta PBIT_atuador_solucao.ows a partir do pbit.ows do professor.

Mantém a estrutura e os scripts dele (divisão agrupada por SN, Bootstrap, SMOTE, Random Forest,
Test and Score, Matriz de Confusão, ROC, Rank). Altera apenas:
  - título e descrição do fluxo;
  - os dois Select Columns: contextos regerados para o esquema dos nossos CSVs
    (atributos, classe FailureMode, meta SN), em vez dos contextos salvos para os CSVs dele;
  - os importadores de CSV: remove os caminhos absolutos C:/Users/celio/..., ficando só o caminho
    relativo à pasta do fluxo;
  - acrescenta dois Test and Score com o mesmo Random Forest sobre os 1488 testes (CV 10-fold aleatória
    e CV agrupada por SN), uma Matriz de Confusão e uma anotação, para mostrar o vazamento por SN.

Uso: /Applications/Orange.app/Contents/MacOS/python montar_fluxo_orange.py
Pré-requisito: preparar_dados_orange.py já rodou.
"""
import ast
import base64
import os
import pickle
import xml.etree.ElementTree as ET
from pathlib import Path

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from AnyQt.QtWidgets import QApplication

app = QApplication([])

from Orange.data import Table
from Orange.widgets.data.owselectcolumns import OWSelectAttributes

PASTA = Path(__file__).resolve().parent
ORIGEM = PASTA / "pbit.ows"
DESTINO = PASTA / "PBIT_atuador_solucao.ows"

SEGMENTOS = ["ExtInicio", "ExtFim", "ConInicio", "ConFim"]
STATS_SEG = ["Mean", "Std", "Min", "Max", "Range", "RMS", "Delta", "Slope"]
ATRIBUTOS_4SEG = [f"{s}_{k}" for s in SEGMENTOS for k in STATS_SEG] + ["Ext_Mean", "Con_Mean", "ExtCon_MeanDiff"]
ATRIBUTOS_GLOBAL = ["Mean", "Std", "Min", "Max", "Range", "Median", "Q25", "Q75", "IQR", "RMS",
                    "FirstValue", "LastValue", "Delta", "Slope", "Area"]


def config_select_columns(csv: Path, atributos: list[str], metas: list[str]) -> str:
    """Configuração (base64 de pickle) do Select Columns: atributos, classe FailureMode e metas."""
    dados = Table(str(csv))
    w = OWSelectAttributes()
    w.set_data(dados)
    por_nome = {v.name: v for v in list(dados.domain.variables) + list(dados.domain.metas)}
    w.used_attrs[:] = [por_nome[n] for n in atributos]
    w.class_attrs[:] = [por_nome["FailureMode"]]
    w.meta_attrs[:] = [por_nome[n] for n in metas]
    usados = set(atributos) | {"FailureMode"} | set(metas)
    w.available_attrs[:] = [v for n, v in por_nome.items() if n not in usados]
    w.commit.now() if hasattr(w.commit, "now") else w.commit()
    cfg = w.settingsHandler.pack_data(w)
    cfg.pop("savedWidgetGeometry", None)
    return base64.b64encode(pickle.dumps(cfg, protocol=4)).decode("ascii")


def sem_caminho_absoluto(texto: str) -> str:
    cfg = ast.literal_eval(texto)
    cfg["_session_items_v2"] = [(p, o) for p, o in cfg["_session_items_v2"] if p.get("type") == "VarPath"]
    cfg["dialog_state"] = {"directory": "", "filter": "Text - comma separated (*.csv, *)"}
    return repr(cfg)


def config_test_and_score(agrupado: bool) -> str:
    """Test and Score sobre os 1488 testes (saída do Select features), aleatório ou agrupado por SN."""
    from Orange.data import Domain
    from Orange.widgets.evaluate.owtestandscore import OWTestAndScore

    bruto = Table(str(PASTA / "PBIT_orange_features_4seg.csv"))
    dom = bruto.domain
    dados = bruto.transform(Domain([dom[n] for n in ATRIBUTOS_4SEG], dom["FailureMode"], [dom["SN"]]))
    w = OWTestAndScore()
    w.set_train_data(dados)
    w.handleNewSignals()
    if agrupado:
        w.resampling = OWTestAndScore.FeatureFold
        w.fold_feature = dados.domain["SN"]
        w.fold_feature_selected = True
    else:
        w.resampling = OWTestAndScore.KFold
        w.n_folds = 2          # índice da opção "10"
        w.cv_stratified = True
    cfg = w.settingsHandler.pack_data(w)
    cfg.pop("savedWidgetGeometry", None)
    return base64.b64encode(pickle.dumps(cfg, protocol=4)).decode("ascii")


def acrescentar_comparacao(raiz):
    """Dois Test and Score extras com o mesmo Random Forest: CV aleatória (vaza SN) e CV agrupada por SN."""
    nos, ligacoes, props = raiz.find("nodes"), raiz.find("links"), raiz.find("node_properties")
    novos_nos = [
        ("15", "CV 10-fold ALEATÓRIA (vaza SN)", "Orange.widgets.evaluate.owtestandscore.OWTestAndScore",
         "Test and Score", (876.0, 700.0), "pickle", config_test_and_score(False)),
        ("16", "CV agrupada por SN (1 série por fold)", "Orange.widgets.evaluate.owtestandscore.OWTestAndScore",
         "Test and Score", (876.0, 830.0), "pickle", config_test_and_score(True)),
        ("17", "Matriz (CV por SN)", "Orange.widgets.evaluate.owconfusionmatrix.OWConfusionMatrix",
         "Confusion Matrix", (1124.0, 830.0), "literal", "{'append_predictions': True, 'append_probabilities': True}"),
    ]
    for nid, titulo, qn, nome, pos, fmt, texto in novos_nos:
        ET.SubElement(nos, "node", {"id": nid, "name": nome, "qualified_name": qn, "project_name": "Orange3",
                                    "version": "", "title": titulo, "position": str(pos)})
        p = ET.SubElement(props, "properties", {"node_id": nid, "format": fmt})
        p.text = texto
    proximo = max(int(l.get("id")) for l in ligacoes) + 1
    novas = [
        ("1", "16", "Data", "Data", "data", "train_data"),
        ("1", "15", "Data", "Data", "data", "train_data"),
        ("3", "15", "Learner", "Learner", "learner", "learner"),
        ("3", "16", "Learner", "Learner", "learner", "learner"),
        ("16", "17", "Evaluation Results", "Evaluation Results", "evaluations_results", "evaluation_results"),
    ]
    for k, (src, dst, sc, dc, sid, did) in enumerate(novas):
        ET.SubElement(ligacoes, "link", {"id": str(proximo + k), "source_node_id": src, "sink_node_id": dst,
                                         "source_channel": sc, "sink_channel": dc, "enabled": "true",
                                         "source_channel_id": sid, "sink_channel_id": did})
    anot = raiz.find("annotations")
    texto = ET.SubElement(anot, "text", {"id": "0", "type": "text/plain", "rect": "(300.0, 690.0, 520.0, 170.0)",
                                         "font-family": "Helvetica", "font-size": "13"})
    texto.text = ("Comparação acrescentada (mesmo Random Forest, mesmos 1488 testes):\n"
                  "- CV 10-fold ALEATÓRIA: testes do mesmo SN caem no treino e no teste -> resultado otimista.\n"
                  "- CV agrupada por SN: cada fold deixa uma série inteira de fora -> estimativa honesta para\n"
                  "  unidades novas. Compare o CA dos dois Test and Score.\n"
                  "O ramo SMOTE exige o pacote imblearn (não vem no Orange do macOS); o fluxo principal usa Bootstrap.")


def main():
    arvore = ET.parse(ORIGEM)
    raiz = arvore.getroot()
    raiz.set("title", "PBIT do atuador: classificação de falhas (TE-292)")
    raiz.set("description",
             "Base: pbit.ows (professor). Dados: PBIT_atuador_DESCARAC_r1.xlsx -> preparar_dados_orange.py -> "
             "PBIT_orange_features_4seg.csv. Divisão treino/teste agrupada por SN; oversampling só no treino.")

    cfg4seg = config_select_columns(PASTA / "PBIT_orange_features_4seg.csv", ATRIBUTOS_4SEG, ["SN"])
    cfg_global = config_select_columns(PASTA / "PBIT_orange_features.csv", ATRIBUTOS_GLOBAL, ["SN", "ID", "FailureDescription"])
    novos = {"1": cfg4seg, "12": cfg_global}

    for p in raiz.find("node_properties"):
        no = p.get("node_id")
        if no in novos:
            p.text = novos[no]
        elif no in ("0", "11"):
            p.text = sem_caminho_absoluto(p.text)

    acrescentar_comparacao(raiz)
    arvore.write(DESTINO, encoding="utf-8", xml_declaration=True)
    print("gravado:", DESTINO.name)


if __name__ == "__main__":
    main()
