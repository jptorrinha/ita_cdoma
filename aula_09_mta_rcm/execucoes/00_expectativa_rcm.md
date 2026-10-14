# Expectativa registrada ANTES das execuções alternativas do RCM

Registrada em: 2026-10-14 09:15:21 -03
Até este momento só o cenário padrão havia sido executado (ótimo = 8 000 h, fronteira da busca).

Funções de custo documentadas no manual do aplicativo:
  PMC(t) = (Horizonte/t) × R(t) × PMC
  CMC(t) = [1 − R(t)] × CMC
  Total(t) = PMC(t) + CMC(t),  R(t) = exp(−t/MTBF)

**Expectativa:** dobrar o CMC deve **encurtar** o intervalo ótimo, porque dobra o peso do único termo
que cresce com t, [1 − R(t)] × CMC, e o mínimo passa a ocorrer onde a queda do termo preventivo é
compensada mais cedo. Pela derivada, a condição de mínimo H·PMC·(1/t² + λ/t) = λ·CMC passaria a ter
solução dentro da faixa, perto de 5 500 h. Dobrar o PMC deve **alongar** o intervalo, ou mantê-lo na
fronteira de 8 000 h, porque reforça o termo (Horizonte/t), que só diminui com t. Como no padrão o
custo total já decresce até 8 000 h, a expectativa é que o ótimo continue preso à fronteira.
