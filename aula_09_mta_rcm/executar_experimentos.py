"""Executa os experimentos da aula 9 nos aplicativos oficiais e guarda as respostas brutas.

RCM: https://tool.aerologlab.ita.br/rcm  (POST /rcm/optimize, JSON)
MTA: https://tool.aerologlab.ita.br/mta  (POST /mta/simulate, formulário)

São as mesmas requisições que as páginas web enviam ao clicar em "Run Optimization" / "Run Simulation".
Cada resposta é salva em execucoes/<id>.json com os parâmetros e o horário; o resumo vai para
execucoes/resumo.json.

Uso:  python3 executar_experimentos.py rcm     (as 3 execuções do RCM)
      python3 executar_experimentos.py mta     (3 execuções por cenário/alvo do MTA, 5 000 simulações)
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

BASE = "https://tool.aerologlab.ita.br"
PASTA = Path(__file__).resolve().parent / "execucoes"
PASTA.mkdir(exist_ok=True)

# Cenário "Default Example" do RCM: valores devolvidos por GET /rcm/scenario/default
MTBF, LIM, HORIZONTE, PASSO = 15000, 600, 8000, 100
RCM = {
    "rcm_1_padrao": {"pmc": 315, "cmc": 847},
    "rcm_2_cmc_x2": {"pmc": 315, "cmc": 1694},
    "rcm_3_pmc_x2": {"pmc": 630, "cmc": 847},
}
N_SIM = 5000            # opção "Balanced"
REPETICOES = 3


def post(caminho, dados, json_body):
    if json_body:
        corpo, tipo = json.dumps(dados).encode(), "application/json"
    else:
        corpo, tipo = urllib.parse.urlencode(dados).encode(), "application/x-www-form-urlencoded"
    req = urllib.request.Request(BASE + caminho, data=corpo, headers={"Content-Type": tipo}, method="POST")
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read())


def salvar(ident, parametros, resposta):
    resposta = dict(resposta)
    resposta.pop("plot", None)
    resposta.pop("plots", None)          # imagens base64: não são necessárias para a análise
    registro = {"id": ident, "horario": datetime.now().astimezone().isoformat(timespec="seconds"),
                "parametros": parametros, "resposta": resposta}
    (PASTA / f"{ident}.json").write_text(json.dumps(registro, indent=2, ensure_ascii=False))
    return registro


def executar_rcm():
    saida = []
    for ident, custos in RCM.items():
        p = {**custos, "lambda": 1 / MTBF, "lim": LIM, "time_horizon": HORIZONTE, "step": PASSO,
             "distribution_type": "exponential"}
        r = post("/rcm/optimize", p, json_body=True)
        reg = salvar(ident, {**p, "mtbf": MTBF}, r)
        res = r["result"]
        print(f"{ident}: PMC={custos['pmc']} CMC={custos['cmc']} -> ótimo {res['best_t']:.0f} h, "
              f"R={res['best_r']:.4f}, total ótimo {res['optimal_total_cost']:.2f}, "
              f"total no LIM {res['lim_total_cost']:.2f}, economia anual {res['annual_savings']:.2f}")
        saida.append(reg)
    return saida


def executar_mta(casos):
    saida = []
    for cenario, alvo in casos:
        for k in range(1, REPETICOES + 1):
            p = {"scenario": cenario, "target_time": alvo, "num_simulations": N_SIM}
            r = post("/mta/simulate", p, json_body=False)
            reg = salvar(f"mta_{cenario}_alvo{alvo}_exec{k}", p, r)
            s = r["stats"]
            print(f"{cenario} alvo {alvo} exec {k}: média {s['mean']:.1f}, P90 {s['p90']:.1f}, P95 {s['p95']:.1f}, "
                  f"CV {s['coefficient_of_variation']:.2f}%, P(no alvo) {s['prob_on_time']:.4f}, risco {r['risk_level']}")
            saida.append(reg)
            time.sleep(1)
    return saida


if __name__ == "__main__":
    modo = sys.argv[1] if len(sys.argv) > 1 else ""
    if modo == "rcm":
        executar_rcm()
    elif modo == "mta":
        casos = [tuple(c.split(":")) for c in sys.argv[2:]] or [("tire_replacement", "300"), ("avionics_check", "200")]
        executar_mta([(c, int(a)) for c, a in casos])
    else:
        print(__doc__)
