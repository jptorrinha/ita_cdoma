"""

| **Disciplina** | TE-292 — Ciência de Dados em Operação e Manutenção de Aeronaves |
| **Instituição** | Instituto Tecnológico de Aeronáutica (ITA) — AeroLogLab |
| **Professor** | Antonio Celio Pereira de Mesquita |
| **Aluno** | João Paulo Gomes de Oliveira |

Otimizador de estoque de sobressalentes implementando METRIC e VARI-METRIC
(TE-292, Aula 4 — ver metric_slides_completo.pdf).

Modelo de dois escalões, política (s-1, s): um parque (local 0) repara o
que as bases não conseguem reparar sozinhas e resuprime todas as bases;
cada base também repara uma fração de suas próprias falhas no local.
Estocar uma unidade no parque reduz o tempo de ressuprimento efetivo visto
por *todas* as bases simultaneamente (via delta_j, abaixo) — por isso
parque e bases precisam ser otimizados em conjunto. Otimizar cada base
isoladamente (como um modelo de um único escalão faria) ignora esse
acoplamento por completo (slide 29).
"""

import math
import toml
from dataclasses import dataclass
from typing import Callable, List, Tuple
import matplotlib.pyplot as plt  # usa o backend nativo do sistema (evita o plugin Qt "cocoa" quebrado no macOS)

HOURS_PER_DAY = 24.0


@dataclass
class Base:
    id: int
    name: str
    dtrans: float     # OST_i: tempo de pedido e embarque, parque -> base (dias)
    assets: int        # aeronaves/sistemas sustentados por esta base
    duty_cycle: float  # fração do calendário em que cada aeronave opera
    grounded: float    # custo de indisponibilidade (USD por dia)


@dataclass
class Part:
    name: str
    cost: float
    lambda_: float    # falhas por hora de operação ("lambda_" evita a palavra reservada)
    qpa: int           # quantidade por conjunto (quantity per assembly)
    drt: float         # DRT_j: tempo médio de reparo no parque (dias)
    r: float = 0.0      # r_j: fração da demanda deste item reparada na própria base
    brt: float = 0.0    # BRT_j: tempo médio de reparo na base (dias), usado quando r_j > 0


# ---------------------------------------------------------------------------
# Primitivas de Poisson / binomial negativa.
#
# O Teorema de Palm (slide 18) diz que só a média de cada lead time importa
# para a distribuição do pipeline — a forma/variância é irrelevante. Isso
# também é verificado empiricamente no slide 51 (CV=0 vs CV=0,8 mudam o VMR
# do pipeline em menos de 0,001). Por isso, propositalmente, nenhum desvio-
# padrão de lead time ou "fator de segurança" infla uma média aqui.
#
# As PMFs são avaliadas em espaço logarítmico (log k! = lgamma(k+1), como
# a nota do slide 21 pede) para que um k grande nunca estoure
# math.factorial.
# ---------------------------------------------------------------------------

def poissonPMF(k: int, mu: float) -> float:
    """P(X = k) para X ~ Poisson(mu)."""
    if mu <= 0.0:
        return 1.0 if k == 0 else 0.0
    if k < 0:
        return 0.0
    return math.exp(-mu + k * math.log(mu) - math.lgamma(k + 1))


def negBinomPMF(k: int, nu: float, p: float) -> float:
    """P(X = k) para X ~ BinomialNegativa(nu, p) (média = nu*(1-p)/p)."""
    if k < 0:
        return 0.0
    return math.exp(math.lgamma(k + nu) - math.lgamma(nu) - math.lgamma(k + 1)
                     + nu * math.log(p) + k * math.log(1.0 - p))


def makePMF(mu: float, vmr: float = 1.0) -> Callable[[int], float]:
    """
    k -> P(X=k) para uma distribuição com média `mu` e variância `vmr*mu`.

    vmr == 1 (o parque, sempre: slide 19) dá Poisson. vmr > 1 (bases sob
    VARI-METRIC: slides 43-45) dá a binomial negativa que casa os dois
    momentos.
    """
    if mu <= 0.0:
        return lambda k: (1.0 if k == 0 else 0.0)
    if vmr <= 1.0 + 1e-9:
        return lambda k: poissonPMF(k, mu)
    nu = mu / (vmr - 1.0)
    p = 1.0 / vmr
    return lambda k: negBinomPMF(k, nu, p)


def getPoissonCDF(pmf: Callable[[int], float], s: int) -> float:
    """P(X <= s). Nome herdado do caso Poisson, mas funciona para qualquer pmf."""
    if s < 0:
        return 0.0
    return sum(pmf(k) for k in range(s + 1))


def getExpectedBackorders(pmf: Callable[[int], float], s: int, mu: float) -> float:
    """
    EBO(s) = E[max(X-s, 0)] (slide 22), calculado como:

        mu - soma_{k=0}^{s} k*P(k) - s*(1 - F(s))

    (repartindo soma_{k>s}(k-s)P(k) em suas parcelas k*P(k) e s*P(k)). O
    termo final s*(1-F(s)) importa: omiti-lo subestima o EBO em silêncio
    para todo s > 0 — conferido numericamente contra a tabela de mu=1,63
    do slide 23.
    """
    if s < 0:
        return mu
    weighted = sum(k * pmf(k) for k in range(s + 1))
    cdf_s = sum(pmf(k) for k in range(s + 1))
    return mu - weighted - s * (1.0 - cdf_s)


def getFillRate(pmf: Callable[[int], float], s: int) -> float:
    """
    FR(s) = P(X < s) = CDF(s-1): probabilidade de atendimento imediato (slide 24).

    Propositalmente P(X < s), não P(X <= s) — a prateleira só atende uma
    demanda nova quando s - X > 0 *antes* dessa demanda chegar.
    """
    if s <= 0:
        return 0.0
    return getPoissonCDF(pmf, s - 1)


def getBackorderVariance(pmf: Callable[[int], float], s: int, mu: float) -> float:
    """
    Var(max(X-s, 0)), por soma direta (truncada) do segundo momento.

    Só é chamada sobre o pipeline (exatamente Poisson) do parque, para
    construir o ajuste de dois momentos da binomial negativa usado no
    VARI-METRIC (slides 43-45).
    """
    ebo = getExpectedBackorders(pmf, s, mu)
    cutoff = s + max(100, int(20 * math.sqrt(mu + 1.0)) + 50)
    second_moment = 0.0
    for k in range(s + 1, cutoff + 1):
        second_moment += (k - s) ** 2 * pmf(k)
    return second_moment - ebo ** 2


# ---------------------------------------------------------------------------
# Taxas de demanda e pipelines (slides 13, 17, 27, 29, 43-44).
# ---------------------------------------------------------------------------

def demandRateBase(base: Base, part: Part) -> float:
    """DR_ij: demanda da base i pelo item j, em falhas por hora de calendário (slide 13)."""
    return base.duty_cycle * base.assets * part.lambda_ * part.qpa


def depotPipelineMean(bases: List[Base], part: Part) -> Tuple[float, float]:
    """(DR_0j, mu_0j): taxa de demanda e média do pipeline no parque (slide 17). Palm-exato."""
    DR0j = sum(demandRateBase(b, part) * (1.0 - part.r) for b in bases)
    mu0j = DR0j * part.drt * HOURS_PER_DAY
    return DR0j, mu0j


def depotDelay(s0j: int, mu0j: float) -> float:
    """
    delta_j(s0j) = EBO_0j(s0j) / mu_0j (slide 27).

    delta=1 quando o parque está zerado (toda demanda espera o reparo
    inteiro); delta -> 0 conforme o estoque do parque cresce (o parque
    "sempre atende").
    """
    if mu0j <= 0.0:
        return 0.0
    pmf0 = makePMF(mu0j, vmr=1.0)
    return getExpectedBackorders(pmf0, s0j, mu0j) / mu0j


def rstBase(base: Base, part: Part, delta_j: float) -> float:
    """
    RST_ij(s0j) = r_j*BRT_j + (1-r_j)*(OST_i + delta_j*DRT_j), em horas.

    A equação central (slide 29): o tempo de ressuprimento efetivo visto
    pela base combina seu próprio ciclo de reparo com o ciclo do parque,
    este último inflado pela fração de atraso do próprio parque, delta_j.
    """
    rst_days = part.r * part.brt + (1.0 - part.r) * (base.dtrans + delta_j * part.drt)
    return rst_days * HOURS_PER_DAY


def basePipelines(bases: List[Base], part: Part, s0j: int, method: str
                   ) -> Tuple[List[Tuple[float, float]], float]:
    """
    Para o item `part` com estoque de parque s0j: (mu_ij, vmr_ij) de cada
    base, mais delta_j. Sob "metric", vmr_ij é sempre 1 (Poisson). Sob
    "vari-metric", vmr_ij vem de repartir o pipeline da base numa parcela
    Poisson privada (reparo local ou em trânsito) e numa parcela que
    compartilha o atraso do parque (slides 42-45); as duas são assumidas
    independentes.
    """
    DR0j, mu0j = depotPipelineMean(bases, part)
    delta_j = depotDelay(s0j, mu0j)

    use_vari = method == "vari-metric" and DR0j > 0.0
    if use_vari:
        pmf0 = makePMF(mu0j, vmr=1.0)
        EB0j = getExpectedBackorders(pmf0, s0j, mu0j)
        VarB0j = getBackorderVariance(pmf0, s0j, mu0j)

    results = []
    for base in bases:
        DR_ij = demandRateBase(base, part)
        rst_h = rstBase(base, part, delta_j)
        mu_ij = DR_ij * rst_h

        vmr_ij = 1.0
        if use_vari and mu_ij > 0.0:
            DR0ij = (1.0 - part.r) * DR_ij
            qij = DR0ij / DR0j
            mu_fresh = DR_ij * rstBase(base, part, delta_j=0.0)  # slide 43
            Var_B0ij = qij ** 2 * VarB0j + qij * (1.0 - qij) * EB0j
            var_ij = mu_fresh + Var_B0ij
            vmr_ij = var_ij / mu_ij

        results.append((mu_ij, vmr_ij))

    return results, delta_j


# ---------------------------------------------------------------------------
# Otimizador guloso conjunto (algoritmo do slide 36): uma única decisão de
# estoque compartilhada entre o parque e todas as bases, avaliada unidade
# por unidade.
# ---------------------------------------------------------------------------

def Solve(bases: List[Base], part_list: List[Part], method: str,
          use_cost_weighting: bool, budget: float,
          min_fr: float = 0.0, min_ao: float = 0.0,
          constraint_priority: str = "budget"):
    """
    Otimizador guloso de benefício marginal sobre o sistema inteiro (parque
    + todas as bases de uma vez), seguindo o algoritmo do slide 36:

        1. s0j <- 0, sij <- 0, C <- 0
        2. para cada item j e local l (parque ou uma base), avaliar dZ_j,l
        3. alocar a unidade no argmax do benefício
        4. registrar (C, Ao, FR mínimo)
        5. repetir até a regra de parada disparar

    Estocar uma unidade numa base só afeta aquele par (item, base), então
    seu benefício tem a forma fechada |EBO(s+1) - EBO(s)| = Pr{X > s}
    (slide 35). Estocar uma unidade no parque muda delta_j e, portanto, o
    pipeline de todas as bases para aquele item ao mesmo tempo — por isso
    seu benefício é avaliado recomputando diretamente o EBO de todas essas
    bases com s0j+1 e comparando. Como parque e bases não são de fato
    separáveis (slide 35, "O alcance da exatidão"), esta varredura gulosa
    conjunta é uma heurística, não uma solução exata — a mesma ressalva que
    o slide faz sobre a enumeração de Sherbrooke.

    constraint_priority escolhe qual regra de parada governa o critério de
    término (a lista "budget, min_fr, min_ao, all" do slide 52):
      - "budget":  para quando o custo excede o orçamento.
      - "min_fr":  ignora o orçamento, para quando toda taxa de atendimento
                   (item, base) atinge min_fr.
      - "min_ao":  ignora o orçamento, para quando o Ao ponderado do
                   sistema atinge min_ao.
      - "all":     para quando o custo excede o orçamento, OU quando
                   min_fr e min_ao estão simultaneamente satisfeitos —
                   o que vier primeiro.
    Observação (slide 52): chamar isto com constraint_priority="min_fr"
    (ou "min_ao") com o limiar deixado em 0 satisfaz a meta de imediato —
    a corrida termina após uma única unidade.
    """
    n_bases = len(bases)

    print("-----")
    print(f"Estoque do sistema ({method}), ponderação por custo = {use_cost_weighting}")
    print(f"Min FR = {min_fr:.2f}, Min Ao = {min_ao:.2f}, Prioridade = {constraint_priority}")
    print("-----")

    s0 = [0] * len(part_list)                    # estoque do parque, por item
    s = [[0] * len(part_list) for _ in bases]     # estoque da base, por base e por item
    Ct = 0.0
    As, Costs, FRs = [], [], []

    def current_state(j):
        return basePipelines(bases, part_list[j], s0[j], method)

    def min_fill_rate():
        worst = 1.0
        for j in range(len(part_list)):
            pipelines, _ = current_state(j)
            for i in range(n_bases):
                mu_ij, vmr_ij = pipelines[i]
                worst = min(worst, getFillRate(makePMF(mu_ij, vmr_ij), s[i][j]))
        return worst

    def system_ao():
        """Ao ponderado do sistema (slide 40): base maior e mais ocupada pesa mais."""
        sum_ebo = [0.0] * n_bases
        sum_dr = [0.0] * n_bases
        for j, part in enumerate(part_list):
            pipelines, _ = current_state(j)
            for i, base in enumerate(bases):
                mu_ij, vmr_ij = pipelines[i]
                sum_ebo[i] += getExpectedBackorders(makePMF(mu_ij, vmr_ij), s[i][j], mu_ij)
                sum_dr[i] += demandRateBase(base, part)

        aos, weights = [], []
        for i, base in enumerate(bases):
            if sum_dr[i] <= 0.0:
                aos.append(1.0)
                weights.append(0.0)
                continue
            WT = sum_ebo[i] / sum_dr[i]                # Equação 9
            AWT = WT * base.duty_cycle                  # Equação 10
            MTBF = 1.0 / sum_dr[i]
            aos.append(MTBF / (MTBF + AWT))              # Equação 12
            weights.append(base.assets * base.duty_cycle)

        wsum = sum(weights)
        if wsum <= 0.0:
            return sum(aos) / len(aos) if aos else 1.0
        return sum(a * w for a, w in zip(aos, weights)) / wsum

    while True:
        best_benefit = 0.0
        best = None  # ("base", i, j) ou ("depot", None, j)

        for j, part in enumerate(part_list):
            pipelines, _ = current_state(j)

            # Locais de base: benefício em forma fechada, parque mantido fixo.
            for i in range(n_bases):
                mu_ij, vmr_ij = pipelines[i]
                pmf = makePMF(mu_ij, vmr_ij)
                cur = getExpectedBackorders(pmf, s[i][j], mu_ij)
                nxt = getExpectedBackorders(pmf, s[i][j] + 1, mu_ij)
                benefit = cur - nxt
                if use_cost_weighting:
                    benefit /= part.cost
                if benefit > best_benefit:
                    best_benefit = benefit
                    best = ("base", i, j)

            # Local do parque: recomputação "e se", já que s0j desloca delta_j
            # (e, portanto, o pipeline de toda base) de uma só vez.
            pipelines_next, _ = basePipelines(bases, part, s0[j] + 1, method)
            cur_sum = sum(
                getExpectedBackorders(makePMF(*pipelines[i]), s[i][j], pipelines[i][0])
                for i in range(n_bases)
            )
            nxt_sum = sum(
                getExpectedBackorders(makePMF(*pipelines_next[i]), s[i][j], pipelines_next[i][0])
                for i in range(n_bases)
            )
            benefit = cur_sum - nxt_sum
            if use_cost_weighting:
                benefit /= part.cost
            if benefit > best_benefit:
                best_benefit = benefit
                best = ("depot", None, j)

        if best is None:
            break  # nenhuma alocação restante com benefício positivo

        kind, i, j = best
        if kind == "base":
            s[i][j] += 1
        else:
            s0[j] += 1
        Ct += part_list[j].cost

        Ao = system_ao()
        FRmin = min_fill_rate()
        As.append(Ao)
        Costs.append(Ct)
        FRs.append(FRmin)

        if constraint_priority == "budget":
            if Ct > budget:
                break
        elif constraint_priority == "min_fr":
            if FRmin >= min_fr:
                break
        elif constraint_priority == "min_ao":
            if Ao >= min_ao:
                break
        elif constraint_priority == "all":
            if Ct > budget or (FRmin >= min_fr and Ao >= min_ao):
                break

    _printReport(bases, part_list, s0, s, method, Ct, As[-1] if As else 1.0)
    return As, Costs, FRs


def _printReport(bases, part_list, s0, s, method, Ct, Ao_final):
    print(f"\nParque\nPart\t s0\t EBO0(s0)\t delta")
    for j, part in enumerate(part_list):
        if s0[j] > 0:
            _, mu0j = depotPipelineMean(bases, part)
            EB0j = getExpectedBackorders(makePMF(mu0j), s0[j], mu0j)
            delta_j = depotDelay(s0[j], mu0j)
            print("%s\t %d\t %.5f\t %.3f" % (part.name, s0[j], EB0j, delta_j))

    for i, base in enumerate(bases):
        print(f"\n{base.name}\nPart\t s\t EBO(s)\t \t FR(s)")
        grounded_ebo = 0.0
        for j, part in enumerate(part_list):
            pipelines, _ = basePipelines(bases, part, s0[j], method)
            mu_ij, vmr_ij = pipelines[i]
            pmf = makePMF(mu_ij, vmr_ij)
            ebo = getExpectedBackorders(pmf, s[i][j], mu_ij)
            grounded_ebo += ebo
            if s[i][j] > 0:
                fr = getFillRate(pmf, s[i][j])
                print("%s\t %d\t %.5f\t %.2f" % (part.name, s[i][j], ebo, fr))
        print("Custo diário estimado de indisponibilidade = %.2f" % (base.grounded * grounded_ebo))

    print("\nCusto de estoque = {:,.2f}".format(Ct))
    print("Disponibilidade operacional do sistema = %.4f" % (Ao_final))


# ---------------------------------------------------------------------------
# Menu interativo
# ---------------------------------------------------------------------------

def show_menu():
    """Exibe o menu principal de configuração"""
    print("\n" + "=" * 60)
    print("    SISTEMA DE OTIMIZAÇÃO DE ESTOQUE DE SOBRESSALENTES")
    print("=" * 60)
    print("Selecione os parâmetros de configuração:")
    print()


def get_data_file():
    """Seleciona o arquivo de dados"""
    print("1. Configuração de dados:")
    print("   1) parts2B12P.toml (2 bases, 12 itens, orçamento: $250.000)")
    print("   2) parts1B28P.toml (1 base, 28 itens, orçamento: $900.000)")

    while True:
        choice = input("   Selecione o arquivo (1-2): ").strip()
        if choice == '1':
            return 'parts2B12P.toml', 250_000
        elif choice == '2':
            return 'parts1B28P.toml', 900_000
        else:
            print("   Escolha inválida. Digite 1 ou 2.")


def get_method():
    """Seleciona METRIC ou VARI-METRIC"""
    print("\n2. Método:")
    print("   1) METRIC (pipeline da base: Poisson)")
    print("   2) VARI-METRIC (pipeline da base: binomial negativa, ajuste de dois momentos)")

    while True:
        choice = input("   Selecione o método (1-2): ").strip()
        if choice == '1':
            return "metric"
        elif choice == '2':
            return "vari-metric"
        else:
            print("   Escolha inválida. Digite 1 ou 2.")


def get_cost_weighting():
    """Seleciona a estratégia de ponderação por custo"""
    print("\n3. Estratégia de otimização:")
    print("   1) Efetividade (maximiza o benefício, independente do custo)")
    print("   2) Eficiência (razão benefício-custo — prioriza itens mais baratos)")

    while True:
        choice = input("   Selecione a estratégia (1-2): ").strip()
        if choice == '1':
            return False
        elif choice == '2':
            return True
        else:
            print("   Escolha inválida. Digite 1 ou 2.")


def get_min_fill_rate():
    """Seleciona a restrição de taxa de atendimento mínima"""
    print("\n4. Restrição de taxa de atendimento mínima:")
    print("   Digite a taxa mínima (0,0 a 1,0, ou 0 para nenhuma restrição)")
    print("   Exemplos: 0.75 = 75%, 0.85 = 85%, 0 = sem restrição")

    while True:
        try:
            rate = float(input("   Fill rate mínimo: ").strip())
            if 0.0 <= rate <= 1.0:
                return rate
            else:
                print("   Faixa inválida. Digite entre 0.0 e 1.0.")
        except ValueError:
            print("   Entrada inválida. Digite um número.")


def get_min_ao():
    """Seleciona a restrição de disponibilidade operacional mínima"""
    print("\n5. Restrição de disponibilidade operacional (Ao) mínima:")
    print("   Digite o Ao mínimo do sistema (0,0 a 1,0, ou 0 para nenhuma restrição)")

    while True:
        try:
            rate = float(input("   Ao mínimo: ").strip())
            if 0.0 <= rate <= 1.0:
                return rate
            else:
                print("   Faixa inválida. Digite entre 0.0 e 1.0.")
        except ValueError:
            print("   Entrada inválida. Digite um número.")


def get_priority_constraint():
    """Seleciona a prioridade entre as restrições"""
    print("\n6. Critério de parada:")
    print("   1) Prioridade de orçamento (para ao exceder o orçamento)")
    print("   2) Prioridade de fill rate (para ao atingir o fill rate mínimo)")
    print("   3) Prioridade de Ao (para ao atingir o Ao mínimo)")
    print("   4) Todas (para no orçamento, ou quando fill rate e Ao forem ambos atingidos)")

    while True:
        choice = input("   Selecione a prioridade (1-4): ").strip()
        if choice == '1':
            return "budget"
        elif choice == '2':
            return "min_fr"
        elif choice == '3':
            return "min_ao"
        elif choice == '4':
            return "all"
        else:
            print("   Escolha inválida. Digite de 1 a 4.")


def confirm_configuration(data_file, method, use_cost_weighting, budget,
                           min_fill_rate, min_ao, priority):
    """Exibe o resumo da configuração e pede confirmação"""
    print("\n" + "-" * 60)
    print("RESUMO DA CONFIGURAÇÃO:")
    print(f"  Arquivo de dados: {data_file}")
    print(f"  Método: {method}")
    print(f"  Estratégia: {'Eficiência (ponderada por custo)' if use_cost_weighting else 'Apenas efetividade'}")
    print(f"  Orçamento: ${budget:,.0f}")
    print(f"  Fill rate mínimo: {min_fill_rate:.0%}" + (" (sem restrição)" if min_fill_rate == 0 else ""))
    print(f"  Ao mínimo: {min_ao:.0%}" + (" (sem restrição)" if min_ao == 0 else ""))
    print(f"  Prioridade: {priority}")
    print("-" * 60)

    while True:
        choice = input("Prosseguir com esta configuração? (s/n): ").strip().lower()
        if choice in ['s', 'sim', 'y', 'yes']:
            return True
        elif choice in ['n', 'nao', 'não', 'no']:
            return False
        else:
            print("Digite 's' ou 'n'.")


if __name__ == "__main__":
    # Configuração interativa via menu
    show_menu()

    data_file, default_budget = get_data_file()
    data = toml.load(data_file)

    base_list = [Base(**base_data) for base_data in data['base']]
    part_list = [Part(**part_data) for part_data in data['part']]

    method = get_method()
    use_cost_weighting = get_cost_weighting()
    min_fill_rate = get_min_fill_rate()
    min_ao = get_min_ao()
    priority = get_priority_constraint()
    budget = default_budget

    if not confirm_configuration(data_file, method, use_cost_weighting,
                                  budget, min_fill_rate, min_ao, priority):
        print("Configuração cancelada. Encerrando...")
        exit()

    As, Costs, FRs = Solve(base_list, part_list, method, use_cost_weighting,
                            budget, min_fill_rate, min_ao, priority)

    # plotagem dos resultados
    cm = 1 / 2.54  # centímetros em polegadas
    plt.figure(figsize=(20 * cm, 20 * cm))

    cost_weight_label = "Ponderado por custo" if use_cost_weighting else "Sem ponderação de custo"
    plt.title(f'Desempenho do estoque do sistema ({len(base_list)} bases)\n'
              f'{method}, {cost_weight_label}, Orçamento: ${budget:,.0f}, '
              f'Min FR: {min_fill_rate:.0%}, Min Ao: {min_ao:.0%}, Prioridade: {priority}',
              fontsize=11)

    plt.xlabel('Custo', fontsize=12)
    plt.ylabel('Disponibilidade Operacional', fontsize=12)

    plt.xticks(rotation=45, fontsize=11)

    plt.scatter(Costs, As, c="green", label="Disponibilidade Operacional")
    plt.scatter(Costs, FRs, c="red", label="Fill Rate Mínimo")
    plt.scatter([0.0], [1.0], c="blue", label="Ponto Utopia", marker="*", s=100)

    minCost = min(Costs)
    maxCost = max(Costs)
    minA = min(As)

    if (maxCost - minCost) > 0:  # evita divisão por zero

        minDist = 1.0
        k = -1
        for i, cost in enumerate(Costs):

            # distância em termos de disponibilidade
            deltaA = (1.0 - As[i]) / (1.0 - minA) if minA < 1.0 else 0.0
            # distância em termos de custo
            deltaC = (cost - minCost) / (maxCost - minCost)

            dist = math.sqrt(deltaA ** 2 + deltaC ** 2)

            if dist < minDist:
                minDist = dist
                k = i

        plt.scatter([Costs[k]], [As[k]], c="blue", s=80, label="Solução Ótima", marker="D")

    for i, val in enumerate(As):
        str_ = "  %.2f (%d)" % (val, i)
        plt.annotate(str_, (Costs[i], As[i]))

    plt.grid()
    plt.legend(loc='lower right', fontsize=10)

    plt.show()
