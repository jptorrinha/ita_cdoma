# Caso de Monte Carlo — estrutura
# Implementação de referência para reprodução e replicação em aula.
# Caso mitigado: threshold_inspecao <- 10000L e intervalo_inspecao <- 5000L.

###### Dados de entrada ######

life_limit <- 80000L # FC o L significa Inteiro
tam_frota <- 1000L

# Dados da trinca
trinca_inicial_min <- 0.1 # milímetros
trinca_inicial_max <- 1 # milímetros
tam_critico_trinca <- 100 # milímetros

propagacao_trinca_min <- 1.8e-4
propagacao_trinca_max <- 2e-4

#beta, eta e gama da weibull 3P que dita a probabilidade de detecção de uma trinca em mm.
beta <- 1.5
eta <- 10
gama <- 1

ciclos_mes_min <- 180
ciclos_mes_max <- 220

threshold_inspecao <- 15000L #FC
intervalo_inspecao <- 7500L #FC
limite_inspeção_min <- -1000L #Quantos FC antes pode ser feita a parada de manutenção
limite_inspeção_max <- 0L #Quantos FC após pode ser feita a parada de manutenção

FHFC_min=1.3 #mínimo da relacao FH/FC
FHFC_max=1.7 #maximo da relacao FH/FC

# inicio dos calculos

meses_simulacao <- as.integer(ceiling(life_limit/ciclos_mes_min)) #Número máximo de meses da simulação
set.seed(10)

###### Funções ######

prob_deteccao <- function(tam_trinca) {
          x <- pmax(tam_trinca - gama, 0)
          1 - exp(-((x / eta)^beta))

}

cont<-0
simular_estruturas <- function(tam_frota) {

          cont<<-cont+1
          cat(cont,"\r")

          #inicializa os vetores

          #calcula vetores fixos da frota
          FC_mes_aeronaves <- (ciclos_mes_min + sample.int(ciclos_mes_max - ciclos_mes_min + 1, tam_frota, replace = TRUE) - 1) #Gera o FC por mes aleatório de cada aeronave
          FHFC_aeronaves <- runif(tam_frota, FHFC_min,FHFC_max) # FH/FC aleatório para cada aeronave.
          FH_mes_aeronaves <- FC_mes_aeronaves * FHFC_aeronaves #Gera o FH por mes aleatório de cada aeronave

          FC_mes_acc_frota <- rowSums(pmin(outer(1:meses_simulacao, FC_mes_aeronaves, "*"),life_limit)) #Calcula vetor the FC acumulado da frota a cada mês

          FH_mes_acc_frota <- rowSums(pmin(outer(1:meses_simulacao, FH_mes_aeronaves, "*"),life_limit*FHFC_aeronaves)) #Calcula vetor the FH acumulada da frota a cada mês

          ######

          fc_aeronave <- integer(tam_frota) #inicializa a ciclagem de cada aeronave da frota
          falhas_mes <- integer(meses_simulacao) #inicializa vetor de falhas

          trinca_inicial <- runif(tam_frota, trinca_inicial_min,trinca_inicial_max)
          propagacao_trinca <- runif(tam_frota, propagacao_trinca_min,propagacao_trinca_max)
          repintervalo <- integer(tam_frota) #Vetor de quantas vezes o intervalo já foi executado - inicia em 0

          ativos <- seq_len(tam_frota)

          while (length(ativos)) {
                     a <- ativos #ínidices ativos
                     tam_ativos <- length(a) #tamanho do vetor de ativos

                     #proxima inspeção somente para os ativos (que não chegaram ao final da vida)
                     prox_inspecao <- threshold_inspecao+ (intervalo_inspecao*repintervalo[a])+ (limite_inspeção_min + sample.int(limite_inspeção_max - limite_inspeção_min + 1, tam_ativos, replace = TRUE) - 1L) #a próxima inspeção é Threshold + intervalo +- margem permitida (números aletórios gerados para as margens)

                     # essas aeronaves chegariam ao fim da simulação
                     i_chegaria_ao_fim <- ((fc_aeronave[a]+prox_inspecao) >= life_limit)
                     prox_inspecao[i_chegaria_ao_fim] <- life_limit-fc_aeronave[a[i_chegaria_ao_fim]]

                     tam_trinca_prox_inspecao <- trinca_inicial[a] * exp(propagacao_trinca[a]*prox_inspecao)

                     # peças que falharam antes da próxima inspeção
                     i_falhou_antes <- tam_trinca_prox_inspecao>=tam_critico_trinca
                     wi_falhou_antes <- a[i_falhou_antes]
                     if(length(wi_falhou_antes)){ # Para os itens que falharam antes da insepção

                                #calcula FC no tamanho crítico
                                fc_falha <- ceiling((log(tam_critico_trinca/trinca_inicial[wi_falhou_antes])/propagacao_trinca[wi_falhou_antes]))
                                #atualiza FC das aeronaves
                                fc_aeronave[wi_falhou_antes] <- fc_aeronave[wi_falhou_antes] + fc_falha

                                meses_falha <- ceiling(fc_aeronave[wi_falhou_antes]/FC_mes_aeronaves[wi_falhou_antes]) #calcula o mês de operacao da aeronave em que a falha ocorreu.

                                falhas_mes <- falhas_mes + tabulate(meses_falha, nbins = length(falhas_mes)) #soma a quantidade de falhas nos respectivos meses.

                                #Reseta a peça falhada
                                repintervalo[wi_falhou_antes]<- -1L #inspeção volta para o threshold - será somado 1 posteriormente
                                t<-length(wi_falhou_antes) #qtde de peças que falharam
                                trinca_inicial[wi_falhou_antes] <- runif(t, trinca_inicial_min,trinca_inicial_max) #reinicia trinca
                                propagacao_trinca[wi_falhou_antes] <- runif(t, propagacao_trinca_min,propagacao_trinca_max) #reinicia propagacao

                     }

                     # peças que não falharam antes da inspeção, que não chegariam ao fim da vida até a inspeção e a trinca foi detectada na inspeção

                     i_detectada_prox_inspecao <- (runif(tam_ativos) < prob_deteccao(tam_trinca_prox_inspecao)) & !i_falhou_antes & !i_chegaria_ao_fim

                     wi_detectada_prox_inspecao <- a[i_detectada_prox_inspecao]
                     if(length(wi_detectada_prox_inspecao)){

                                #atualiza FC das aeronaves
                                fc_aeronave[wi_detectada_prox_inspecao] <- fc_aeronave[wi_detectada_prox_inspecao] + prox_inspecao[i_detectada_prox_inspecao]

                                #Reseta a peça falhada
                                repintervalo[wi_detectada_prox_inspecao]<- -1L #inspeção volta para o threshold - será somado 1 posteriormente
                                t<-length(wi_detectada_prox_inspecao) #qtde de peças que falharam
                                trinca_inicial[wi_detectada_prox_inspecao] <- runif(t, trinca_inicial_min,trinca_inicial_max) #reinicia trinca
                                propagacao_trinca[wi_detectada_prox_inspecao] <- runif(t, propagacao_trinca_min,propagacao_trinca_max) #reinicia propagacao
                     }
                     repintervalo[a]<-repintervalo[a]+1L #pula para o próximo intervalo de inspeção

                     # Continuam ativos as peças que a proxima inspeção é antes do fim da vida util ou que falharam antes de atingir o final da vida util.

                     i_terminou <- i_chegaria_ao_fim & !i_falhou_antes
                     ativos<-ativos[!i_terminou]
          }
          falhas_mes_acumuladas <- cumsum(falhas_mes)
          return(c(falhas_mes_acumuladas, FH_mes_acc_frota))
}

###### Simulação e resultados ######

###### Multiplas execuções ######

n_rep <- 1000 # Modo rápido em aula; use 10000 para reproduzir a referência.
resultados_mc <- replicate(n_rep, simular_estruturas(tam_frota))

# vetor com a média das falhas_acumuladas e média das FH_acumuladas
resultado_medio <- rowMeans(resultados_mc)

n <- meses_simulacao

falhas_acum_medias <- resultado_medio[1:n]

FH_acum_medias <- resultado_medio[(n+1):(2*n)]

FR <- falhas_acum_medias/FH_acum_medias

#plot(FH_acum_medias,FR,type = "l",ylim = c(0,max(FR)*1.01))

meses<-1:meses_simulacao
plot(FH_acum_medias,FR,type = "l",ylim = c(0,max(FR)*1.01))
plot(meses,FR,type = "l",ylim = c(0,max(FR)*1.01))
cat(sprintf("Monte Carlo, %d repetições %d meses: Média de Falhas: %.3f - FR: %.3e\n",

         n_rep,meses_simulacao, tail(falhas_acum_medias,1),
tail(falhas_acum_medias,1)/tail(FH_acum_medias,1)))
