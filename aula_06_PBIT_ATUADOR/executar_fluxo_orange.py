"""Abre um fluxo .ows com o motor do Orange (sem interface), executa e imprime os resultados de cada Test and Score.

Uso: /Applications/Orange.app/Contents/MacOS/python executar_fluxo_orange.py [PBIT_atuador_solucao.ows]
"""
import os
import sys
import time
from pathlib import Path

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from AnyQt.QtWidgets import QApplication

app = QApplication([])

import numpy as np
from orangecanvas.registry import WidgetRegistry
from orangewidget.workflow.discovery import WidgetDiscovery
from orangewidget.workflow.widgetsscheme import WidgetsScheme
from Orange.canvas.config import Config
from Orange.evaluation import CA, F1
from Orange.widgets.evaluate.owtestandscore import OWTestAndScore
from sklearn.metrics import balanced_accuracy_score, confusion_matrix, recall_score

OWS = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).with_name("PBIT_atuador_solucao.ows")).resolve()
LIMITE_S = 600

registro = WidgetRegistry()
WidgetDiscovery(registro).run(Config.widgets_entry_points())
esquema = WidgetsScheme()
esquema.set_runtime_env("basedir", str(OWS.parent))   # a interface define isso: caminhos relativos ao .ows
with open(OWS, "rb") as f:
    esquema.load_from(f, registry=registro)
widgets = {n.title: esquema.widget_for_node(n) for n in esquema.nodes}
avaliacoes = {t: w for t, w in widgets.items() if isinstance(w, OWTestAndScore)}


def concluido() -> bool:
    return all(w.learners and all(s.results is not None for s in w.learners.values()) for w in avaliacoes.values())


t0 = time.time()
while time.time() - t0 < LIMITE_S and not concluido():
    app.processEvents()
    time.sleep(0.05)
print(f"fluxo: {OWS.name} | tempo: {time.time() - t0:.1f} s | concluído: {concluido()}")

for titulo, w in widgets.items():
    for tipo in ("Error", "Warning"):
        grupo = getattr(w, tipo, None)
        for m in (grupo.active if grupo is not None else []):
            print(f"[{tipo}] {titulo}: {str(m)[:200]}")

for titulo, w in avaliacoes.items():
    print(f"\n== {titulo} (treino {len(w.data) if w.data else 0}"
          f"{f', teste {len(w.test_data)}' if w.test_data is not None and w.resampling == OWTestAndScore.TestOnTest else ''}) ==")
    for slot in w.learners.values():
        r = slot.results.value if slot.results is not None and hasattr(slot.results, "value") else None
        if r is None:
            print("  sem resultados")
            continue
        classes = r.domain.class_var.values
        rotulos = range(len(classes))
        print(f"  {slot.learner.name}: CA={CA(r)[0]:.3f}  F1 macro={F1(r, average='macro')[0]:.3f}  "
              f"acurácia balanceada={balanced_accuracy_score(r.actual, r.predicted[0]):.3f}  "
              f"| sempre N01={np.mean(r.actual == classes.index('N01')):.3f}")
        rec = recall_score(r.actual, r.predicted[0], average=None, labels=rotulos, zero_division=0)
        print("  recall por classe:", {c: round(float(x), 2) for c, x in zip(classes, rec)})
        print("  matriz de confusão (linhas = real, colunas = previsto):", classes)
        print(confusion_matrix(r.actual, r.predicted[0], labels=rotulos))
